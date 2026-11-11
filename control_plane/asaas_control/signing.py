from __future__ import annotations

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey


class JobSigner:
    def __init__(self, private_key: Ed25519PrivateKey, public_key: Ed25519PublicKey | None = None):
        self.private_key = private_key
        self.public_key = public_key or private_key.public_key()

    @classmethod
    def generate(cls) -> "JobSigner":
        return cls(Ed25519PrivateKey.generate())

    def sign(self, payload: bytes) -> bytes:
        return self.private_key.sign(payload)

    def verify(self, payload: bytes, signature: bytes) -> bool:
        try:
            self.public_key.verify(signature, payload)
            return True
        except Exception:
            return False
