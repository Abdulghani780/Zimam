from __future__ import annotations

import base64
import json
import secrets
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


@dataclass(frozen=True)
class SealedSecret:
    nonce: bytes
    ciphertext: bytes
    aad: bytes

    def as_json(self) -> dict[str, str]:
        return {k: base64.urlsafe_b64encode(v).decode() for k, v in vars(self).items()}

    @classmethod
    def from_json(cls, value: dict[str, str]) -> "SealedSecret":
        return cls(*(base64.urlsafe_b64decode(value[k]) for k in ("nonce", "ciphertext", "aad")))


class EnvelopeVault:
    def __init__(self, key: bytes):
        if len(key) != 32:
            raise ValueError("EnvelopeVault requires a 32-byte AES-256 key")
        self._key = key

    @classmethod
    def generate(cls) -> "EnvelopeVault":
        return cls(secrets.token_bytes(32))

    def seal(self, plaintext: bytes, *, account_id: str) -> SealedSecret:
        aad = f"asaas/account/{account_id}".encode()
        nonce = secrets.token_bytes(12)
        return SealedSecret(nonce, AESGCM(self._key).encrypt(nonce, plaintext, aad), aad)

    def open(self, sealed: SealedSecret, *, account_id: str) -> bytes:
        aad = f"asaas/account/{account_id}".encode()
        if sealed.aad != aad:
            raise ValueError("Secret is bound to a different account")
        try:
            return AESGCM(self._key).decrypt(sealed.nonce, sealed.ciphertext, aad)
        except Exception as exc:
            raise ValueError("Unable to decrypt secret") from exc

    @staticmethod
    def dumps(sealed: SealedSecret) -> str:
        return json.dumps(sealed.as_json(), separators=(",", ":"))

    @staticmethod
    def loads(value: str) -> SealedSecret:
        return SealedSecret.from_json(json.loads(value))
