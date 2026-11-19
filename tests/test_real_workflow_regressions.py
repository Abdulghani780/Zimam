import json
import socket
import sqlite3
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from backend.app.infrastructure import db
from backend.app.services.alert_service import AlertService, _LAST_ALERT_TIMES
from backend.app.services.developer_workspace_service import DeveloperWorkspaceManager
from backend.app.services.port_isolation_service import PortIsolationService


class AlertDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.original_config = dict(AlertService._config)
        self.original_loaded = AlertService._config_loaded
        AlertService._config.update({
            'telegram_enabled': True,
            'bot_token': 'test-token',
            'chat_id': 'test-chat',
        })
        AlertService._config_loaded = True
        _LAST_ALERT_TIMES.clear()

    def tearDown(self):
        AlertService._config = self.original_config
        AlertService._config_loaded = self.original_loaded
        _LAST_ALERT_TIMES.clear()

    @staticmethod
    def telegram_response(payload):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps(payload).encode('utf-8')
        return response

    def test_test_alert_succeeds_only_after_telegram_accepts_it(self):
        response = self.telegram_response({'ok': True, 'result': {'message_id': 1}})
        with patch('urllib.request.urlopen', return_value=response) as request, patch(
            'backend.app.services.alert_service.db_add_security_event'
        ) as audit:
            result = AlertService.send_telegram_alert('test', force=True, wait_for_delivery=True)

        self.assertTrue(result['ok'])
        self.assertTrue(result['dispatched'])
        request.assert_called_once()
        audit.assert_called_once()

    def test_telegram_rejection_is_not_success(self):
        response = self.telegram_response({'ok': False, 'description': 'chat not found'})
        with patch('urllib.request.urlopen', return_value=response), patch(
            'backend.app.services.alert_service.db_add_security_event'
        ) as audit:
            result = AlertService.send_telegram_alert('test', force=True, wait_for_delivery=True)

        self.assertFalse(result['ok'])
        self.assertFalse(result['dispatched'])
        self.assertEqual(result['reason'], 'chat not found')
        audit.assert_not_called()

    def test_configuration_write_failure_is_propagated(self):
        with patch('backend.app.services.alert_service.db_set_system_metadata', side_effect=sqlite3.OperationalError('database unavailable')):
            with self.assertRaises(sqlite3.OperationalError):
                AlertService.update_config({'cpu_threshold': 91})


class FirewallVerificationTests(unittest.TestCase):
    def test_block_command_failure_is_returned(self):
        failed = SimpleNamespace(returncode=1, stdout='', stderr='access denied')
        with patch('backend.app.services.port_isolation_service.subprocess.run', return_value=failed) as run:
            result = PortIsolationService.block_ip('203.0.113.10')

        self.assertFalse(result['ok'])
        self.assertEqual(result['error'], 'access denied')
        run.assert_called_once()

    def test_block_requires_rule_verification(self):
        created = SimpleNamespace(returncode=0, stdout='', stderr='')
        missing = SimpleNamespace(returncode=1, stdout='', stderr='')
        with patch('backend.app.services.port_isolation_service.subprocess.run', side_effect=[created, missing]):
            result = PortIsolationService.block_ip('203.0.113.11')

        self.assertFalse(result['ok'])
        self.assertNotIn('verified', result)

    def test_verified_block_returns_verified_success(self):
        created = SimpleNamespace(returncode=0, stdout='', stderr='')
        present = SimpleNamespace(returncode=0, stdout='rule', stderr='')
        with patch('backend.app.services.port_isolation_service.subprocess.run', side_effect=[created, present]):
            result = PortIsolationService.block_ip('203.0.113.12')

        self.assertTrue(result['ok'])
        self.assertTrue(result['verified'])


class QuotaPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = patch.object(db, 'DB_PATH', Path(self.temp_dir.name) / 'quotas.db')
        self.db_path.start()
        with db.get_db_connection() as conn:
            conn.execute("""
                CREATE TABLE resource_quotas (
                    id TEXT PRIMARY KEY,
                    scope_type TEXT NOT NULL,
                    scope_id TEXT NOT NULL,
                    cpu_limit REAL NOT NULL,
                    ram_limit_mb INTEGER NOT NULL,
                    disk_limit_gb REAL NOT NULL,
                    max_containers INTEGER NOT NULL,
                    max_projects INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute('CREATE UNIQUE INDEX ux_resource_quotas_scope ON resource_quotas(scope_type, scope_id)')

    def tearDown(self):
        self.db_path.stop()
        self.temp_dir.cleanup()

    def test_quota_save_upserts_one_durable_scope(self):
        db.db_save_resource_quota('user', 'developer', 2, 2048, 10, 2, 2)
        db.db_save_resource_quota('user', 'developer', 4, 4096, 20, 4, 3)

        with db.get_db_connection() as conn:
            rows = conn.execute("SELECT * FROM resource_quotas WHERE scope_type = 'user' AND scope_id = 'developer'").fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['ram_limit_mb'], 4096)
        self.assertEqual(rows[0]['max_projects'], 3)
        self.assertEqual(db.db_get_resource_quotas('user', 'developer')['disk_limit_gb'], 20)

    def test_init_migrates_duplicate_quotas_before_adding_unique_index(self):
        with db.get_db_connection() as conn:
            conn.execute("ALTER TABLE resource_quotas RENAME TO resource_quotas_with_constraints")
            conn.execute("""
                CREATE TABLE resource_quotas (
                    id TEXT PRIMARY KEY,
                    scope_type TEXT NOT NULL,
                    scope_id TEXT NOT NULL,
                    cpu_limit REAL NOT NULL,
                    ram_limit_mb INTEGER NOT NULL,
                    disk_limit_gb REAL NOT NULL,
                    max_containers INTEGER NOT NULL,
                    max_projects INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute("DROP TABLE resource_quotas_with_constraints")
            conn.executemany(
                "INSERT INTO resource_quotas VALUES (?, 'user', 'developer', 2, 2048, 10, 2, 2, ?, ?)",
                [('old', '2024-01-01', '2024-01-01'), ('new', '2024-01-01', '2025-01-01')],
            )

        db.init_db()

        with db.get_db_connection() as conn:
            rows = conn.execute("SELECT id FROM resource_quotas WHERE scope_id = 'developer'").fetchall()
        self.assertEqual([row['id'] for row in rows], ['new'])
        db.db_save_resource_quota('user', 'developer', 4, 4096, 20, 4, 3)
        self.assertEqual(db.db_get_resource_quotas('user', 'developer')['ram_limit_mb'], 4096)

    def test_project_creation_enforces_persisted_project_limit(self):
        with patch(
            'backend.app.services.developer_workspace_service.db_get_resource_quotas',
            return_value={'max_projects': 1, 'disk_limit_gb': 50},
        ), patch(
            'backend.app.services.developer_workspace_service.db_list_developer_projects',
            return_value=[{'id': 'existing'}],
        ):
            result = DeveloperWorkspaceManager.create_project('another', 'developer')

        self.assertFalse(result['ok'])
        self.assertIn('1', result['error'])


class ProjectExecutionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = patch.object(db, 'DB_PATH', Path(self.temp_dir.name) / 'projects.db')
        self.workspace = patch('backend.app.services.developer_workspace_service.WORKSPACE_ROOT', Path(self.temp_dir.name) / 'workspaces')
        self.db_path.start()
        self.workspace.start()
        with db.get_db_connection() as conn:
            conn.execute("""
                CREATE TABLE developer_projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    owner TEXT NOT NULL,
                    runtime TEXT NOT NULL,
                    source_path TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    env_vars TEXT NOT NULL,
                    published_route TEXT NOT NULL,
                    pid INTEGER,
                    created_at TEXT NOT NULL,
                    last_started TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE resource_quotas (
                    id TEXT PRIMARY KEY,
                    scope_type TEXT NOT NULL,
                    scope_id TEXT NOT NULL,
                    cpu_limit REAL NOT NULL,
                    ram_limit_mb INTEGER NOT NULL,
                    disk_limit_gb REAL NOT NULL,
                    max_containers INTEGER NOT NULL,
                    max_projects INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

    def tearDown(self):
        for project_id, process in list(DeveloperWorkspaceManager._RUNNING_PROCESSES.items()):
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=3)
            DeveloperWorkspaceManager._RUNNING_PROCESSES.pop(project_id, None)
        self.workspace.stop()
        self.db_path.stop()
        self.temp_dir.cleanup()

    def test_project_start_is_confirmed_by_tcp_and_stop_updates_database(self):
        created = DeveloperWorkspaceManager.create_project('real-project', 'developer', runtime='Python')
        self.assertTrue(created['ok'])
        project_id = created['project_id']

        started = DeveloperWorkspaceManager.start_project(project_id, 'developer')
        self.assertTrue(started['ok'], started)
        with socket.create_connection(('127.0.0.1', started['port']), timeout=2):
            pass
        running = db.db_list_developer_projects('developer')[0]
        self.assertEqual(running['status'], 'running')
        self.assertEqual(running['pid'], started['pid'])

        stopped = DeveloperWorkspaceManager.stop_project(project_id, 'developer')
        self.assertTrue(stopped['ok'], stopped)
        persisted = db.db_list_developer_projects('developer')[0]
        self.assertEqual(persisted['status'], 'stopped')
        self.assertIsNone(persisted['pid'])


if __name__ == '__main__':
    unittest.main()
