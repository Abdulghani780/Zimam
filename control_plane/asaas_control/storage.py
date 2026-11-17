from __future__ import annotations

import json
import os
import sys
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Iterator

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from .audit import AuditChain, AuditRecord
from .config import resolve_data_path, resolve_database_path, settings
from .models import AuditEvent, Base


def _engine_url() -> str:
    value = settings.database_url
    if value.startswith("sqlite:///"):
        # Relative sqlite paths resolve against the process CWD, which is
        # unreliable for scheduled tasks/services — anchor them via
        # resolve_database_path (install root when frozen, repo root otherwise).
        db_path = resolve_database_path()
        if db_path is not None:
            path = str(db_path)
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            return "sqlite:///" + path.replace("\\", "/")
    return value


engine = create_engine(_engine_url(), future=True, connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(engine)
    _ensure_user_columns()
    _ensure_asset_columns()
    sync_legacy_identities()


# Columns added after the users table first shipped; create_all() does not
# ALTER existing tables, so add them idempotently for sqlite and postgres.
_USER_COLUMN_MIGRATIONS = {
    "role": "VARCHAR(16) DEFAULT 'viewer'",
    "full_name": "VARCHAR(255) DEFAULT ''",
    "legacy_password": "VARCHAR(512)",
}


def _ensure_user_columns() -> None:
    from sqlalchemy import inspect, text

    dialect = engine.dialect.name
    with engine.begin() as conn:
        existing = {c["name"] for c in inspect(conn).get_columns("users")}
        for column, ddl_type in _USER_COLUMN_MIGRATIONS.items():
            if column not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {column} {ddl_type}"))


# Same pattern for assets: connection-target fields added later.
_ASSET_COLUMN_MIGRATIONS = {
    "port": "INTEGER",
    "protocol": "VARCHAR(32)",
    "metadata_json": "TEXT DEFAULT '{}'",
}


def _ensure_asset_columns() -> None:
    from sqlalchemy import inspect, text

    with engine.begin() as conn:
        existing = {c["name"] for c in inspect(conn).get_columns("assets")}
        for column, ddl_type in _ASSET_COLUMN_MIGRATIONS.items():
            if column not in existing:
                conn.execute(text(f"ALTER TABLE assets ADD COLUMN {column} {ddl_type}"))


def _legacy_db_path() -> str | None:
    import os

    raw = os.getenv("ASAAS_LEGACY_DB", "data/asaas_v2.db")
    path = resolve_data_path(raw)
    return str(path) if path.exists() else None


def sync_legacy_identities() -> int:
    """Import legacy ``app_users`` (PBKDF2) into the control-plane users table.

    Imported rows keep their PBKDF2 credential in ``legacy_password`` so the
    next successful login upgrades them to Argon2 transparently. Existing
    control-plane users are never overwritten.
    """
    import hashlib
    import sqlite3
    import uuid
    from datetime import UTC, datetime

    from .models import User
    from .security import hash_password

    path = _legacy_db_path()
    if not path:
        return 0
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT username, password_hash, salt, role, full_name, is_active FROM app_users"
        ).fetchall()
        conn.close()
    except Exception:
        return 0

    imported = 0
    with db_session() as db:
        existing = {name.lower() for name in db.scalars(select(User.username))}
        for row in rows:
            username = (row["username"] or "").strip()
            if not username or username.lower() in existing:
                continue
            role = row["role"] if row["role"] in {"admin", "operator", "viewer"} else "viewer"
            legacy_cred = f"{row['salt']}:{row['password_hash']}"
            db.add(User(
                id=uuid.uuid4().hex,
                username=username,
                # Unusable Argon2 placeholder; real credential lives in legacy_password.
                password_hash=hash_password(hashlib.sha256(uuid.uuid4().bytes).hexdigest()),
                is_admin=role == "admin",
                is_active=bool(row["is_active"]),
                role=role,
                full_name=row["full_name"] or "",
                legacy_password=legacy_cred,
                created_at=datetime.now(UTC),
            ))
            imported += 1
    return imported


@contextmanager
def db_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def append_audit(session: Session, *, actor_id: str, action: str, target_id: str | None = None, payload: dict | None = None) -> AuditEvent:
    last = session.scalar(select(AuditEvent).order_by(AuditEvent.sequence.desc()).limit(1))
    previous = last.event_hash if last else ""
    # SQLite drops timezone offsets; store a canonical UTC-naive timestamp so
    # the exact bytes used for hashing survive a restart and verification.
    occurred_at = datetime.now(UTC).replace(tzinfo=None)
    record = AuditRecord(len([*session.scalars(select(AuditEvent))]), occurred_at, actor_id, action, target_id, payload or {}, previous)
    import hashlib
    record.event_hash = hashlib.sha256(record.material()).hexdigest()
    event = AuditEvent(sequence=record.sequence, actor_id=actor_id, action=action, target_id=target_id, payload_json=json.dumps(record.payload, sort_keys=True), previous_hash=previous, event_hash=record.event_hash, created_at=record.occurred_at)
    session.add(event)
    return event
