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
    def __init__(self, secret: bytes, redis_url: str | None = None):
        if len(secret) < 16:
            raise ValueError("Connection token secret must be at least 16 bytes")
        self.secret = secret
        self._used: set[str] = set()
        self._redis = None
        self._redis_failed = False
        if redis_url:
            try:
                import redis  # type: ignore

                self._redis = redis.Redis.from_url(redis_url, socket_timeout=2, socket_connect_timeout=2)
                self._redis.ping()
            except Exception:
                # Redis unavailable/uninstalled -> degrade to per-process memory
                # (safe for single worker; multi-worker deployments MUST run Redis).
                self._redis = None
                self._redis_failed = True

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
        expires_at = int(payload["expires_at"])
        if expires_at < int(time.time()):
            raise ValueError("Connection token expired")
        if expected_protocol and payload["protocol"] != expected_protocol:
            raise ValueError("Connection token protocol mismatch")
        if self._consume_nonce(nonce, expires_at):
            return ConnectionClaims(payload["user_id"], payload["asset_id"], payload["account_id"], payload["protocol"], frozenset(payload.get("actions", [])), expires_at, nonce)
        raise ValueError("Connection token already consumed")

    def _consume_nonce(self, nonce: str, expires_at: int) -> bool:
        """Atomically mark a nonce consumed. Redis SET NX EX when configured so
        the check survives across multiple workers; falls back to the
        per-process set otherwise."""
        ttl = max(1, expires_at - int(time.time()) + 60)
        if self._redis is not None:
            try:
                # SET key 1 NX EX ttl -> True only for the first consumer.
                return bool(self._redis.set(f"asaas:conn-token:{nonce}", "1", nx=True, ex=ttl))
            except Exception:
                self._redis = None  # drop broken client; degrade for this process
        if nonce in self._used:
            return False
        self._used.add(nonce)
        return True
