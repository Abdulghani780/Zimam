from __future__ import annotations

import json
import os
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Iterator

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from .audit import AuditChain, AuditRecord
from .config import settings
from .models import AuditEvent, Base


def _engine_url() -> str:
    value = settings.database_url
    if value.startswith("sqlite:///"):
        path = value.removeprefix("sqlite:///")
        if path.startswith("./"):
            os.makedirs(path[2:].rsplit("/", 1)[0] if "/" in path[2:] else ".", exist_ok=True)
    return value


engine = create_engine(_engine_url(), future=True, connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(engine)


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
