from __future__ import annotations

import os
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat, PublicFormat


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

    def public_key_hex(self) -> str:
        return self.public_key.public_bytes(Encoding.Raw, PublicFormat.Raw).hex()


_KEY_FILE = Path(os.getenv("ASAAS_JOB_SIGNING_KEY_FILE", "data/agent-signing.key"))
_signer: JobSigner | None = None


def get_job_signer() -> JobSigner:
    """Process-wide Ed25519 signer for agent jobs.

    The 32-byte seed is persisted at ``ASAAS_JOB_SIGNING_KEY_FILE`` (or the
    ``ASAAS_JOB_SIGNING_KEY`` hex env var) so signatures survive restarts —
    agents pin the matching public key delivered at enrollment.
    """
    global _signer
    if _signer is not None:
        return _signer
    raw_hex = os.getenv("ASAAS_JOB_SIGNING_KEY", "")
    if raw_hex:
        seed = bytes.fromhex(raw_hex)
    else:
        _KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
        if _KEY_FILE.exists():
            seed = bytes.fromhex(_KEY_FILE.read_text().strip())
        else:
            seed = Ed25519PrivateKey.generate().private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
            _KEY_FILE.write_text(seed.hex())
            try:
                _KEY_FILE.chmod(0o600)
            except OSError:
                pass
    if len(seed) != 32:
        raise RuntimeError("Agent job signing key must be a 32-byte Ed25519 seed")
    _signer = JobSigner(Ed25519PrivateKey.from_private_bytes(seed))
    return _signer
