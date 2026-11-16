"""Consistent local backups of the control-plane SQLite database.

Used by both the admin endpoint (``POST /api/v1/system/backup``) and the
optional scheduled backup loop in ``app.py``. Backups land in
``<db dir>/backups/`` with a SHA-256 manifest and an audit-chain event.
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from .config import resolve_database_path, settings
from .storage import append_audit, db_session


def _db_path() -> str:
    path = resolve_database_path()
    if path is None:
        raise FileNotFoundError(settings.database_url)
    return str(path)


def create_backup(*, created_by: str = "scheduler", actor_id: str = "system") -> dict:
    """Run an online SQLite backup and return its manifest fields.

    Raises ``FileNotFoundError`` when the database file is missing so callers
    can map it to their own error surface (HTTP 503 for the endpoint).
    """
    db_path = _db_path()
    if not os.path.exists(db_path):
        raise FileNotFoundError(db_path)

    backup_dir = Path(db_path).parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    target = backup_dir / f"control_plane_{stamp}.db"

    counts: dict[str, int] = {}
    src = sqlite3.connect(db_path)
    dst = sqlite3.connect(target)
    try:
        src.backup(dst)
        for (table,) in dst.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ):
            counts[table] = dst.execute(f"SELECT COUNT(*) FROM \"{table}\"").fetchone()[0]
    finally:
        dst.close()
        src.close()

    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    manifest = {
        "created_at": datetime.now(UTC).isoformat(),
        "source": os.path.basename(db_path),
        "file": target.name,
        "sha256": digest,
        "size_bytes": target.stat().st_size,
        "row_counts": counts,
        "created_by": created_by,
    }
    (backup_dir / f"control_plane_{stamp}.manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )

    with db_session() as db:
        append_audit(
            db,
            actor_id=actor_id,
            action="system.backup",
            target_id=target.name,
            payload={"sha256": digest, "size_bytes": manifest["size_bytes"], "scheduled": created_by == "scheduler"},
        )
    return {"file": target.name, "path": str(target), "size_bytes": manifest["size_bytes"], "sha256": digest, "row_counts": counts}


def prune_backups(keep: int) -> int:
    """Delete oldest ``control_plane_*.db`` + manifests beyond ``keep``. Returns count removed."""
    try:
        db_path = _db_path()
    except FileNotFoundError:
        return 0
    backup_dir = Path(db_path).parent / "backups"
    if not backup_dir.is_dir():
        return 0
    dbs = sorted(backup_dir.glob("control_plane_*.db"), key=lambda p: p.stat().st_mtime)
    excess = dbs[:-keep] if keep > 0 else dbs
    removed = 0
    for old in excess:
        try:
            old.unlink()
            manifest = backup_dir / old.name.replace(".db", ".manifest.json")
            if manifest.exists():
                manifest.unlink()
            removed += 1
        except OSError:
            continue
    return removed
