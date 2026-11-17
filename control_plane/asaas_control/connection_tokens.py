from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from datetime import timedelta


@dataclass(frozen=True)
class ConnectionClaims:
    user_id: str
    asset_id: str
    account_id: str
    protocol: str
    actions: frozenset[str]
    expires_at: int
    nonce: str


class ConnectionTokenStore:
    def __init__(self, secret: bytes):
        if len(secret) < 16:
            raise ValueError("Connection token secret must be at least 16 bytes")
        self.secret = secret
        self._used: set[str] = set()

    def issue(self, *, user_id: str, asset_id: str, account_id: str, protocol: str, actions: frozenset[str], ttl: timedelta) -> str:
        payload = {"user_id": user_id, "asset_id": asset_id, "account_id": account_id, "protocol": protocol, "actions": sorted(actions), "expires_at": int(time.time() + ttl.total_seconds()), "nonce": secrets.token_urlsafe(12)}
        raw = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()).decode().rstrip("=")
        sig = hmac.new(self.secret, raw.encode(), hashlib.sha256).hexdigest()
        return f"{raw}.{sig}"

    def consume(self, token: str, *, expected_protocol: str | None = None) -> ConnectionClaims:
        try:
            raw, signature = token.split(".", 1)
            expected = hmac.new(self.secret, raw.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError("Invalid connection token")
            payload = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
            nonce = str(payload["nonce"])
        except Exception as exc:
            raise ValueError("Invalid connection token") from exc
        if nonce in self._used:
            raise ValueError("Connection token already consumed")
        if int(payload["expires_at"]) < int(time.time()):
            raise ValueError("Connection token expired")
        if expected_protocol and payload["protocol"] != expected_protocol:
            raise ValueError("Connection token protocol mismatch")
        self._used.add(nonce)
        return ConnectionClaims(payload["user_id"], payload["asset_id"], payload["account_id"], payload["protocol"], frozenset(payload.get("actions", [])), int(payload["expires_at"]), nonce)
