"""ASAAS Server Control — vendor license signer (run on YOUR machine only).

Generates the vendor Ed25519 keypair on first run and signs license payloads.

Usage:
    python tools/sign-license.py --init                     # create dev keypair
    python tools/sign-license.py --customer "Acme" --tier pro ^
        --agents 25 --users 5 --days 365 --id LIC-2026-0001
    python tools/sign-license.py --payload license.json     # sign a JSON file

Key material:
    private: data/license-signing.key  (32-byte hex seed — NEVER ship/commit)
    public : printed by --init; embed the hex in
             control_plane/asaas_control/license.py -> LICENSE_PUBLIC_KEY_HEX
             for production builds (or set ASAAS_LICENSE_PUBLIC_KEY env).
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "control_plane"))

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat, PublicFormat

ROOT = Path(__file__).resolve().parents[1]
PRIV_KEY = Path("data/license-signing.key")
PUBKEY_OUT = ROOT / "data" / "license-pubkey.hex"


def _load_or_create_key() -> Ed25519PrivateKey:
    if PRIV_KEY.exists():
        seed = bytes.fromhex(PRIV_KEY.read_text().strip())
        return Ed25519PrivateKey.from_private_bytes(seed)
    key = Ed25519PrivateKey.generate()
    seed = key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
    PRIV_KEY.parent.mkdir(parents=True, exist_ok=True)
    PRIV_KEY.write_text(seed.hex())
    try:
        PRIV_KEY.chmod(0o600)
    except OSError:
        pass
    return key


def _sign(payload: dict, key: Ed25519PrivateKey) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    sig = key.sign(raw)
    return f"{base64.urlsafe_b64encode(raw).decode().rstrip('=')}.{base64.urlsafe_b64encode(sig).decode().rstrip('=')}"


def main() -> int:
    ap = argparse.ArgumentParser(description="Sign ASAAS Server Control licenses")
    ap.add_argument("--init", action="store_true", help="generate keypair and print public key")
    ap.add_argument("--customer")
    ap.add_argument("--tier", default="pro", choices=["starter", "pro", "enterprise"])
    ap.add_argument("--agents", type=int, default=None, help="max agents (empty = tier default)")
    ap.add_argument("--users", type=int, default=None, help="max users (empty = tier default)")
    ap.add_argument("--days", type=int, default=365, help="license lifetime in days")
    ap.add_argument("--grace", type=int, default=30, help="grace days after expiry")
    ap.add_argument("--id", dest="license_id")
    ap.add_argument("--features", help="comma-separated feature overrides")
    ap.add_argument("--payload", help="path to a full license JSON file to sign as-is")
    ap.add_argument("--out", help="write token to file instead of stdout")
    args = ap.parse_args()

    key = _load_or_create_key()
    pub_hex = key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw).hex()

    if args.init:
        PUBKEY_OUT.write_text(pub_hex)
        print(f"Private key: {PRIV_KEY} (keep secret, never commit)")
        print(f"Public key : {pub_hex}")
        print(f"Dev verify : wrote {PUBKEY_OUT} — the control plane accepts these licenses in dev mode.")
        return 0

    if args.payload:
        payload = json.loads(Path(args.payload).read_text(encoding="utf-8"))
    else:
        if not args.customer:
            ap.error("--customer is required (or use --payload)")
        now = datetime.now(UTC)
        payload = {
            "license_id": args.license_id or f"LIC-{now.strftime('%Y')}-{now.strftime('%m%d%H%M')}",
            "customer": args.customer,
            "tier": args.tier,
            "max_agents": args.agents,
            "max_users": args.users,
            "features": [f.strip() for f in args.features.split(",")] if args.features else None,
            "issued_at": now.isoformat().replace("+00:00", "Z"),
            "expires_at": (now + timedelta(days=args.days)).isoformat().replace("+00:00", "Z"),
            "grace_days": args.grace,
        }
        # Nullable fields (max_agents/max_users/features) must stay present —
        # the verifier requires the keys and applies tier defaults for nulls.

    token = _sign(payload, key)
    if args.out:
        Path(args.out).write_text(token)
        print(f"License written to {args.out}")
    else:
        print(token)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
