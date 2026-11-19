from datetime import UTC, datetime, timedelta
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import pyotp
from fastapi import HTTPException, Request, Response
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from asaas_control import api, storage
from asaas_control.models import Agent, AgentJob, Base, JitGrantRow, User
from asaas_control.recording import SessionRecorder
from asaas_control.security import hash_password, token_hash
from asaas_control.signing import JobSigner


class VerifiedWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        database = Path(self.temp_dir.name) / 'control-plane.db'
        self.engine = create_engine(f'sqlite:///{database}', connect_args={'check_same_thread': False})
        Base.metadata.create_all(self.engine)
        self.sessions = patch.object(
            storage,
            'SessionLocal',
            sessionmaker(bind=self.engine, autoflush=False, expire_on_commit=False),
        )
        self.sessions.start()
        self.signer = patch.object(api, 'get_job_signer', return_value=JobSigner.generate())
        self.signer.start()
        self.agent_key = 'test-agent-key'
        self.agent_id = 'a' * 32
        with storage.db_session() as session:
            self.admin = User(
                id='admin-user',
                username='workflow-admin',
                password_hash=hash_password('Correct horse 123!'),
                is_admin=True,
                is_active=True,
                role='admin',
                full_name='Workflow Admin',
                created_at=datetime.now(UTC),
            )
            session.add(self.admin)
            session.flush()
            session.add(Agent(
                id=self.agent_id,
                name='Test agent',
                enrollment_hash=token_hash(self.agent_key),
                status='online',
            ))
            session.expunge(self.admin)
        api._login_attempts.clear()

    def tearDown(self):
        api._login_attempts.clear()
        self.signer.stop()
        self.sessions.stop()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_mfa_requires_verified_enrollment_and_otp_at_login(self):
        setup = api.setup_mfa(self.admin)
        secret = setup['secret']
        with storage.db_session() as session:
            row = session.get(User, self.admin.id)
            self.assertIsNone(row.mfa_secret)
            self.assertEqual(row.mfa_pending_secret, secret)

        valid_code = pyotp.TOTP(secret).now()
        invalid_code = '000000' if valid_code != '000000' else '000001'
        with self.assertRaises(HTTPException) as invalid:
            api.verify_mfa(api.MfaVerifyRequest(code=invalid_code), self.admin)
        self.assertEqual(invalid.exception.status_code, 401)

        verified = api.verify_mfa(api.MfaVerifyRequest(code=valid_code), self.admin)
        self.assertTrue(verified['enabled'])
        with storage.db_session() as session:
            row = session.get(User, self.admin.id)
            self.assertEqual(row.mfa_secret, secret)
            self.assertIsNone(row.mfa_pending_secret)

        request = Request({
            'type': 'http',
            'method': 'POST',
            'path': '/api/v1/auth/login',
            'headers': [],
            'client': ('127.0.0.1', 12345),
        })
        with self.assertRaises(HTTPException) as missing:
            api.login(api.LoginRequest(username=self.admin.username, password='Correct horse 123!'), request, Response())
        self.assertEqual(missing.exception.detail, 'MFA required')

        authenticated = api.login(
            api.LoginRequest(username=self.admin.username, password='Correct horse 123!', otp=pyotp.TOTP(secret).now()),
            request,
            Response(),
        )
        self.assertTrue(authenticated['authenticated'])

    def test_jit_grant_becomes_active_only_after_agent_success(self):
        created = api.create_jit_grant(api.JitRequest(
            reason='Verified maintenance window',
            agent_id=self.agent_id,
            duration_mins=15,
        ), self.admin)
        grant_id = created['grant']['id']
        self.assertEqual(created['grant']['status'], 'ACTIVATING')

        with storage.db_session() as session:
            job = session.scalar(select(AgentJob).where(AgentJob.job_type == 'jit.grant'))
            self.assertIsNone(session.get(JitGrantRow, grant_id).expires_at)

        api.submit_job_result(
            self.agent_id,
            job.id,
            api.AgentJobResult(status='succeeded', result={'added': True}),
            x_agent_key=self.agent_key,
        )
        with storage.db_session() as session:
            row = session.get(JitGrantRow, grant_id)
            self.assertEqual(row.status, 'active')
            self.assertTrue(row.membership_added)
            self.assertIsNotNone(row.expires_at)

        revoked = api.revoke_jit_grant(grant_id, self.admin)
        self.assertEqual(revoked['grant']['status'], 'REVOKING')
        with storage.db_session() as session:
            revoke_job = session.scalar(select(AgentJob).where(AgentJob.job_type == 'jit.revoke'))
        api.submit_job_result(
            self.agent_id,
            revoke_job.id,
            api.AgentJobResult(status='succeeded', result={'removed': True}),
            x_agent_key=self.agent_key,
        )
        with storage.db_session() as session:
            row = session.get(JitGrantRow, grant_id)
            self.assertEqual(row.status, 'revoked')
            self.assertFalse(row.membership_added)

    def test_failed_agent_activation_never_becomes_active(self):
        created = api.create_jit_grant(api.JitRequest(
            reason='Failure transition verification',
            agent_id=self.agent_id,
        ), self.admin)
        grant_id = created['grant']['id']
        with storage.db_session() as session:
            job = session.scalar(select(AgentJob).where(AgentJob.job_type == 'jit.grant'))
        api.submit_job_result(
            self.agent_id,
            job.id,
            api.AgentJobResult(status='failed', error='Windows group update failed'),
            x_agent_key=self.agent_key,
        )
        with storage.db_session() as session:
            row = session.get(JitGrantRow, grant_id)
            self.assertEqual(row.status, 'failed')
            self.assertIsNone(row.expires_at)
            self.assertEqual(row.last_error, 'Windows group update failed')

    def test_expired_active_grant_queues_signed_revocation(self):
        created = api.create_jit_grant(api.JitRequest(
            reason='Expiry reconciliation verification',
            agent_id=self.agent_id,
        ), self.admin)
        grant_id = created['grant']['id']
        with storage.db_session() as session:
            grant_job = session.scalar(select(AgentJob).where(AgentJob.job_type == 'jit.grant'))
        api.submit_job_result(
            self.agent_id,
            grant_job.id,
            api.AgentJobResult(status='succeeded', result={'added': True}),
            x_agent_key=self.agent_key,
        )
        with storage.db_session() as session:
            row = session.get(JitGrantRow, grant_id)
            row.expires_at = datetime.now(UTC) - timedelta(minutes=1)

        self.assertEqual(api.revoke_expired_jit_grants(), 1)
        with storage.db_session() as session:
            row = session.get(JitGrantRow, grant_id)
            self.assertEqual(row.status, 'revoking')
            revoke_job = session.scalar(select(AgentJob).where(AgentJob.job_type == 'jit.revoke'))
            self.assertIsNotNone(revoke_job.signature)

    def test_recording_export_and_replay_use_the_real_jsonl_stream(self):
        with patch.dict('os.environ', {'ASAAS_RECORDINGS_DIR': self.temp_dir.name}):
            recorder = SessionRecorder(
                'recording-test',
                protocol='rdp',
                asset_id='asset-test',
                account_id='account-test',
                user_id=self.admin.id,
            )
            recorder.record('5.sync,1.0;')
            recorder.close()

            exported = api.export_recording('recording-test', self.admin)
            self.assertEqual(exported.media_type, 'application/x-ndjson')
            self.assertTrue(Path(exported.path).is_file())
            sent = []
            import asyncio
            async def send(text):
                sent.append(text)
            count = asyncio.run(api.session_recording.stream_replay('recording-test', send))
            self.assertEqual(count, 1)
            self.assertEqual(sent, ['5.sync,1.0;'])

    def test_unknown_agent_rolls_back_jit_request(self):
        with self.assertRaises(HTTPException) as missing:
            api.create_jit_grant(api.JitRequest(
                reason='Unknown agent must not queue',
                agent_id='b' * 32,
            ), self.admin)
        self.assertEqual(missing.exception.status_code, 404)
        with storage.db_session() as session:
            count = session.scalar(select(func.count()).select_from(JitGrantRow))
            self.assertEqual(count, 0)


if __name__ == '__main__':
    unittest.main()
