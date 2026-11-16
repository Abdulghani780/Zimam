"""Transitional credential verification for identities imported from the
legacy console database.

Legacy ``app_users`` store PBKDF2-HMAC-SHA256 (100k iterations, 32-byte salt)
as separate ``salt``/``password_hash`` hex columns. ``sync_legacy_identities``
packages them as ``"salt_hex:hash_hex"`` into ``User.legacy_password``; a
successful check here lets ``/auth/login`` upgrade the account to Argon2.
"""
from __future__ import annotations

import hashlib
import hmac

_PBKDF2_ITERATIONS = 100_000
_SALT_BYTES = 32


def verify_legacy_password(stored: str, supplied: str) -> bool:
    """Verify ``supplied`` against a ``salt_hex:hash_hex`` PBKDF2 credential."""
    try:
        salt_hex, expected_hex = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(expected_hex)
    except (ValueError, AttributeError):
        return False
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        supplied.encode("utf-8"),
        salt,
        _PBKDF2_ITERATIONS,
        dklen=len(expected) or _SALT_BYTES,
    )
    return hmac.compare_digest(derived, expected)
