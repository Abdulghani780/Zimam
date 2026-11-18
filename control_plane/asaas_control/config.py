from __future__ import annotations

import base64
import os
import secrets
import sys
from dataclasses import dataclass
from pathlib import Path


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, "1" if default else "0").lower() in {"1", "true", "yes", "on"}


def resolve_data_path(value: str) -> Path:
    """Anchor relative data paths to the install dir when frozen.

    Scheduled tasks/services run with an arbitrary CWD, so relative paths
    like ``data/...`` must not depend on it.
    """
    p = Path(value)
    if p.is_absolute():
        return p
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        # Installed/packaged layout is <root>/bin/<exe> with state in <root>/data;
        # a bare exe falls back to <exe dir>/data.
        root = exe_dir.parent if exe_dir.name.lower() == "bin" else exe_dir
        return root / p
    return p


def resolve_database_path() -> Path | None:
    """Absolute path of the SQLite control-plane DB, or None for non-sqlite URLs."""
    value = os.getenv("ASAAS_DATABASE_URL", "sqlite:///./data/control_plane.db")
    if not value.startswith("sqlite:///"):
        return None
    path = Path(value.removeprefix("sqlite:///"))
    if path.is_absolute():
        return path
    resolved = resolve_data_path(str(path))
    if not resolved.is_absolute():
        # Non-frozen dev runs: anchor to the repo root regardless of CWD.
        resolved = Path(__file__).resolve().parents[2] / resolved
    return resolved


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("ASAAS_DATABASE_URL", "sqlite:///./data/control_plane.db")
    session_ttl_seconds: int = int(os.getenv("ASAAS_SESSION_TTL", "28800"))
    connection_token_ttl_seconds: int = int(os.getenv("ASAAS_CONNECTION_TOKEN_TTL", "60"))
    bootstrap_token: str = os.getenv("ASAAS_BOOTSTRAP_TOKEN", "")
    gateway_token: str = os.getenv("ASAAS_GATEWAY_TOKEN", "")
    agent_enrollment_token: str = os.getenv("ASAAS_AGENT_ENROLLMENT_TOKEN", "")
    allowed_origins: tuple[str, ...] = tuple(x.strip() for x in os.getenv("ASAAS_ALLOWED_ORIGINS", "").split(",") if x.strip())
    secure_cookies: bool = _bool("ASAAS_SECURE_COOKIES", False)
    vault_key_file: Path = resolve_data_path(os.getenv("ASAAS_VAULT_KEY_FILE", "data/control-plane-vault.key"))

    def vault_key(self) -> bytes:
        raw = os.getenv("ASAAS_VAULT_KEY", "")
        if raw:
            try:
                key = base64.urlsafe_b64decode(raw.encode())
            except Exception as exc:
                raise RuntimeError("ASAAS_VAULT_KEY must be URL-safe base64") from exc
            if len(key) != 32:
                raise RuntimeError("ASAAS_VAULT_KEY must decode to 32 bytes")
            return key
        self.vault_key_file.parent.mkdir(parents=True, exist_ok=True)
        if self.vault_key_file.exists():
            key = self.vault_key_file.read_bytes()
            if len(key) != 32:
                raise RuntimeError(f"Invalid vault key file: {self.vault_key_file}")
            return key
        key = secrets.token_bytes(32)
        self.vault_key_file.write_bytes(key)
        try:
            self.vault_key_file.chmod(0o600)
        except OSError:
            pass
        return key


settings = Settings()
