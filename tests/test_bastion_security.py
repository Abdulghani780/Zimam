"""TEST-PAM-003 — Security tests for JumpServer Bastion Command Risk ACL."""
import unittest
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


if __name__ == '__main__':
    unittest.main()
