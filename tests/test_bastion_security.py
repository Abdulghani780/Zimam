"""TEST-PAM-003 — Security tests for JumpServer Bastion Command Risk ACL."""
import sqlite3
import unittest
from unittest.mock import Mock, patch

from backend.app.services.bastion_service import BastionService


class TestBastionSecurity(unittest.TestCase):
    def test_block_critical_destructive_commands(self):
        """Dangerous commands must be flagged as CRITICAL risk and blocked."""
        dangerous_cmds = [
            "rm -rf /",
            "rm -rf /var/log",
            "mkfs.ext4 /dev/sda1",
            ":(){ :|:& };:",
            "dd if=/dev/zero of=/dev/sda",
            "format C: /FS:NTFS",
            "shutdown /s /t 0",
        ]
        for cmd in dangerous_cmds:
            res = BastionService.evaluate_command_risk(cmd)
            self.assertEqual(res['risk_level'], 'CRITICAL', f"Failed to flag critical: {cmd}")
            self.assertFalse(res['safe'], f"Command should be marked unsafe: {cmd}")
            self.assertTrue(res['requires_approval'])

    def test_allow_safe_monitoring_commands(self):
        """Harmless administrative query commands must be classified LOW risk and allowed."""
        safe_cmds = [
            "ls -la",
            "dir",
            "uptime",
            "whoami",
            "ps aux",
            "netstat -ano",
            "git status",
        ]
        for cmd in safe_cmds:
            res = BastionService.evaluate_command_risk(cmd)
            self.assertEqual(res['risk_level'], 'LOW', f"Safe command misclassified: {cmd}")
            self.assertTrue(res['safe'], f"Safe command should be marked safe: {cmd}")

    def test_asset_add_does_not_succeed_when_database_write_fails(self):
        asset = Mock()
        asset.to_dict.return_value = {'id': 'asset-test', 'name': 'Test asset'}
        with patch('backend.app.services.bastion_service.db_add_asset', side_effect=sqlite3.OperationalError('database unavailable')):
            with self.assertRaises(sqlite3.OperationalError):
                BastionService.add_asset(asset)

    def test_missing_asset_delete_is_not_reported_as_success(self):
        with patch('backend.app.services.bastion_service.db_remove_asset', return_value=False):
            result = BastionService.remove_asset('missing')
        self.assertFalse(result['ok'])
        self.assertIn('error', result)


if __name__ == '__main__':
    unittest.main()
