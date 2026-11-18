"""AD/LDAP directory sync — pulls user entries into the ``directory_users``
read model.

Configured entirely by environment (see ``config.DirectorySettings``):

- ``ASAAS_LDAP_URL``        e.g. ``ldaps://dc.corp.local:636`` or ``ldap://host:389``
- ``ASAAS_LDAP_BIND_DN``    e.g. ``CN=svc-asaas,OU=Service,DC=corp,DC=local``
- ``ASAAS_LDAP_BIND_PASSWORD``
- ``ASAAS_LDAP_BASE_DN``    search base, e.g. ``OU=Users,DC=corp,DC=local``
- ``ASAAS_LDAP_USER_FILTER`` optional LDAP filter (default ``(objectClass=user)``)
- ``ASAAS_LDAP_PAGE_SIZE``  paging size (default 500)

``ldap3`` is imported lazily — without it (or without ``ASAAS_LDAP_URL``)
the sync endpoint reports ``configured: false`` / raises 503 honestly rather
than fabricating results. Synced rows land in ``directory_users`` as a read
model for policy/JIT subject mapping; they do NOT create login accounts.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select

from .models import DirectoryUser
from .storage import db_session


@dataclass(frozen=True)
class DirectoryConfig:
    url: str
    bind_dn: str
    bind_password: str
    base_dn: str
    user_filter: str
    page_size: int

    @staticmethod
    def from_env() -> "DirectoryConfig | None":
        url = os.getenv("ASAAS_LDAP_URL", "").strip()
        base_dn = os.getenv("ASAAS_LDAP_BASE_DN", "").strip()
        if not url or not base_dn:
            return None
        try:
            page_size = int(os.getenv("ASAAS_LDAP_PAGE_SIZE", "500"))
        except ValueError:
            page_size = 500
        return DirectoryConfig(
            url=url,
            bind_dn=os.getenv("ASAAS_LDAP_BIND_DN", "").strip(),
            bind_password=os.getenv("ASAAS_LDAP_BIND_PASSWORD", ""),
            base_dn=base_dn,
            user_filter=os.getenv("ASAAS_LDAP_USER_FILTER", "(objectClass=user)").strip() or "(objectClass=user)",
            page_size=max(1, page_size),
        )


def _ldap3():
    try:
        import ldap3  # type: ignore

        return ldap3
    except ImportError as exc:
        raise RuntimeError("ldap3 is not installed; AD/LDAP sync unavailable") from exc


def _attr(entry, name: str, default: str = "") -> str:
    value = entry.entry_attributes_as_dict.get(name)
    if value is None:
        # case-insensitive fallback for AD vs OpenLDAP attribute casing
        for key, val in entry.entry_attributes_as_dict.items():
            if key.lower() == name.lower():
                value = val
                break
    if isinstance(value, (list, tuple)):
        return str(value[0]) if value else default
    return str(value) if value is not None else default


def fetch_directory_users(cfg: DirectoryConfig) -> list[dict]:
    """Bind and read user entries. Raises on connection/search failure."""
    ldap3 = _ldap3()
    use_ssl = cfg.url.lower().startswith("ldaps://")
    server = ldap3.Server(cfg.url, use_ssl=use_ssl, get_info=ldap3.ALL)
    conn = ldap3.Connection(
        server,
        user=cfg.bind_dn or None,
        password=cfg.bind_password or None,
        auto_bind=True,
        receive_timeout=15,
    )
    try:
        conn.search(
            search_base=cfg.base_dn,
            search_filter=cfg.user_filter,
            search_scope=ldap3.SUBTREE,
            attributes=["sAMAccountName", "userPrincipalName", "cn", "displayName", "mail", "memberOf", "objectClass"],
            paged_size=cfg.page_size,
        )
        users = []
        for entry in conn.entries:
            username = _attr(entry, "sAMAccountName") or _attr(entry, "userPrincipalName") or _attr(entry, "cn")
            if not username:
                continue
            groups = entry.entry_attributes_as_dict.get("memberOf") or []
            if isinstance(groups, str):
                groups = [groups]
            users.append(
                {
                    "username": username,
                    "display_name": _attr(entry, "displayName") or _attr(entry, "cn"),
                    "email": _attr(entry, "mail"),
                    "groups": [str(g) for g in groups],
                }
            )
        return users
    finally:
        conn.unbind()


def sync_directory() -> dict:
    """Pull the directory and upsert into ``directory_users``.

    Returns a summary dict; raises RuntimeError/ldap3 errors on failure.
    """
    cfg = DirectoryConfig.from_env()
    if cfg is None:
        raise RuntimeError("LDAP is not configured (set ASAAS_LDAP_URL and ASAAS_LDAP_BASE_DN)")
    users = fetch_directory_users(cfg)
    now = datetime.now(UTC)
    synced = 0
    with db_session() as db:
        existing = {row.username: row for row in db.scalars(select(DirectoryUser))}
        seen = set()
        for u in users:
            username = u["username"]
            seen.add(username)
            row = existing.get(username)
            if row is None:
                row = DirectoryUser(id=uuid.uuid4().hex, username=username, source="ldap")
                db.add(row)
            row.display_name = u["display_name"]
            row.email = u["email"]
            row.groups_json = __import__("json").dumps(u["groups"], ensure_ascii=False)
            row.synced_at = now
            synced += 1
        # Entries absent from this sync are stale — mark by deleting rows not seen.
        removed = 0
        for username, row in existing.items():
            if username not in seen:
                db.delete(row)
                removed += 1
    return {
        "configured": True,
        "base_dn": cfg.base_dn,
        "fetched": len(users),
        "upserted": synced,
        "removed_stale": removed,
        "synced_at": now.isoformat(),
    }
