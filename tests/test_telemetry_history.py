"""TEST-OSC-002 — Telemetry & 4-panel System Monitor Oscilloscope verification."""
import unittest
from backend.app.services.telemetry_service import TelemetryService


class TestTelemetryHistory(unittest.TestCase):
    def setUp(self):
        self.service = TelemetryService(history_seconds=10)

    def tearDown(self):
        self.service.shutdown()

    def test_get_metrics(self):
        """Metrics snapshot must contain valid CPU, RAM, OS, and Admin info."""
        m = self.service.get_metrics()
        self.assertGreater(m.cpu_cores, 0)
        self.assertGreaterEqual(m.cpu, 0.0)
        self.assertGreaterEqual(m.ram, 0.0)
        self.assertGreater(m.total_ram, 0.0)
        self.assertTrue(m.os)
        self.assertTrue(m.hostname)

    def test_get_system_history_4_panels(self):
        """System history must provide complete data for CPU, Memory, Network, and Disk."""
        h = self.service.get_system_history()
        self.assertIn('cpu', h)
        self.assertIn('memory', h)
        self.assertIn('network', h)
        self.assertIn('disk', h)

        # Check CPU panel
        self.assertIn('cores', h['cpu'])
        self.assertIn('latest', h['cpu'])

        # Check Memory & Swap panel
        self.assertIn('history', h['memory'])
        self.assertIn('swap_history', h['memory'])
        self.assertGreater(h['memory']['total_gb'], 0)

        # Check Network panel
        self.assertIn('rx_history', h['network'])
        self.assertIn('tx_history', h['network'])

        # Check Disk panel
        self.assertIn('read_history', h['disk'])
        self.assertIn('write_history', h['disk'])


if __name__ == '__main__':
    unittest.main()
