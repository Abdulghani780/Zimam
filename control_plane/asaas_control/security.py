from __future__ import annotations

import hashlib
import secrets

from argon2 import PasswordHasher

_passwords = PasswordHasher()


def hash_password(value: str) -> str:
    return _passwords.hash(value)


def verify_password(stored: str, supplied: str) -> bool:
    try:
        return _passwords.verify(stored, supplied)
    except Exception:
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
