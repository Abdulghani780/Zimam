"""ASAAS Server Control v2 - Application Configuration & Environment Settings.

Centralized configuration adhering to Clean Architecture.
"""
from __future__ import annotations

import os
import secrets
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
BASE_DIR = PROJECT_ROOT
BACKEND_DIR = PROJECT_ROOT / 'backend'
APP_DIR = BACKEND_DIR / 'app'
DATA_DIR = PROJECT_ROOT / 'data'
FRONTEND_DIST_DIR = PROJECT_ROOT / 'frontend' / 'dist'
LEGACY_DIST_DIR = PROJECT_ROOT / 'dist'

# Ensure required directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_dotenv(path: Path) -> None:
    """Loads simple KEY=VALUE pairs without overriding real environment vars."""
    if not path.is_file():
        return
    try:
        for raw_line in path.read_text(encoding='utf-8').splitlines():
            line = raw_line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except Exception:
        pass


_load_dotenv(PROJECT_ROOT / '.env')

# Server network settings (0.0.0.0 enables dual-stack IPv4/IPv6 & LAN access)
SERVER_HOST: str = os.getenv('ASAAS_HOST', '0.0.0.0')
SERVER_PORT: int = int(os.getenv('ASAAS_PORT', '8765'))

# Security settings
TOKEN_FILE = DATA_DIR / '.session_token'

def get_or_create_session_token() -> str:
    """Retrieves existing token or generates a secure 32-byte hex token."""
    if TOKEN_FILE.is_file():
        try:
            token = TOKEN_FILE.read_text(encoding='utf-8').strip()
            if len(token) >= 32:
                return token
        except Exception:
            pass
    token = secrets.token_hex(32)
    try:
        TOKEN_FILE.write_text(token, encoding='utf-8')
    except Exception:
        pass
    return token

SESSION_TOKEN: str = get_or_create_session_token()
DB_PATH = DATA_DIR / 'asaas_v2.db'
