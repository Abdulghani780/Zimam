"""TEST-DATA-004 — Dual-key contract verification between Python models and Frontend."""
import unittest
from backend.app.domain.models import HostMetrics, ManagedAsset, UserSession, StorageBreakdown, LocalUser


class TestApiContracts(unittest.TestCase):
    def test_host_metrics_dual_keys(self):
        """HostMetrics must emit both snake_case and camelCase for all UI widgets."""
        m = HostMetrics(
            cpu=15.5,
            cpu_cores=8,
            cpu_per_core=[10, 20],
            ram=45.0,
            used_ram=16.0,
            total_ram=32.0,
            os="Windows Server 2025",
            hostname="WIN-SERVER",
            uptime_sec=3600,
            is_windows=True,
            is_admin=True
        )
        d = m.to_dict()
        # Snake case keys
        self.assertEqual(d['cpu_cores'], 8)
        self.assertEqual(d['used_ram'], 16.0)
        self.assertEqual(d['total_ram'], 32.0)
        self.assertTrue(d['is_admin'])
        # Camel case keys
        self.assertEqual(d['cpuCores'], 8)
        self.assertEqual(d['usedRam'], 16.0)
        self.assertEqual(d['totalRam'], 32.0)
        self.assertTrue(d['isAdmin'])

    def test_managed_asset_dual_keys(self):
        """ManagedAsset must have both address and host, plus protocol and port."""
        asset = ManagedAsset(
            id="asset-1",
            name="Primary RDP",
            host="192.168.1.50",
            type="Windows Server 2025",
            port=3389,
            protocol="RDP",
            status="online",
            latency_ms=1.2
        )
        d = asset.to_dict()
        self.assertEqual(d['host'], "192.168.1.50")
        self.assertEqual(d['address'], "192.168.1.50")
        self.assertEqual(d['port'], 3389)
        self.assertEqual(d['status'], "online")

    def test_local_user_dual_keys(self):
        """LocalUser must support both full_name and fullName, is_rdp and isRdp."""
        u = LocalUser(
            username="mahmoodSaeed",
            full_name="Mahmood Saeed",
            enabled=True,
            is_rdp=True,
            is_admin=False
        )
        d = u.to_dict()
        self.assertEqual(d['username'], "mahmoodSaeed")
        self.assertEqual(d['full_name'], "Mahmood Saeed")
        self.assertEqual(d['fullName'], "Mahmood Saeed")
        self.assertTrue(d['is_rdp'])
        self.assertTrue(d['isRdp'])


if __name__ == '__main__':
    unittest.main()
