"""Regression tests for the legacy v2 compatibility surface.

These tests intentionally inspect source because the legacy HTTP server has no
application factory.  The v1 control plane has behavioural API tests of its own.
"""

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class LegacySecurityBaselineTests(unittest.TestCase):
    def test_health_never_exposes_a_master_token(self) -> None:
        router = (ROOT / "backend/app/api/router.py").read_text(encoding="utf-8")
        self.assertNotIn("'session_token': SESSION_TOKEN", router)
        self.assertNotIn("token == SESSION_TOKEN", router)

    def test_browser_auth_is_not_stored_in_local_storage(self) -> None:
        api = (ROOT / "frontend/src/lib/api.ts").read_text(encoding="utf-8")
        self.assertNotIn("zimam_session_token", api)
        self.assertNotIn("zimam_auth_claim", api)
        self.assertNotIn("X-Zimam-Token", api)
        self.assertIn("credentials: 'same-origin'", api)

    def test_no_known_default_credentials_are_seeded(self) -> None:
        db = (ROOT / "backend/app/infrastructure/db.py").read_text(encoding="utf-8")
        login = (ROOT / "frontend/src/pages/ZeroTrustLoginPage.tsx").read_text(encoding="utf-8")
        for known_password in (
            "admin@zimam2026",
            "operator@zimam2026",
            "viewer@zimam2026",
            "Admin@Zimam#2026!",
        ):
            self.assertNotIn(known_password, db)
            self.assertNotIn(known_password, login)

    def test_dashboard_routes_have_an_authentication_guard(self) -> None:
        app = (ROOT / "frontend/src/App.tsx").read_text(encoding="utf-8")
        self.assertIn("RequireAuth", app)


if __name__ == "__main__":
    unittest.main()
