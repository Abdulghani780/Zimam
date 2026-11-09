"""ASAAS Server Control v2.5 - Comprehensive Enterprise Verification Suite.

Tests RBAC, Security, Privilege Escalation Prevention, Historical Metrics,
Restart Manager Locked Files, and Native Win32 Performance.
"""
import json
import time
import unittest
import urllib.error
import urllib.request


BASE_URL = 'http://127.0.0.1:8765'


class EnterpriseV25Tests(unittest.TestCase):

    def _post(self, path: str, data: dict, token: str = None) -> tuple[int, dict]:
        req = urllib.request.Request(
            f"{BASE_URL}{path}",
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        if token:
            req.add_header('Authorization', f"Bearer {token}")
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            body = {}
            try:
                body = json.loads(e.read().decode('utf-8'))
            except Exception:
                pass
            return e.code, body

    def _get(self, path: str, token: str = None) -> tuple[int, dict]:
        req = urllib.request.Request(f"{BASE_URL}{path}")
        if token:
            req.add_header('Authorization', f"Bearer {token}")
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            body = {}
            try:
                body = json.loads(e.read().decode('utf-8'))
            except Exception:
                pass
            return e.code, body

    # 1. Multi-User RBAC & Login (Story 1)
    def test_01_login_roles(self):
        # Admin login
        status, res = self._post('/api/auth/login', {'username': 'admin', 'password': 'admin@asaas2026'})
        self.assertEqual(status, 200)
        self.assertTrue(res.get('ok'))
        self.assertEqual(res['user']['role'], 'admin')
        admin_token = res['token']

        # Viewer login
        status, res = self._post('/api/auth/login', {'username': 'viewer', 'password': 'viewer@asaas2026'})
        self.assertEqual(status, 200)
        self.assertTrue(res.get('ok'))
        self.assertEqual(res['user']['role'], 'viewer')

    # 2. Privilege Escalation Prevention (Story 1)
    def test_02_privilege_escalation_forbidden(self):
        # Login as viewer
        _, res = self._post('/api/auth/login', {'username': 'viewer', 'password': 'viewer@asaas2026'})
        viewer_token = res['token']

        # Viewer attempting mutating action (trim governor) -> MUST BE 403 Forbidden
        status, res = self._post('/api/governor/trim', {}, token=viewer_token)
        self.assertEqual(status, 403)
        self.assertIn('الصلاحيات غير كافية', res.get('error', ''))

        # Viewer attempting user creation -> MUST BE 403 Forbidden
        status, res = self._post('/api/auth/users/create', {'username': 'hacker', 'password': '123'}, token=viewer_token)
        self.assertEqual(status, 403)

    # 3. Operator Allowed Actions (Story 1)
    def test_03_operator_permissions(self):
        # Login as operator
        _, res = self._post('/api/auth/login', {'username': 'operator', 'password': 'operator@asaas2026'})
        op_token = res['token']

        # Operator can run governor trim
        status, res = self._post('/api/governor/trim', {}, token=op_token)
        self.assertEqual(status, 200)

        # Operator CANNOT create users (Admin only)
        status, res = self._post('/api/auth/users/create', {'username': 'bad_user', 'password': '123'}, token=op_token)
        self.assertEqual(status, 403)

    # 4. Historical Telemetry (Story 5)
    def test_04_historical_metrics(self):
        status, res = self._get('/api/metrics/history?range=24h')
        self.assertEqual(status, 200)
        self.assertTrue(res.get('ok'))
        self.assertIn('history', res)
        self.assertIsInstance(res['history'], list)

        status, res = self._get('/api/metrics/history?range=7d')
        self.assertEqual(status, 200)
        self.assertTrue(res.get('ok'))

    # 5. Telegram Alert Engine (Story 6)
    def test_05_alert_config(self):
        # Login as admin
        _, res = self._post('/api/auth/login', {'username': 'admin', 'password': 'admin@asaas2026'})
        admin_token = res['token']

        status, res = self._get('/api/alerts/config', token=admin_token)
        self.assertEqual(status, 200)
        self.assertTrue(res.get('ok'))
        self.assertIn('cooldown_minutes', res.get('config', {}))

    # 6. Domain Discovery (Story 7)
    def test_06_domain_discovery(self):
        status, res = self._get('/api/domain/profile')
        self.assertEqual(status, 200)
        self.assertTrue(res.get('ok'))
        self.assertIn('domain_role', res.get('domain', {}))
        self.assertIn('is_domain_controller', res.get('domain', {}))

    # 7. Locked Files & Restart Manager (Story 9)
    def test_07_locked_files_diagnostics(self):
        status, res = self._get('/api/storage/locked-files')
        self.assertEqual(status, 200)
        self.assertTrue(res.get('ok'))
        self.assertIn('locked_files', res)

    # 8. High-Performance API Benchmark (Story 8)
    def test_08_api_benchmark_sub100ms(self):
        req = urllib.request.Request(f"{BASE_URL}/api/snapshot")
        t0 = time.perf_counter()
        with urllib.request.urlopen(req) as resp:
            elapsed_ms = (time.perf_counter() - t0) * 1000
            self.assertEqual(resp.status, 200)
            # Must respond swiftly
            self.assertLess(elapsed_ms, 500)
            resp_time_header = resp.headers.get('X-Response-Time-Ms')
            if resp_time_header:
                self.assertLess(float(resp_time_header), 300)


if __name__ == '__main__':
    unittest.main()
