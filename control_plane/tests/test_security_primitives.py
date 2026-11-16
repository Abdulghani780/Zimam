from datetime import UTC, datetime, timedelta
import unittest

from zimam_control.audit import AuditChain
from zimam_control.connection_tokens import ConnectionTokenStore
from zimam_control.permissions import AccessContext, AccessPolicy, PermissionEngine
from zimam_control.signing import JobSigner
from zimam_control.vault import EnvelopeVault


class EnvelopeVaultTests(unittest.TestCase):
    def test_secret_is_encrypted_and_bound_to_account(self) -> None:
        vault = EnvelopeVault.generate()
        sealed = vault.seal(b"S3cret!", account_id="account-a")

        self.assertNotIn(b"S3cret!", sealed.ciphertext)
        self.assertEqual(vault.open(sealed, account_id="account-a"), b"S3cret!")
        with self.assertRaises(ValueError):
            vault.open(sealed, account_id="account-b")


class AuditChainTests(unittest.TestCase):
    def test_tampering_is_detected(self) -> None:
        chain = AuditChain(signing_key=b"audit-root-key-for-tests")
        first = chain.append(actor_id="u1", action="asset.view", target_id="a1")
        second = chain.append(actor_id="u1", action="session.open", target_id="a1")
        self.assertTrue(chain.verify([first, second]).intact)

        second.payload["action"] = "session.hide"
        verification = chain.verify([first, second])
        self.assertFalse(verification.intact)
        self.assertEqual(verification.failed_index, 1)


class PermissionEngineTests(unittest.TestCase):
    def test_policy_binds_subject_asset_account_protocol_action_and_time(self) -> None:
        now = datetime.now(UTC)
        policy = AccessPolicy(
            subject_ids=frozenset({"user-1", "group-ops"}),
            asset_ids=frozenset({"asset-1"}),
            account_ids=frozenset({"account-1"}),
            protocols=frozenset({"ssh"}),
            actions=frozenset({"connect", "upload"}),
            valid_from=now - timedelta(minutes=1),
            valid_until=now + timedelta(minutes=5),
        )
        engine = PermissionEngine([policy])
        allowed = AccessContext(
            user_id="user-1",
            group_ids=frozenset(),
            asset_id="asset-1",
            account_id="account-1",
            protocol="ssh",
            action="connect",
            at=now,
        )
        denied = AccessContext(**{**allowed.__dict__, "action": "download"})

        self.assertTrue(engine.is_allowed(allowed))
        self.assertFalse(engine.is_allowed(denied))


class ConnectionTokenTests(unittest.TestCase):
    def test_token_is_short_lived_bound_and_one_time(self) -> None:
        store = ConnectionTokenStore(secret=b"token-signing-key-for-tests")
        token = store.issue(
            user_id="u1",
            asset_id="a1",
            account_id="acct1",
            protocol="rdp",
            actions=frozenset({"connect"}),
            ttl=timedelta(seconds=30),
        )

        claims = store.consume(token, expected_protocol="rdp")
        self.assertEqual(claims.asset_id, "a1")
        with self.assertRaises(ValueError):
            store.consume(token, expected_protocol="rdp")


class JobSigningTests(unittest.TestCase):
    def test_agent_job_signature_rejects_modified_payload(self) -> None:
        signer = JobSigner.generate()
        payload = b'{"job":"inventory.collect","nonce":"n1"}'
        signature = signer.sign(payload)

        self.assertTrue(signer.verify(payload, signature))
        self.assertFalse(signer.verify(payload + b"!", signature))


if __name__ == "__main__":
    unittest.main()
