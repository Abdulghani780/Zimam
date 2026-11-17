"""Create or rotate the first Control Plane administrator locally."""

from __future__ import annotations

import argparse
import getpass
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

from asaas_control.config import settings
from asaas_control.models import AppSession, User
from asaas_control.security import hash_password
from asaas_control.storage import append_audit, db_session, init_db
from sqlalchemy import select


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", default="admin")
    args = parser.parse_args()

    password = getpass.getpass("Control Plane admin password (16+ characters): ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        print("Passwords do not match.")
        return 2
    if len(password) < 16:
        print("Password must be at least 16 characters.")
        return 2

    init_db()
    with db_session() as db:
        user = db.scalar(select(User).where(User.username == args.username))
        if user is None:
            user = User(id=uuid.uuid4().hex, username=args.username, password_hash=hash_password(password), is_admin=True, is_active=True, created_at=datetime.now(UTC))
            db.add(user)
            db.flush()
        else:
            user.password_hash = hash_password(password)
            user.is_admin = True
            user.is_active = True
        db.query(AppSession).filter(AppSession.user_id == user.id).update({AppSession.revoked: True})
        append_audit(db, actor_id=user.id, action="auth.bootstrap.local")

    # Keep the temporary v2 console usable during migration. The two stores
    # intentionally use different password-hash formats, so we update the
    # legacy PBKDF2 record through its own bootstrap function rather than
    # copying a hash across databases.
    repo_root = Path(__file__).resolve().parents[1]
    backend_dir = repo_root / "backend"
    if backend_dir.exists():
        sys.path.insert(0, str(backend_dir))
        try:
            from app.infrastructure.db import db_bootstrap_admin
            legacy = db_bootstrap_admin(args.username, password, args.username)
            if not legacy.get("ok"):
                print(f"Warning: legacy console was not updated: {legacy.get('error', 'unknown error')}")
        except Exception as exc:
            print(f"Warning: legacy console was not updated: {exc}")
    print(f"Control Plane administrator '{args.username}' is ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
