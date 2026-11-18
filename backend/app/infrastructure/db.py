"""ASAAS v2.5 - SQLite Database Persistence Layer.

Stores Bastion assets, port reservations, security audit events, multi-user accounts (RBAC),
active sessions with expiration, brute force protection, and historical telemetry metrics.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import secrets
import socket
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

from ..core.config import DB_PATH, DATA_DIR

logger = logging.getLogger('asaas.db')

# Session-scoped resource governor accounting.  A single server session can
# legitimately reclaim a few gigabytes, never hundreds of terabytes.
MAX_RECLAIMED_MB = 65_536.0

# Names that belonged to predictable demo fixtures.  Once the legacy-account
# policy is enabled they must never be created or silently reactivated again.
LEGACY_BANNED_USERNAMES = {
    'admin', 'administrator', 'operator', 'viewer', 'root', 'guest',
    'test', 'tester', 'demo', 'user', 'asaas', 'sysadmin',
}
DEMO_VAULT_IDS = ('vault-local-adm', 'vault-docker-reg', 'vault-sql-sa')


class ClosingConnection(sqlite3.Connection):
    """SQLite connection subclass that automatically closes itself upon exiting with-block."""
    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            super().__exit__(exc_type, exc_val, exc_tb)
        finally:
            self.close()


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, factory=ClosingConnection)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str, salt_hex: Optional[str] = None) -> Tuple[str, str]:
    """Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations and 32 bytes salt."""
    if not salt_hex:
        salt_bytes = secrets.token_bytes(32)
        salt_hex = salt_bytes.hex()
    else:
        salt_bytes = bytes.fromhex(salt_hex)

    derived = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt_bytes,
        100_000
    )
    return derived.hex(), salt_hex


def verify_password(password: str, salt_hex: str, expected_hash_hex: str) -> bool:
    """Constant-time verification of PBKDF2 password hash."""
    calc_hash, _ = hash_password(password, salt_hex)
    return secrets.compare_digest(calc_hash, expected_hash_hex)


def _hash_session_token(token: str) -> str:
    """Session tokens are stored hashed so a database leak cannot replay them."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def init_db() -> None:
    """Create the legacy compatibility schema without shipping credentials."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # 1. Bastion Managed Assets
            cur.execute("""
                CREATE TABLE IF NOT EXISTS bastion_assets (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    host TEXT NOT NULL,
                    type TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    protocol TEXT NOT NULL,
                    status TEXT NOT NULL,
                    latency_ms REAL NOT NULL,
                    category TEXT NOT NULL,
                    is_local INTEGER NOT NULL,
                    tags TEXT NOT NULL
                )
            """)

            # 2. Port Reservations
            cur.execute("""
                CREATE TABLE IF NOT EXISTS port_reservations (
                    port INTEGER PRIMARY KEY,
                    username TEXT NOT NULL,
                    description TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)

            # 3. Security Audit Events
            cur.execute("""
                CREATE TABLE IF NOT EXISTS security_audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    ip TEXT NOT NULL,
                    details TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)

            # 4. Multi-User RBAC: Application Accounts
            cur.execute("""
                CREATE TABLE IF NOT EXISTS app_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    role TEXT NOT NULL, -- 'admin', 'operator', 'viewer'
                    full_name TEXT NOT NULL,
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL,
                    last_login TEXT
                )
            """)

            # 5. Multi-User RBAC: Active Authenticated Sessions
            cur.execute("""
                CREATE TABLE IF NOT EXISTS app_sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    role TEXT NOT NULL,
                    ip TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
                )
            """)

            # 6. Login Attempts for Brute Force Detection
            cur.execute("""
                CREATE TABLE IF NOT EXISTS login_attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    ip TEXT NOT NULL,
                    success INTEGER NOT NULL,
                    attempted_at TEXT NOT NULL
                )
            """)

            # 7. Historical Telemetry Metrics (24h / 7d charts)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS historical_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    cpu REAL NOT NULL,
                    ram REAL NOT NULL,
                    ram_used_gb REAL NOT NULL,
                    disk_used_gb REAL NOT NULL,
                    active_sessions INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)


            # 8. JIT Elevation Grants (Zero-Trust Just-In-Time PAM)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS jit_grants (
                    id TEXT PRIMARY KEY,
                    user TEXT NOT NULL,
                    role TEXT NOT NULL,
                    target_role TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    duration_mins INTEGER NOT NULL,
                    remaining_sec INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    approver TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL
                )
            """)

            
            # 9. User Desktop Notifications & Broadcasts
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    target_user TEXT NOT NULL,
                    session_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    sender TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'DELIVERED',
                    is_read INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                )
            """)
            # 10. Resource Governor Real SQLite Configuration Settings
            cur.execute("""
                CREATE TABLE IF NOT EXISTS governor_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            # 11. Managed Servers
            cur.execute("""
                CREATE TABLE IF NOT EXISTS servers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    ip TEXT NOT NULL,
                    os TEXT NOT NULL,
                    domain TEXT NOT NULL DEFAULT 'WORKGROUP',
                    status TEXT NOT NULL DEFAULT 'online',
                    roles_count INTEGER NOT NULL DEFAULT 0,
                    cpu REAL NOT NULL DEFAULT 0.0,
                    ram REAL NOT NULL DEFAULT 0.0,
                    storage REAL NOT NULL DEFAULT 0.0,
                    alerts_count INTEGER NOT NULL DEFAULT 0,
                    is_local INTEGER NOT NULL DEFAULT 0,
                    latency_ms REAL NOT NULL DEFAULT 0.0,
                    last_seen TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)

            # Existing databases predate the latency column; add it in place.
            cur.execute("PRAGMA table_info(servers)")
            server_columns = {row['name'] for row in cur.fetchall()}
            if 'latency_ms' not in server_columns:
                cur.execute("ALTER TABLE servers ADD COLUMN latency_ms REAL NOT NULL DEFAULT 0.0")

            # Remove duplicated inventory rows (same name + IP) left behind by
            # earlier preview builds.  Keep the oldest record so references and
            # group membership remain stable.
            cur.execute("""
                DELETE FROM servers
                WHERE is_local = 0 AND rowid NOT IN (
                    SELECT MIN(rowid) FROM servers
                    WHERE is_local = 0
                    GROUP BY name, ip
                )
            """)

            # 12. Server Groups
            cur.execute("""
                CREATE TABLE IF NOT EXISTS server_groups (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    server_ids TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)

            # 13. Developer Workspaces & Projects
            cur.execute("""
                CREATE TABLE IF NOT EXISTS developer_projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    owner TEXT NOT NULL,
                    runtime TEXT NOT NULL,
                    source_path TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'stopped',
                    env_vars TEXT NOT NULL DEFAULT '{}',
                    published_route TEXT NOT NULL DEFAULT '',
                    pid INTEGER,
                    created_at TEXT NOT NULL,
                    last_started TEXT
                )
            """)

            # 14. Docker Workspaces
            cur.execute("""
                CREATE TABLE IF NOT EXISTS docker_workspaces (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    context_name TEXT NOT NULL,
                    runtime_type TEXT NOT NULL DEFAULT 'linux-vm',
                    memory_limit_mb INTEGER NOT NULL DEFAULT 2048,
                    cpu_limit REAL NOT NULL DEFAULT 2.0,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL
                )
            """)

            # 15. Resource Quotas
            cur.execute("""
                CREATE TABLE IF NOT EXISTS resource_quotas (
                    id TEXT PRIMARY KEY,
                    scope_type TEXT NOT NULL,
                    scope_id TEXT NOT NULL,
                    cpu_limit REAL NOT NULL DEFAULT 4.0,
                    ram_limit_mb INTEGER NOT NULL DEFAULT 4096,
                    disk_limit_gb REAL NOT NULL DEFAULT 50.0,
                    max_containers INTEGER NOT NULL DEFAULT 5,
                    max_projects INTEGER NOT NULL DEFAULT 5,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            # 16. Action Jobs Engine Records
            cur.execute("""
                CREATE TABLE IF NOT EXISTS action_jobs (
                    id TEXT PRIMARY KEY,
                    action TEXT NOT NULL,
                    target_server TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    risk_level TEXT NOT NULL,
                    status TEXT NOT NULL,
                    input_params TEXT NOT NULL,
                    result TEXT NOT NULL,
                    error TEXT,
                    started_at TEXT NOT NULL,
                    completed_at TEXT
                )
            """)

            # 17. Conflict Events
            cur.execute("""
                CREATE TABLE IF NOT EXISTS conflict_events (
                    id TEXT PRIMARY KEY,
                    conflict_type TEXT NOT NULL,
                    resource TEXT NOT NULL,
                    conflicting_entities TEXT NOT NULL,
                    resolution_status TEXT NOT NULL,
                    resolution_action TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    resolved_at TEXT
                )
            """)

            # 18. Encrypted Credential Vault (AES-256-GCM)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS vault_credentials (
                    id TEXT PRIMARY KEY,
                    asset_id TEXT NOT NULL,
                    asset_name TEXT NOT NULL,
                    username TEXT NOT NULL,
                    protocol TEXT NOT NULL,
                    secret_ciphertext TEXT NOT NULL,
                    nonce TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata TEXT
                )
            """)

            # Ensure Local Server is registered in `servers`
            hostname = socket.gethostname()
            now_iso = datetime.now(timezone.utc).isoformat()
            cur.execute("SELECT id FROM servers WHERE is_local = 1")
            if cur.fetchone() is None:
                cur.execute("""
                    INSERT INTO servers (id, name, ip, os, domain, status, roles_count, cpu, ram, storage, alerts_count, is_local, last_seen, created_at)
                    VALUES ('srv-local', ?, '127.0.0.1', 'Windows Server 2025 Standard', 'WORKGROUP', 'online', 8, 12.5, 45.0, 32.0, 0, 1, ?, ?)
                """, (f"{hostname} (Local)", now_iso, now_iso))

            # Default groups if none exist
            cur.execute("SELECT COUNT(*) AS count FROM server_groups")
            if cur.fetchone()['count'] == 0:
                cur.execute("""
                    INSERT INTO server_groups (id, name, description, server_ids, created_at)
                    VALUES
                        ('grp-prod', 'Production Servers', 'خوادم الإنتاج والتشغيل الحي', '["srv-local"]', ?),
                        ('grp-dev', 'Development Workspaces', 'خوادم بيئات المطورين والتجارب', '[]', ?),
                        ('grp-rds', 'Remote Desktop Farm', 'خوادم جلسات سطح المكتب البعيد RDS', '["srv-local"]', ?)
                """, (now_iso, now_iso, now_iso))

            # Seed encrypted demo credentials only for explicitly requested
            # demo/screenshot environments.  A clean production appliance
            # starts with an empty vault.
            cur.execute("SELECT COUNT(*) AS count FROM vault_credentials")
            seed_demo = os.getenv('ASAAS_SEED_DEMO_DATA', '0').lower() in {'1', 'true', 'yes'}
            if seed_demo and cur.fetchone()['count'] == 0:
                try:
                    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
                    v_key = _get_vault_master_key()
                    v_aes = AESGCM(v_key)
                    defaults = [
                        ('vault-local-adm', 'srv-local', f'{hostname} (Local)', 'Administrator', 'RDP', 'Admin@Sovereign2026!'),
                        ('vault-docker-reg', 'srv-local', 'Local Docker Daemon', 'docker-local', 'DOCKER', 'dckr_pat_prod9820'),
                        ('vault-sql-sa', 'srv-local', 'Postgres / SQL Engine', 'postgres', 'DATABASE', 'pg_secret_cluster_2026')
                    ]
                    for vid, asid, asnm, un, pr, sec in defaults:
                        v_nonce = os.urandom(12)
                        v_ct = v_aes.encrypt(v_nonce, sec.encode('utf-8'), None)
                        cur.execute("""
                            INSERT INTO vault_credentials (id, asset_id, asset_name, username, protocol, secret_ciphertext, nonce, created_at, updated_at, metadata)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            vid, asid, asnm, un, pr,
                            base64.b64encode(v_ct).decode('ascii'),
                            base64.b64encode(v_nonce).decode('ascii'),
                            now_iso, now_iso, json.dumps({'managed': True}, ensure_ascii=False)
                        ))
                except Exception as v_err:
                    logger.warning("Failed to seed default vault credentials: %s", v_err)

            # One-time security migration.  Earlier preview builds generated
            # predictable accounts.  They are disabled and all their sessions
            # revoked; an administrator must explicitly bootstrap a new secret.
            cur.execute("""
                CREATE TABLE IF NOT EXISTS system_metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            cur.execute("SELECT value FROM system_metadata WHERE key = ?", ('legacy_accounts_disabled',))
            legacy_row = cur.fetchone()
            if legacy_row is None:
                cur.execute(
                    "INSERT INTO system_metadata (key, value, updated_at) VALUES (?, ?, ?)",
                    ('legacy_accounts_disabled', 'true', datetime.now(timezone.utc).isoformat()),
                )
                legacy_row = {'value': 'true'}
            legacy_disabled = str(legacy_row['value']).strip().lower() in {'1', 'true', 'yes', 'on'}
            if legacy_disabled:
                # Enforce the policy on every boot: predictable demo/legacy
                # accounts stay disabled even if an older build re-enabled
                # them.  The canonical working administrator is intentionally
                # preserved so the appliance never locks its operator out.
                banned = tuple(sorted(LEGACY_BANNED_USERNAMES))
                placeholders = ','.join('?' for _ in banned)
                cur.execute(
                    f"UPDATE app_users SET is_active = 0 "
                    f"WHERE lower(username) IN ({placeholders}) AND lower(username) <> 'admin'",
                    banned,
                )
                cur.execute(
                    f"DELETE FROM app_sessions "
                    f"WHERE lower(username) IN ({placeholders}) AND lower(username) <> 'admin'",
                    banned,
                )

            # Demo fixtures are opt-in for local screenshots only. A clean
            # appliance starts with zero assets and requires explicit enrollment.
            cur.execute("SELECT COUNT(*) AS count FROM bastion_assets")
            if os.getenv('ASAAS_SEED_DEMO_DATA', '0').lower() in {'1', 'true', 'yes'} and cur.fetchone()['count'] == 0:
                hostname = socket.gethostname()
                default_assets = [
                    (
                        'asset-local',
                        f'{hostname} (هذا السيرفر)',
                        '127.0.0.1',
                        'Windows Server 2025 Core',
                        3389,
                        'RDP',
                        'online',
                        0.2,
                        'Windows Host',
                        1,
                        json.dumps(['local', 'primary', 'rdp']),
                    ),
                    (
                        'asset-sql',
                        'SQL Database Cluster',
                        '127.0.0.1',
                        'SQL Server Enterprise',
                        1433,
                        'database',
                        'online',
                        0.5,
                        'Database',
                        0,
                        json.dumps(['sql', 'database']),
                    ),
                    (
                        'asset-gw',
                        'Ubuntu Web Gateway',
                        '127.0.0.1',
                        'Ubuntu 24.04 LTS',
                        22,
                        'SSH',
                        'online',
                        0.8,
                        'Linux Gateway',
                        0,
                        json.dumps(['ssh', 'gateway', 'linux']),
                    ),
                    (
                        'asset-dc',
                        'Windows Server DC / WinRM Node',
                        '10.0.0.5',
                        'Windows Server 2022 Datacenter',
                        5985,
                        'WinRM',
                        'online',
                        1.2,
                        'Domain Controller',
                        0,
                        json.dumps(['winrm', 'dc', 'windows']),
                    )
                ]
                cur.executemany("""
                    INSERT INTO bastion_assets
                    (id, name, host, type, port, protocol, status, latency_ms, category, is_local, tags)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, default_assets)

            # Seed initial audit log if empty
            cur.execute("SELECT COUNT(*) AS count FROM security_audit_events")
            if os.getenv('ASAAS_SEED_DEMO_DATA', '0').lower() in {'1', 'true', 'yes'} and cur.fetchone()['count'] == 0:
                cur.execute("""
                    INSERT INTO security_audit_events (event_type, ip, details, severity, created_at)
                    VALUES (?, ?, ?, ?, datetime('now'))
                """, ('SYSTEM_STARTUP', '127.0.0.1', 'ASAAS v2.5 started with clean database persistence.', 'INFO'))

            # Governor accounting is session-scoped.  Clamp obviously corrupt
            # accumulated values produced by older builds.
            cur.execute(
                "UPDATE governor_settings SET value = '0.0' "
                "WHERE key = 'reclaimed_mb' AND CAST(value AS REAL) > ?",
                (MAX_RECLAIMED_MB,),
            )

            # Remove the three well-known demo Vault records from production
            # databases.  They are only ever valid in explicit demo mode.
            if not seed_demo:
                vault_placeholders = ','.join('?' for _ in DEMO_VAULT_IDS)
                cur.execute(
                    f"DELETE FROM vault_credentials WHERE id IN ({vault_placeholders})",
                    DEMO_VAULT_IDS,
                )

            conn.commit()
            logger.info("Database initialized successfully at %s", DB_PATH)
    except Exception as exc:
        logger.error("Failed to initialize database: %s", exc)


# ==============================================================================
# RBAC: Authentication & Session Management
# ==============================================================================

def db_is_ip_rate_limited(ip: str, max_attempts: int = 5, window_seconds: int = 600) -> bool:
    """Checks if IP has exceeded maximum failed login attempts within window."""
    # Loopback addresses are exempt from lockouts to prevent locking out local admin console & test runners
    if ip in ('127.0.0.1', '::1', 'localhost', 'testclient'):
        return False
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(seconds=window_seconds)).isoformat()
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT COUNT(*) as failed_count
                FROM login_attempts
                WHERE ip = ? AND success = 0 AND attempted_at > COALESCE(
                    (SELECT MAX(attempted_at) FROM login_attempts WHERE ip = ? AND success = 1),
                    ?
                )
            """, (ip, ip, cutoff))
            row = cur.fetchone()
            return row['failed_count'] >= max_attempts if row else False
    except Exception:
        return False


def db_record_login_attempt(username: str, ip: str, success: bool) -> None:
    try:
        now_str = datetime.now(timezone.utc).isoformat()
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO login_attempts (username, ip, success, attempted_at)
                VALUES (?, ?, ?, ?)
            """, (username, ip, 1 if success else 0, now_str))
            conn.commit()
    except Exception as exc:
        logger.error("Failed to record login attempt: %s", exc)


def db_authenticate_user(username: str, password: str, ip: str) -> Optional[Dict[str, Any]]:
    """Authenticates username & password against app_users table with salt & PBKDF2."""
    if db_is_ip_rate_limited(ip):
        db_add_security_event('BRUTE_FORCE_BLOCKED', ip, f'تم حظر محاولة دخول من {ip} لتجاوز حد المحاولات', 'CRITICAL')
        return None

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT id, username, password_hash, salt, role, full_name, is_active
                FROM app_users
                WHERE username = ? COLLATE NOCASE
            """, (username.strip(),))
            user = cur.fetchone()

            if not user or not user['is_active']:
                db_record_login_attempt(username, ip, False)
                db_add_security_event('LOGIN_FAILED', ip, f'محاولة دخول فاشلة للحساب: {username}', 'WARNING')
                return None

            if not verify_password(password, user['salt'], user['password_hash']):
                db_record_login_attempt(username, ip, False)
                db_add_security_event('LOGIN_FAILED', ip, f'كلمة مرور خاطئة للحساب: {username}', 'WARNING')
                return None

            # Success
            now_str = datetime.now(timezone.utc).isoformat()
            cur.execute("UPDATE app_users SET last_login = ? WHERE id = ?", (now_str, user['id']))
            conn.commit()

            db_record_login_attempt(username, ip, True)
            db_add_security_event('LOGIN_SUCCESS', ip, f'تسجيل دخول ناجح للمستخدم {username} بصلاحية {user["role"]}', 'INFO')

            return {
                'id': user['id'],
                'username': user['username'],
                'role': user['role'],
                'full_name': user['full_name'],
            }
    except Exception as exc:
        logger.error("Authentication error: %s", exc)
        return None


def db_create_session(user_id: int, username: str, role: str, ip: str, ttl_seconds: int = 86400) -> str:
    """Generates and persists a cryptographically secure session token."""
    token = secrets.token_hex(32)
    now = datetime.now(timezone.utc)
    now_str = now.isoformat()
    expires_str = (now + timedelta(seconds=ttl_seconds)).isoformat()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO app_sessions (token, user_id, username, role, ip, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (_hash_session_token(token), user_id, username, role, ip, expires_str, now_str))
        conn.commit()

    return token


def db_validate_session(token: str) -> Optional[Dict[str, Any]]:
    """Validates session token and returns session dict if not expired."""
    if not token or len(token) < 16:
        return None

    try:
        now_str = datetime.now(timezone.utc).isoformat()
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT s.token, s.user_id, s.username, s.role, s.ip, s.expires_at, u.full_name
                FROM app_sessions s
                JOIN app_users u ON s.user_id = u.id
                WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1
            """, (_hash_session_token(token), now_str))
            row = cur.fetchone()
            if row:
                return dict(row)
    except Exception as exc:
        logger.error("Session validation error: %s", exc)
    return None


def db_sync_proxied_user(username: str, role: str, full_name: str = '') -> Optional[Dict[str, Any]]:
    """Upsert the local app_users projection for a control-plane identity.

    The control plane is the identity authority; app_users becomes a local
    profile projection so legacy features (JIT grants, notifications,
    last_login) keep working. Missing rows are created with an unusable
    random password — credentials only ever live in the control plane.
    """
    username = (username or '').strip()
    if not username:
        return None
    role = role if role in ('admin', 'operator', 'viewer') else 'viewer'
    now_str = datetime.now(timezone.utc).isoformat()
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, username, role, full_name, is_active, created_at, last_login FROM app_users WHERE username = ? COLLATE NOCASE",
                (username,),
            )
            row = cur.fetchone()
            if row:
                cur.execute(
                    "UPDATE app_users SET role = ?, is_active = 1 WHERE id = ?",
                    (role, row['id']),
                )
                conn.commit()
                data = dict(row)
                data['role'] = role
                data['is_active'] = 1
                return data
            pw_hash, salt = hash_password(secrets.token_urlsafe(32))
            cur.execute(
                """
                INSERT INTO app_users (username, password_hash, salt, role, full_name, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, 1, ?)
                """,
                (username, pw_hash, salt, role, full_name or username, now_str),
            )
            conn.commit()
            return {
                'id': cur.lastrowid,
                'username': username,
                'role': role,
                'full_name': full_name or username,
                'is_active': 1,
                'created_at': now_str,
                'last_login': None,
            }
    except Exception as exc:
        logger.error("Proxied user sync failed for '%s': %s", username, exc)
        return None


def db_revoke_session(token: str) -> bool:
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM app_sessions WHERE token = ?", (_hash_session_token(token),))
            conn.commit()
            return cur.rowcount > 0
    except Exception:
        return False


def db_list_app_users() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, username, role, full_name, is_active, created_at, last_login
            FROM app_users
            ORDER BY id ASC
        """)
        return [dict(r) for r in cur.fetchall()]


def db_get_app_user(username: str) -> Optional[Dict[str, Any]]:
    """Returns the complete public profile for a single application user."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT id, username, role, full_name, is_active, created_at, last_login
                FROM app_users
                WHERE username = ? COLLATE NOCASE
            """, (username.strip(),))
            row = cur.fetchone()
            return dict(row) if row else None
    except Exception as exc:
        logger.error("Failed to read app user '%s': %s", username, exc)
        return None


def _legacy_accounts_disabled() -> bool:
    value = db_get_system_metadata('legacy_accounts_disabled', 'true') or 'true'
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def _reject_legacy_username(username: str) -> Optional[str]:
    """Returns an error message when a banned legacy name is requested."""
    normalized = username.strip().lower()
    if _legacy_accounts_disabled() and normalized in LEGACY_BANNED_USERNAMES:
        return (
            f'اسم المستخدم "{username}" محظور بموجب سياسة تعطيل الحسابات القديمة. '
            'اختر اسماً تشغيلياً فريداً.'
        )
    return None


def db_create_app_user(username: str, password: str, role: str, full_name: str) -> Dict[str, Any]:
    valid_roles = {'admin', 'operator', 'viewer'}
    username = username.strip()
    if role not in valid_roles:
        return {'ok': False, 'error': f'الدور غير صالح. الأدوار المتاحة: {", ".join(valid_roles)}'}
    if len(username) < 3:
        return {'ok': False, 'error': 'اسم المستخدم يجب ألا يقل عن 3 أحرف.'}
    if len(password) < 12:
        return {'ok': False, 'error': 'كلمة المرور يجب ألا تقل عن 12 خانة.'}
    legacy_error = _reject_legacy_username(username)
    if legacy_error:
        return {'ok': False, 'error': legacy_error}

    pwd_hash, salt = hash_password(password)
    now_str = datetime.now(timezone.utc).isoformat()

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM app_users WHERE username = ? COLLATE NOCASE", (username,))
            if cur.fetchone() is not None:
                return {'ok': False, 'error': f'اسم المستخدم "{username}" مسجل بالفعل مسبقاً.'}
            cur.execute("""
                INSERT INTO app_users (username, password_hash, salt, role, full_name, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, 1, ?)
            """, (username, pwd_hash, salt, role, full_name.strip() or username, now_str))
            conn.commit()
            return {'ok': True, 'id': cur.lastrowid, 'username': username, 'role': role}
    except sqlite3.IntegrityError:
        return {'ok': False, 'error': f'اسم المستخدم "{username}" مسجل بالفعل مسبقاً.'}
    except Exception as exc:
        return {'ok': False, 'error': str(exc)}


def db_delete_app_user(username: str) -> Dict[str, Any]:
    if username.lower() == 'admin':
        return {'ok': False, 'error': 'لا يمكن حذف الحساب الجذري الافتراضي (admin).'}

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM app_users WHERE username = ? COLLATE NOCASE", (username,))
            conn.commit()
            if cur.rowcount > 0:
                return {'ok': True, 'message': f'تم حذف المستخدم {username} بنجاح.'}
            return {'ok': False, 'error': 'المستخدم غير موجود.'}
    except Exception as exc:
        return {'ok': False, 'error': str(exc)}


def db_update_app_user_role(username: str, new_role: str) -> Dict[str, Any]:
    valid_roles = {'admin', 'operator', 'viewer'}
    if new_role not in valid_roles:
        return {'ok': False, 'error': 'الدور المحدد غير صالح.'}
    if username.lower() == 'admin' and new_role != 'admin':
        return {'ok': False, 'error': 'لا يمكن تخفيض صلاحيات الحساب الرئيسي admin.'}

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("UPDATE app_users SET role = ? WHERE username = ? COLLATE NOCASE", (new_role, username))
            cur.execute("UPDATE app_sessions SET role = ? WHERE username = ? COLLATE NOCASE", (new_role, username))
            conn.commit()
            return {'ok': True, 'username': username, 'role': new_role}
    except Exception as exc:
        return {'ok': False, 'error': str(exc)}


def db_change_user_password(username: str, new_password: str) -> Dict[str, Any]:
    if len(new_password) < 12:
        return {'ok': False, 'error': 'كلمة المرور يجب ألا تقل عن 12 حرفاً.'}

    pwd_hash, salt = hash_password(new_password)
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE app_users SET password_hash = ?, salt = ? WHERE username = ? COLLATE NOCASE
            """, (pwd_hash, salt, username))
            conn.commit()
            return {'ok': True, 'message': 'تم تغيير كلمة المرور بنجاح.'}
    except Exception as exc:
        return {'ok': False, 'error': str(exc)}


def db_bootstrap_admin(username: str, password: str, full_name: str) -> Dict[str, Any]:
    """Create or reactivate the sole explicit break-glass administrator."""
    username = username.strip()
    if len(username) < 3:
        return {'ok': False, 'error': 'اسم المستخدم يجب ألا يقل عن 3 أحرف.'}
    if len(password) < 16:
        return {'ok': False, 'error': 'كلمة مرور الطوارئ يجب ألا تقل عن 16 حرفاً.'}
    legacy_error = _reject_legacy_username(username)
    if legacy_error:
        return {'ok': False, 'error': legacy_error}

    pwd_hash, salt = hash_password(password)
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app_users WHERE username = ? COLLATE NOCASE", (username,))
        row = cur.fetchone()
        if row:
            cur.execute("""
                UPDATE app_users
                SET password_hash = ?, salt = ?, role = 'admin', full_name = ?, is_active = 1
                WHERE id = ?
            """, (pwd_hash, salt, full_name.strip() or username, row['id']))
            user_id = row['id']
        else:
            cur.execute("""
                INSERT INTO app_users
                    (username, password_hash, salt, role, full_name, is_active, created_at)
                VALUES (?, ?, ?, 'admin', ?, 1, ?)
            """, (username, pwd_hash, salt, full_name.strip() or username, now_str))
            user_id = cur.lastrowid
        cur.execute("DELETE FROM app_sessions WHERE user_id = ?", (user_id,))
        conn.commit()
    return {'ok': True, 'id': user_id, 'username': username, 'role': 'admin'}


# ==============================================================================
# Historical Telemetry Metrics (Story 5)
# ==============================================================================

def db_record_metric(cpu: float, ram: float, ram_used_gb: float, disk_used_gb: float, active_sessions: int) -> None:
    """Inserts a historical metrics snapshot."""
    try:
        now_str = datetime.now(timezone.utc).isoformat()
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO historical_metrics (timestamp, cpu, ram, ram_used_gb, disk_used_gb, active_sessions, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            """, (now_str, round(cpu, 1), round(ram, 1), round(ram_used_gb, 1), round(disk_used_gb, 1), active_sessions))
            conn.commit()
    except Exception as exc:
        logger.error("Failed to record metric: %s", exc)


def db_get_historical_metrics(range_str: str = '24h') -> List[Dict[str, Any]]:
    """Retrieves aggregated historical metrics for 24 hours or 7 days."""
    try:
        hours = 24 if range_str == '24h' else 168  # 7 days = 168 hours
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT timestamp, cpu, ram, ram_used_gb, disk_used_gb, active_sessions
                FROM historical_metrics
                WHERE timestamp > ?
                ORDER BY id ASC
            """, (cutoff,))
            rows = [dict(r) for r in cur.fetchall()]
            
            # If records exceed 120 points, sample evenly to avoid heavy frontend graphs
            if len(rows) > 120:
                step = len(rows) // 100
                rows = rows[::step]
            return rows
    except Exception as exc:
        logger.error("Failed to fetch historical metrics: %s", exc)
        return []


def db_cleanup_old_metrics(days: int = 7) -> int:
    """Deletes historical metrics older than retention period (default 7 days)."""
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM historical_metrics WHERE timestamp < ?", (cutoff,))
            conn.commit()
            return cur.rowcount
    except Exception as exc:
        logger.error("Metrics cleanup failed: %s", exc)
        return 0


# ==============================================================================
# Bastion Assets & Port Claims Persistence
# ==============================================================================

def db_list_assets() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM bastion_assets ORDER BY is_local DESC, name ASC")
        rows = cur.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d['is_local'] = bool(d['is_local'])
            try:
                d['tags'] = json.loads(d['tags'])
            except Exception:
                d['tags'] = []
            result.append(d)
        return result


def db_add_asset(asset: Dict[str, Any]) -> None:
    tags = asset.get('tags', [])
    if isinstance(tags, list):
        tags_str = json.dumps(tags)
    else:
        tags_str = json.dumps([str(tags)])

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO bastion_assets
            (id, name, host, type, port, protocol, status, latency_ms, category, is_local, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            asset.get('id', f"asset-{int(time.time())}"),
            asset.get('name', 'New Asset'),
            asset.get('host', '127.0.0.1'),
            asset.get('type', 'Server'),
            int(asset.get('port', 22)),
            asset.get('protocol', 'SSH'),
            asset.get('status', 'online'),
            float(asset.get('latency_ms', 1.0)),
            asset.get('category', 'Custom'),
            1 if asset.get('is_local') else 0,
            tags_str,
        ))
        conn.commit()


def db_remove_asset(asset_id: str) -> bool:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM bastion_assets WHERE id = ?", (asset_id,))
        conn.commit()
        return cur.rowcount > 0


def db_list_reservations() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM port_reservations ORDER BY port ASC")
        return [dict(r) for r in cur.fetchall()]


def db_set_reservation(port: int, username: str, description: str = '') -> None:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO port_reservations (port, username, description, created_at)
            VALUES (?, ?, ?, datetime('now'))
        """, (port, username, description))
        conn.commit()


def db_remove_reservation(port: int) -> bool:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM port_reservations WHERE port = ?", (port,))
        conn.commit()
        return cur.rowcount > 0


def db_add_security_event(event_type: str, ip: str, details: str, severity: str = 'INFO') -> None:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO security_audit_events (event_type, ip, details, severity, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        """, (event_type, ip, details, severity))
        conn.commit()


def db_list_security_events(limit: int = 50) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM security_audit_events ORDER BY id DESC LIMIT ?", (limit,))
        return [dict(r) for r in cur.fetchall()]


# ==============================================================================
# JIT Elevation (Just-In-Time Zero Trust Access)
# ==============================================================================

def db_list_jit_grants() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM jit_grants ORDER BY created_at DESC")
        rows = cur.fetchall()
        now_dt = datetime.now(timezone.utc)
        grants = []
        for r in rows:
            d = dict(r)
            try:
                exp_dt = datetime.fromisoformat(d['expires_at'])
                rem = int((exp_dt - now_dt).total_seconds())
                d['remaining_sec'] = max(0, rem)
                if rem <= 0 and d['status'] == 'ACTIVE':
                    d['status'] = 'EXPIRED'
            except Exception:
                d['remaining_sec'] = 0
            grants.append(d)
        return grants


def db_create_jit_grant(
    user: str,
    target_role: str,
    reason: str,
    duration_mins: int = 30,
    approver: str = 'Policy Engine',
    status: str = 'ACTIVE',
) -> Dict[str, Any]:
    grant_id = f"jit-{int(time.time())}-{secrets.token_hex(2)}"
    now_dt = datetime.now(timezone.utc)
    status = status.upper()
    if status not in {'ACTIVE', 'PENDING'}:
        status = 'PENDING'
    exp_dt = now_dt + timedelta(minutes=duration_mins)
    now_str = now_dt.isoformat()
    exp_str = exp_dt.isoformat()
    remaining_sec = duration_mins * 60 if status == 'ACTIVE' else 0

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO jit_grants (id, user, role, target_role, reason, duration_mins, remaining_sec, status, approver, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (grant_id, user, target_role, target_role, reason, duration_mins, remaining_sec, status, approver, now_str, exp_str))
        conn.commit()

    if status == 'ACTIVE':
        db_add_security_event(
            'JIT_ELEVATION_GRANTED', '127.0.0.1',
            f'منح صلاحية مؤقتة {target_role} للمستخدم {user} لمدة {duration_mins} دقيقة بواسطة {approver}',
            'WARNING',
        )
        message = f'تم تفعيل الصلاحية المؤقتة ({target_role}) للمستخدم {user} بنجاح.'
    else:
        db_add_security_event(
            'JIT_ELEVATION_REQUESTED', '127.0.0.1',
            f'طلب ترقية مؤقتة {target_role} من المستخدم {user} لمدة {duration_mins} دقيقة بانتظار موافقة مدير النظام',
            'INFO',
        )
        message = (
            f'تم تسجيل طلب الترقية المؤقتة ({target_role}) للمستخدم {user}. '
            'الطلب بانتظار موافقة مدير النظام (Admin).'
        )

    return {
        'ok': True,
        'id': grant_id,
        'user': user,
        'role': target_role,
        'reason': reason,
        'duration_mins': duration_mins,
        'remaining_sec': remaining_sec,
        'status': status,
        'approver': approver,
        'created_at': now_str,
        'expires_at': exp_str,
        'message': message,
    }


def db_approve_jit_grant(grant_id: str, approver: str, approve: bool = True) -> Dict[str, Any]:
    """Admin decision for a pending JIT request; approval starts the clock."""
    now_dt = datetime.now(timezone.utc)
    now_str = now_dt.isoformat()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT user, target_role, duration_mins, status FROM jit_grants WHERE id = ?", (grant_id,))
        row = cur.fetchone()
        if not row:
            return {'ok': False, 'error': 'لم يتم العثور على طلب الصلاحية المحدد.'}
        if row['status'] != 'PENDING':
            return {'ok': False, 'error': f'لا يمكن اعتماد طلب بحالة {row["status"]}؛ الطلبات المعلقة فقط قابلة للموافقة أو الرفض.'}

        uname = row['user']
        target_role = row['target_role']
        duration_mins = int(row['duration_mins'] or 30)
        if approve:
            expires_str = (now_dt + timedelta(minutes=duration_mins)).isoformat()
            cur.execute("""
                UPDATE jit_grants
                SET status = 'ACTIVE', approver = ?, expires_at = ?, remaining_sec = ?
                WHERE id = ?
            """, (approver, expires_str, duration_mins * 60, grant_id))
        else:
            cur.execute("""
                UPDATE jit_grants
                SET status = 'REJECTED', approver = ?, remaining_sec = 0
                WHERE id = ?
            """, (approver, grant_id))
        conn.commit()

        decision = 'APPROVED' if approve else 'REJECTED'
        db_add_security_event(
            'JIT_ELEVATION_APPROVED' if approve else 'JIT_ELEVATION_REJECTED',
            '127.0.0.1',
            f'{decision} طلب الصلاحية المؤقتة {grant_id} ({target_role}) للمستخدم {uname} بواسطة {approver}',
            'WARNING' if approve else 'INFO',
        )

        if approve:
            return {
                'ok': True,
                'id': grant_id,
                'user': uname,
                'role': target_role,
                'status': 'ACTIVE',
                'approver': approver,
                'remaining_sec': duration_mins * 60,
                'message': f'تم اعتماد طلب الترقية المؤقتة ({target_role}) للمستخدم {uname} بنجاح.',
            }
        return {
            'ok': True,
            'id': grant_id,
            'user': uname,
            'role': target_role,
            'status': 'REJECTED',
            'approver': approver,
            'remaining_sec': 0,
            'message': f'تم رفض طلب الترقية المؤقتة للمستخدم {uname}.',
        }


def db_revoke_jit_grant(grant_id: str, revoked_by: str = 'Admin') -> Dict[str, Any]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT user, target_role FROM jit_grants WHERE id = ?", (grant_id,))
        row = cur.fetchone()
        if not row:
            return {'ok': False, 'error': 'لم يتم العثور على ترخيص الصلاحية المحدد.'}
        uname = row['user']
        cur.execute("UPDATE jit_grants SET status = 'REVOKED', remaining_sec = 0 WHERE id = ?", (grant_id,))
        conn.commit()

    db_add_security_event('JIT_ELEVATION_REVOKED', '127.0.0.1', f'سحب الصلاحية المؤقتة {grant_id} للمستخدم {uname} بواسطة {revoked_by}', 'CRITICAL')
    return {
        'ok': True,
        'id': grant_id,
        'user': uname,
        'message': f'تم سحب الصلاحيات المؤقتة للمستخدم {uname} فورياً وإعادته إلى الصلاحية المقيدة.'
    }


def db_verify_audit_chain() -> Dict[str, Any]:
    """Verifies cryptographic SHA-256 tamper-proof ledger chain over security events."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, event_type, ip, details, severity, created_at FROM security_audit_events ORDER BY id ASC")
        rows = cur.fetchall()

    h = hashlib.sha256()
    h.update(b"ASAAS_GENESIS_ROOT_LEDGER_V2")
    records_checked = 0

    for r in rows:
        payload = f"{r['id']}|{r['event_type']}|{r['ip']}|{r['details']}|{r['severity']}|{r['created_at']}".encode('utf-8')
        h.update(payload)
        records_checked += 1

    root_hash = h.hexdigest().upper()
    return {
        'ok': True,
        'records_checked': records_checked,
        # The legacy table has no persisted previous_hash/event_hash columns,
        # therefore it cannot prove integrity. Do not report a false positive.
        'chain_intact': False,
        'verification_status': 'legacy_unverified',
        'root_hash': f"SHA256:{root_hash[:32]}...{root_hash[-8:]}",
        'full_digest': root_hash,
        'verified_at': datetime.now(timezone.utc).isoformat(),
        'message': 'سجل v2 القديم غير قابل للتحقق تشفيرياً؛ استخدم /api/v1/audit/verify للسجل المرتبط بسلسلة hashes.'
    }


# ==============================================================================
# User Notifications & Desktop Broadcast
# ==============================================================================

def db_add_user_notification(target_user: str, session_id: int, title: str, message: str, sender: str = 'Admin') -> Dict[str, Any]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute("""
            INSERT INTO user_notifications (target_user, session_id, title, message, sender, status, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, 'DELIVERED', 0, ?)
        """, (target_user, session_id, title, message, sender, now_str))
        conn.commit()
        return {'ok': True, 'id': cur.lastrowid, 'target_user': target_user, 'title': title, 'created_at': now_str}


def db_list_user_notifications(limit: int = 20, unread_only: bool = False) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        sql = "SELECT * FROM user_notifications"
        if unread_only:
            sql += " WHERE is_read = 0"
        sql += " ORDER BY id DESC LIMIT ?"
        cur.execute(sql, (limit,))
        return [dict(row) for row in cur.fetchall()]


def db_mark_notification_read(notif_id: int) -> bool:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE user_notifications SET is_read = 1 WHERE id = ?", (notif_id,))
        conn.commit()
        return cur.rowcount > 0

# ==============================================================================
# Resource Governor Real SQLite Configuration
# ==============================================================================

def db_get_governor_settings() -> Dict[str, Any]:
    default = {
        'auto_trim': True,
        'idle_threshold_mins': 15,
        'auto_disconnect_enabled': True,
        'auto_disconnect_mins': 60,
        'auto_logoff_enabled': False,
        'auto_logoff_hours': 8,
        'reclaimed_mb': 0.0,
    }
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT key, value FROM governor_settings")
            rows = cur.fetchall()
            for r in rows:
                k = r['key']
                v = r['value']
                if k in ('auto_trim', 'auto_disconnect_enabled', 'auto_logoff_enabled'):
                    default[k] = v in ('1', 'true', 'True')
                elif k in ('idle_threshold_mins', 'auto_disconnect_mins', 'auto_logoff_hours'):
                    default[k] = int(v)
                elif k == 'reclaimed_mb':
                    try:
                        default[k] = min(max(0.0, float(v)), MAX_RECLAIMED_MB)
                    except (TypeError, ValueError):
                        default[k] = 0.0
    except Exception:
        pass
    return default


def db_save_governor_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    now_str = datetime.now(timezone.utc).isoformat()
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            for k, v in settings.items():
                cur.execute("""
                    INSERT INTO governor_settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """, (k, str(v), now_str))
            conn.commit()
    except Exception as e:
        logger.error(f"Failed to save governor settings: {e}")
    return db_get_governor_settings()


def db_get_system_metadata(key: str, default: Optional[str] = None) -> Optional[str]:
    """Reads a JSON/text value from the system_metadata key-value store."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT value FROM system_metadata WHERE key = ?", (key,))
            row = cur.fetchone()
            return row['value'] if row else default
    except Exception as e:
        logger.error(f"Failed to read system metadata '{key}': {e}")
        return default


def db_set_system_metadata(key: str, value: str) -> None:
    """Persists a JSON/text value in the system_metadata key-value store."""
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO system_metadata (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """, (key, value, now_str))
        conn.commit()


# =====================================================================
# ASAAS Enterprise v3.0: Core Infrastructure & Workspaces Database APIs
# =====================================================================

_SERVER_HEALTH_CACHE: Dict[str, Dict[str, Any]] = {}
_SERVER_HEALTH_LOCK = threading.Lock()
_SERVER_HEALTH_TTL = 20.0


def _tcp_ping(host: str, port: int, timeout: float = 0.4) -> Optional[float]:
    """Measures a real TCP handshake latency in milliseconds."""
    start = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return round((time.perf_counter() - start) * 1000.0, 1)
    except (OSError, ValueError):
        return None


def _server_probe_ports(os_name: str) -> List[int]:
    lower = (os_name or '').lower()
    if 'windows' in lower:
        return [3389, 445, 5985, 22]
    if 'linux' in lower or 'ubuntu' in lower:
        return [22, 80, 443, 3389]
    return [22, 3389, 445, 5985]


def _probe_server(host: str, os_name: str, is_local: bool) -> Tuple[str, float]:
    if is_local or host in ('127.0.0.1', 'localhost', '::1'):
        port = int(os.getenv('ASAAS_PORT', '8765') or 8765)
        latency = _tcp_ping('127.0.0.1', port, timeout=0.3)
        return 'online', latency if latency is not None else 0.2

    ports = _server_probe_ports(os_name)
    with ThreadPoolExecutor(max_workers=max(1, len(ports))) as pool:
        results = list(pool.map(lambda p: (p, _tcp_ping(host, p)), ports))
    successes = [latency for _, latency in results if latency is not None]
    if successes:
        return 'online', round(min(successes), 1)
    return 'offline', 0.0


def db_refresh_server_health(force: bool = False) -> Dict[str, Dict[str, Any]]:
    """Probes managed servers over TCP and persists real status/latency.

    Results are cached briefly so routine inventory calls stay fast while a
    forced manual check always performs fresh probes.
    """
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, name, ip, os, is_local FROM servers")
        servers = [dict(r) for r in cur.fetchall()]

    now = time.time()
    with _SERVER_HEALTH_LOCK:
        cached = dict(_SERVER_HEALTH_CACHE)

    refreshed: Dict[str, Dict[str, Any]] = {}
    for srv in servers:
        server_id = srv['id']
        previous = cached.get(server_id)
        if not force and previous and (now - previous.get('checked_at', 0)) < _SERVER_HEALTH_TTL:
            refreshed[server_id] = previous
            continue
        status, latency = _probe_server(str(srv['ip']), str(srv['os']), bool(srv['is_local']))
        refreshed[server_id] = {
            'status': status,
            'latency_ms': latency,
            'checked_at': now,
            'checked_at_iso': datetime.now(timezone.utc).isoformat(),
        }

    with _SERVER_HEALTH_LOCK:
        _SERVER_HEALTH_CACHE.update(refreshed)

    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.cursor()
        for server_id, health in refreshed.items():
            if health['status'] == 'online':
                cur.execute(
                    "UPDATE servers SET status = ?, latency_ms = ?, last_seen = ? WHERE id = ?",
                    ('online', health['latency_ms'], now_iso, server_id),
                )
            else:
                cur.execute(
                    "UPDATE servers SET status = 'offline', latency_ms = 0.0 WHERE id = ?",
                    (server_id,),
                )
        conn.commit()

    return refreshed


def db_list_servers() -> List[Dict[str, Any]]:
    """Lists all managed servers with latest telemetry and health status."""
    try:
        import psutil
        vm = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=None)
        disk = psutil.disk_usage('C:\\')
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE servers
                SET cpu = ?, ram = ?, storage = ?
                WHERE is_local = 1
            """, (round(cpu, 1), round(vm.percent, 1), round(disk.percent, 1)))
            conn.commit()
    except Exception:
        pass

    db_refresh_server_health()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM servers ORDER BY is_local DESC, name ASC")
        return [dict(r) for r in cur.fetchall()]


def db_add_server(name: str, ip: str, os_name: str, domain: str = 'WORKGROUP') -> Dict[str, Any]:
    """Registers a new Windows Server into inventory (pending first probe)."""
    srv_id = f"srv-{secrets.token_hex(4)}"
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO servers (id, name, ip, os, domain, status, roles_count, cpu, ram, storage, alerts_count, is_local, latency_ms, last_seen, created_at)
            VALUES (?, ?, ?, ?, ?, 'offline', 0, 0.0, 0.0, 0.0, 0, 0, 0.0, ?, ?)
        """, (srv_id, name.strip(), ip.strip(), os_name.strip() or 'Windows Server 2025', domain.strip() or 'WORKGROUP', now_str, now_str))
        conn.commit()
    status, latency = _probe_server(ip.strip(), os_name.strip(), False)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE servers SET status = ?, latency_ms = ?, last_seen = ? WHERE id = ?",
            (status, latency, datetime.now(timezone.utc).isoformat(), srv_id),
        )
        conn.commit()
    return {'ok': True, 'id': srv_id, 'name': name, 'ip': ip, 'status': status, 'latency_ms': latency}


def db_delete_server(server_id: str) -> Dict[str, Any]:
    """Removes a server from inventory (cannot remove local server)."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT is_local FROM servers WHERE id = ?", (server_id,))
        row = cur.fetchone()
        if not row:
            return {'ok': False, 'error': 'الخادم غير موجود.'}
        if row['is_local'] == 1:
            return {'ok': False, 'error': 'لا يمكن حذف الخادم المحلي (Local Server) من المنظومة.'}
        cur.execute("DELETE FROM servers WHERE id = ?", (server_id,))
        conn.commit()
    return {'ok': True, 'message': 'تمت إزالة الخادم من المنظومة بنجاح.'}


def db_list_server_groups() -> List[Dict[str, Any]]:
    """Returns custom server groups with member servers list."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM server_groups ORDER BY name ASC")
        res = []
        for r in cur.fetchall():
            d = dict(r)
            try:
                d['server_ids'] = json.loads(d['server_ids'])
            except Exception:
                d['server_ids'] = []
            res.append(d)
        return res


def db_create_server_group(name: str, description: str, server_ids: List[str]) -> Dict[str, Any]:
    """Creates a new server group."""
    grp_id = f"grp-{secrets.token_hex(4)}"
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO server_groups (id, name, description, server_ids, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (grp_id, name.strip(), description.strip(), json.dumps(server_ids), now_str))
        conn.commit()
    return {'ok': True, 'id': grp_id, 'name': name}


def db_delete_server_group(group_id: str) -> Dict[str, Any]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM server_groups WHERE id = ?", (group_id,))
        conn.commit()
    return {'ok': True, 'message': 'تم حذف المجموعة بنجاح.'}


def db_list_developer_projects(owner: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists developer projects, optionally filtered by owner."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        if owner and owner != 'admin':
            cur.execute("SELECT * FROM developer_projects WHERE owner = ? ORDER BY created_at DESC", (owner,))
        else:
            cur.execute("SELECT * FROM developer_projects ORDER BY created_at DESC")
        rows = []
        for r in cur.fetchall():
            d = dict(r)
            try:
                d['env_vars'] = json.loads(d.get('env_vars') or '{}')
            except Exception:
                d['env_vars'] = {}
            rows.append(d)
        return rows


def db_create_developer_project(name: str, owner: str, runtime: str, source_path: str, port: int, env_vars: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Creates a project record."""
    proj_id = f"proj-{secrets.token_hex(4)}"
    now_str = datetime.now(timezone.utc).isoformat()
    route = f"/apps/{proj_id}"
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO developer_projects (id, name, owner, runtime, source_path, port, status, env_vars, published_route, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'stopped', ?, ?, ?)
        """, (proj_id, name.strip(), owner.strip(), runtime.strip(), source_path.strip(), port, json.dumps(env_vars or {}), route, now_str))
        conn.commit()
    return {'ok': True, 'id': proj_id, 'name': name, 'port': port, 'route': route}


def db_update_project_status(project_id: str, status: str, pid: Optional[int] = None) -> None:
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            UPDATE developer_projects
            SET status = ?, pid = ?, last_started = CASE WHEN ? = 'running' THEN ? ELSE last_started END
            WHERE id = ?
        """, (status, pid, status, now_str, project_id))
        conn.commit()


def db_delete_developer_project(project_id: str) -> Dict[str, Any]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM developer_projects WHERE id = ?", (project_id,))
        conn.commit()
    return {'ok': True, 'message': 'تم حذف المشروع بنجاح.'}


def db_create_action_job(action: str, target_server: str, actor: str, risk_level: str, input_params: Dict[str, Any]) -> str:
    """Records an Action Engine job."""
    job_id = f"job-{secrets.token_hex(6)}"
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO action_jobs (id, action, target_server, actor, risk_level, status, input_params, result, started_at)
            VALUES (?, ?, ?, ?, ?, 'RUNNING', ?, '{}', ?)
        """, (job_id, action, target_server, actor, risk_level, json.dumps(input_params, ensure_ascii=False), now_str))
        conn.commit()
    return job_id


def db_update_action_job(job_id: str, status: str, result: Dict[str, Any], error: Optional[str] = None) -> None:
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            UPDATE action_jobs
            SET status = ?, result = ?, error = ?, completed_at = ?
            WHERE id = ?
        """, (status, json.dumps(result, ensure_ascii=False), error, now_str, job_id))
        conn.commit()


def db_list_action_jobs(limit: int = 50) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM action_jobs ORDER BY started_at DESC LIMIT ?", (limit,))
        res = []
        for r in cur.fetchall():
            d = dict(r)
            try:
                d['input_params'] = json.loads(d['input_params'])
            except Exception:
                d['input_params'] = {}
            try:
                d['result'] = json.loads(d['result'])
            except Exception:
                d['result'] = {}
            res.append(d)
        return res


def db_get_resource_quotas(scope_type: str, scope_id: str) -> Dict[str, Any]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM resource_quotas WHERE scope_type = ? AND scope_id = ?", (scope_type, scope_id))
        row = cur.fetchone()
        if row:
            return dict(row)
    return {
        'scope_type': scope_type,
        'scope_id': scope_id,
        'cpu_limit': 4.0,
        'ram_limit_mb': 4096,
        'disk_limit_gb': 50.0,
        'max_containers': 5,
        'max_projects': 5
    }


def db_save_resource_quota(scope_type: str, scope_id: str, cpu_limit: float, ram_limit_mb: int, disk_limit_gb: float, max_containers: int, max_projects: int) -> Dict[str, Any]:
    quota_id = f"qta-{secrets.token_hex(4)}"
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO resource_quotas (id, scope_type, scope_id, cpu_limit, ram_limit_mb, disk_limit_gb, max_containers, max_projects, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                cpu_limit = excluded.cpu_limit,
                ram_limit_mb = excluded.ram_limit_mb,
                disk_limit_gb = excluded.disk_limit_gb,
                max_containers = excluded.max_containers,
                max_projects = excluded.max_projects,
                updated_at = excluded.updated_at
        """, (quota_id, scope_type, scope_id, cpu_limit, ram_limit_mb, disk_limit_gb, max_containers, max_projects, now_str, now_str))
        conn.commit()
    return {'ok': True, 'scope_type': scope_type, 'scope_id': scope_id}


def db_list_conflict_events(limit: int = 30) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM conflict_events ORDER BY created_at DESC LIMIT ?", (limit,))
        res = []
        for r in cur.fetchall():
            d = dict(r)
            try:
                d['conflicting_entities'] = json.loads(d['conflicting_entities'])
            except Exception:
                d['conflicting_entities'] = []
            res.append(d)
        return res


def db_record_conflict_event(conflict_type: str, resource: str, conflicting_entities: List[Any], action: str = '') -> str:
    evt_id = f"cnf-{secrets.token_hex(4)}"
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO conflict_events (id, conflict_type, resource, conflicting_entities, resolution_status, resolution_action, created_at)
            VALUES (?, ?, ?, ?, 'DETECTED', ?, ?)
        """, (evt_id, conflict_type, resource, json.dumps(conflicting_entities, ensure_ascii=False), action, now_str))
        conn.commit()
    return evt_id


def db_resolve_conflict_event(conflict_id: str, resolution_action: str) -> None:
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            UPDATE conflict_events
            SET resolution_status = 'RESOLVED', resolution_action = ?, resolved_at = ?
            WHERE id = ?
        """, (resolution_action, now_str, conflict_id))
        conn.commit()


# ==============================================================================
# Domain 8: Encrypted Credential Vault (AES-256-GCM)
# ==============================================================================

def _get_vault_master_key() -> bytes:
    """Retrieves or creates a persistent AES-256 master key stored securely."""
    key_file = DATA_DIR / '.vault_master.key'
    if key_file.is_file():
        try:
            raw = base64.b64decode(key_file.read_text(encoding='utf-8').strip())
            if len(raw) == 32:
                return raw
        except Exception:
            pass

    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    new_key = AESGCM.generate_key(bit_length=256)
    try:
        key_file.write_text(base64.b64encode(new_key).decode('ascii'), encoding='utf-8')
    except Exception:
        pass
    return new_key


def db_list_vault_accounts() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, asset_id, asset_name, username, protocol, updated_at, created_at, metadata
            FROM vault_credentials
            ORDER BY updated_at DESC
        """)
        rows = cur.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            try:
                d['metadata'] = json.loads(d.get('metadata') or '{}')
            except Exception:
                d['metadata'] = {}
            result.append(d)
        return result


def db_add_vault_account(
    asset_id: str,
    asset_name: str,
    username: str,
    protocol: str,
    secret: str,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    key = _get_vault_master_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, secret.encode('utf-8'), None)

    account_id = f"vault-{secrets.token_hex(6)}"
    now_str = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO vault_credentials (
                id, asset_id, asset_name, username, protocol,
                secret_ciphertext, nonce, created_at, updated_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            account_id,
            asset_id or account_id,
            asset_name or f"{protocol} Asset",
            username,
            protocol.upper(),
            base64.b64encode(ciphertext).decode('ascii'),
            base64.b64encode(nonce).decode('ascii'),
            now_str,
            now_str,
            json.dumps(metadata or {}, ensure_ascii=False)
        ))
        conn.commit()

    db_add_security_event('VAULT_CREDENTIAL_STORED', '127.0.0.1', f'تخزين اعتماد مشفر AES-256 للحساب {username} على {asset_name}', 'INFO')
    return {
        'ok': True,
        'id': account_id,
        'asset_id': asset_id,
        'asset_name': asset_name,
        'username': username,
        'protocol': protocol,
        'updated_at': now_str
    }


def db_delete_vault_account(account_id: str) -> Dict[str, Any]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM vault_credentials WHERE id = ?", (account_id,))
        conn.commit()
    db_add_security_event('VAULT_CREDENTIAL_DELETED', '127.0.0.1', f'حذف اعتماد من الخزنة {account_id}', 'WARNING')
    return {'ok': True, 'id': account_id}


def db_reveal_vault_secret(account_id: str, requester: str = 'Admin') -> Dict[str, Any]:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, asset_name, username, protocol, secret_ciphertext, nonce
            FROM vault_credentials WHERE id = ?
        """, (account_id,))
        row = cur.fetchone()
        if not row:
            return {'ok': False, 'error': 'الاعتماد المطلوب غير موجود في الخزنة المشفرة.'}

        try:
            key = _get_vault_master_key()
            aesgcm = AESGCM(key)
            nonce = base64.b64decode(row['nonce'])
            ciphertext = base64.b64decode(row['secret_ciphertext'])
            plaintext = aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')
            db_add_security_event('VAULT_SECRET_REVEALED', '127.0.0.1', f'كشف سر الاعتماد {row["username"]} على {row["asset_name"]} بواسطة {requester}', 'WARNING')
            return {
                'ok': True,
                'secret': plaintext,
                'username': row['username'],
                'asset_name': row['asset_name'],
                'protocol': row['protocol']
            }
        except Exception as exc:
            return {'ok': False, 'error': f'فشل فك تشفير الاعتماد: {exc}'}
