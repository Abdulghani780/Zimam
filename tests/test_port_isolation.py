"""TEST-PORT-001 — Unit & Integration tests for AI Port Isolation Guard."""
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app.infrastructure import db
from backend.app.services.port_isolation_service import PortIsolationService


class TestPortIsolation(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = patch.object(db, 'DB_PATH', Path(self.temp_dir.name) / 'ports.db')
        self.db_path.start()
        with db.get_db_connection() as conn:
            conn.execute("""
                CREATE TABLE port_reservations (
                    port INTEGER PRIMARY KEY,
                    username TEXT NOT NULL,
                    description TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
        PortIsolationService._claims.clear()

    def tearDown(self):
        PortIsolationService._claims.clear()
        self.db_path.stop()
        self.temp_dir.cleanup()

    def test_free_port_check(self):
        """Verify that an unoccupied port returns available=True and conflict=False."""
        res = PortIsolationService.check_conflict(65432, requesting_user="TestUser")
        self.assertTrue(res['available'])
        self.assertFalse(res['conflict'])
        self.assertEqual(res['suggested_port'], 65432)
        self.assertIsNone(res['current_owner'])

    def test_occupied_port_conflict_detection(self):
        """Verify that when a port is claimed by User A, User B gets conflict=True and an alternate port."""
        # User A claims port 3500
        claim_res = PortIsolationService.claim_port(3500, username="UserA", project_name="ReactApp")
        self.assertTrue(claim_res['ok'])
        self.assertEqual(claim_res['assigned_port'], 3500)

        # User B attempts to access port 3500
        conflict_res = PortIsolationService.check_conflict(3500, requesting_user="UserB")
        self.assertFalse(conflict_res['available'])
        self.assertTrue(conflict_res['conflict'])
        self.assertEqual(conflict_res['current_owner'], "UserA")
        # Suggested port must not be 3500
        self.assertNotEqual(conflict_res['suggested_port'], 3500)
        self.assertIn("محجوز حالياً بواسطة (UserA)", conflict_res['message'])

    def test_port_release(self):
        """Verify that releasing a port frees it for subsequent claims."""
        PortIsolationService.claim_port(4200, username="UserX")
        rel_res = PortIsolationService.release_port(4200)
        self.assertTrue(rel_res['ok'])
        self.assertNotIn(4200, PortIsolationService._claims)

        chk = PortIsolationService.check_conflict(4200, requesting_user="UserY")
        self.assertTrue(chk['available'])

    def test_claim_is_reloaded_from_database(self):
        claim = PortIsolationService.claim_port(4600, username='PersistedUser', project_name='DurableApp')
        self.assertTrue(claim['ok'])

        PortIsolationService._claims.clear()
        PortIsolationService.load_persisted_claims()

        self.assertEqual(PortIsolationService._claims[4600]['username'], 'PersistedUser')
        self.assertEqual(PortIsolationService._claims[4600]['project_name'], 'DurableApp')

    def test_database_failure_does_not_create_memory_only_claim(self):
        with patch.object(db, 'db_set_reservation', side_effect=sqlite3.OperationalError('database unavailable')):
            result = PortIsolationService.claim_port(4601, username='UserA')

        self.assertFalse(result['ok'])
        self.assertNotIn(4601, PortIsolationService._claims)

    def test_release_requires_the_claim_owner(self):
        PortIsolationService.claim_port(4602, username='Owner')
        denied = PortIsolationService.release_port(4602, username='OtherUser')
        self.assertFalse(denied['ok'])
        self.assertEqual(db.db_list_reservations()[0]['username'], 'Owner')

        removed = PortIsolationService.release_port(4602, username='Owner')
        self.assertTrue(removed['ok'])
        self.assertEqual(db.db_list_reservations(), [])

    def test_ports_snapshot_schema(self):
        """Verify snapshot returns expected summary and guard keys."""
        snap = PortIsolationService.get_ports_snapshot(force=True)
        self.assertTrue(snap.get('ok'))
        self.assertIn('summary', snap)
        self.assertIn('guard', snap)
        self.assertIn('ports', snap)
        self.assertIsInstance(snap['ports'], list)


if __name__ == '__main__':
    unittest.main()
