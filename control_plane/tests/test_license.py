"""License verification + entitlement unit tests (offline, dev keypair)."""
import base64
import json
import sys
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "control_plane"))

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat, PublicFormat

from zimam_control import license as lic_mod


def _keypair():
    key = Ed25519PrivateKey.generate()
    seed = key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
    pub = key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw).hex()
    return key, seed.hex(), pub


def _payload(**over):
    now = datetime.now(UTC)
    p = {
        "license_id": "LIC-TEST-1",
        "customer": "Test Corp",
        "tier": "pro",
        "max_agents": None,
        "max_users": None,
        "features": None,
        "issued_at": now.isoformat().replace("+00:00", "Z"),
        "expires_at": (now + timedelta(days=365)).isoformat().replace("+00:00", "Z"),
        "grace_days": 30,
    }
    p.update(over)
    return {k: v for k, v in p.items() if v is not None or k in {"max_agents", "max_users", "features"}}


def _sign(payload: dict, seed_hex: str) -> str:
    return lic_mod.sign_license_payload(payload, seed_hex)


class LicenseTests(unittest.TestCase):
    def setUp(self):
        self.key, self.seed, self.pub = _keypair()
        self._old_hex = lic_mod.LICENSE_PUBLIC_KEY_HEX
        lic_mod.LICENSE_PUBLIC_KEY_HEX = self.pub

    def tearDown(self):
        lic_mod.LICENSE_PUBLIC_KEY_HEX = self._old_hex

    def test_valid_license_verifies_and_merges_tier_defaults(self):
        token = _sign(_payload(), self.seed)
        lic = lic_mod.verify_license_token(token)
        self.assertEqual(lic.tier, "pro")
        self.assertEqual(lic.max_agents, 25)   # tier default applied
        self.assertEqual(lic.max_users, 5)
        self.assertIn("vault", lic.features)
        self.assertIn("remote_jobs", lic.features)
        self.assertNotIn("jit", lic.features)

    def test_tampered_payload_rejected(self):
        token = _sign(_payload(), self.seed)
        raw, sig = token.split(".")
        payload = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
        payload["max_agents"] = 9999
        forged = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=") + "." + sig
        with self.assertRaises(lic_mod.LicenseError):
            lic_mod.verify_license_token(forged)

    def test_wrong_key_rejected(self):
        _, other_seed, _ = _keypair()
        token = _sign(_payload(), other_seed)
        with self.assertRaises(lic_mod.LicenseError):
            lic_mod.verify_license_token(token)

    def test_malformed_token_rejected(self):
        for bad in ("", "no-dot", "a.b.c", "!!!.@@@"):
            with self.assertRaises(lic_mod.LicenseError):
                lic_mod.verify_license_token(bad)

    def test_explicit_overrides_win_over_defaults(self):
        token = _sign(_payload(max_agents=3, features=["monitoring"]), self.seed)
        lic = lic_mod.verify_license_token(token)
        self.assertEqual(lic.max_agents, 3)
        self.assertEqual(lic.features, frozenset({"monitoring"}))


if __name__ == "__main__":
    unittest.main()
