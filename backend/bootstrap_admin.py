"""Interactive bootstrap for the local break-glass administrator."""

from __future__ import annotations

import argparse
from getpass import getpass
import sys

from app.infrastructure.db import db_bootstrap_admin, init_db


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create or rotate the local ASAAS break-glass administrator."
    )
    parser.add_argument("--username", default="breakglass-admin")
    parser.add_argument("--full-name", default="Local Break-glass Administrator")
    args = parser.parse_args()

    init_db()
    password = getpass("New break-glass password (16+ characters): ")
    confirmation = getpass("Confirm password: ")
    if password != confirmation:
        print("Passwords do not match.", file=sys.stderr)
        return 2

    result = db_bootstrap_admin(args.username, password, args.full_name)
    if not result.get("ok"):
        print(result.get("error", "Bootstrap failed."), file=sys.stderr)
        return 1
    print(f"Break-glass administrator '{result['username']}' is ready; existing sessions were revoked.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
