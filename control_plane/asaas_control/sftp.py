"""SFTP data path — server-side paramiko sessions for SSH-protocol assets.

The browser never sees credentials: a logged-in user opens an SFTP session
(``POST /api/v1/sftp/session``) which decrypts the vaulted account secret and
holds a paramiko SFTP client server-side. File operations then run through
short-lived session ids.

Sessions are in-memory (single control-plane worker). ``paramiko`` is
imported lazily so the control plane still boots without it — SFTP endpoints
return 503 in that case.
"""

from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime

SESSION_TTL_SECONDS = 900  # 15 minutes idle-relevant; absolute cap


@dataclass
class SftpSession:
    sid: str
    user_id: str
    asset_id: str
    account_id: str
    transport: object
    sftp: object
    created_at: datetime
    last_used: float


_sessions: dict[str, SftpSession] = {}
_lock = threading.Lock()


def _paramiko():
    try:
        import paramiko  # type: ignore

        return paramiko
    except ImportError as exc:  # pragma: no cover - depends on deployment
        raise RuntimeError("paramiko is not installed; SFTP data path unavailable") from exc


def open_session(*, user_id: str, asset_id: str, account_id: str, hostname: str, port: int, username: str, password: str, timeout: float = 15.0) -> SftpSession:
    paramiko = _paramiko()
    transport = paramiko.Transport((hostname, port))
    transport.banner_timeout = timeout
    transport.auth_timeout = timeout
    try:
        transport.connect(username=username, password=password)
        sftp = paramiko.SFTPClient.from_transport(transport)
        if sftp is None:
            raise RuntimeError("SFTP subsystem not available on target")
    except Exception:
        try:
            transport.close()
        except Exception:
            pass
        raise
    sid = secrets.token_urlsafe(24)
    sess = SftpSession(sid=sid, user_id=user_id, asset_id=asset_id, account_id=account_id, transport=transport, sftp=sftp, created_at=datetime.now(UTC), last_used=time.time())
    with _lock:
        _sessions[sid] = sess
        _gc_locked()
    return sess


def _gc_locked() -> None:
    now = time.time()
    stale = [sid for sid, s in _sessions.items() if now - s.last_used > SESSION_TTL_SECONDS]
    for sid in stale:
        s = _sessions.pop(sid)
        _close_quiet(s)


def _close_quiet(sess: SftpSession) -> None:
    try:
        sess.sftp.close()
    except Exception:
        pass
    try:
        sess.transport.close()
    except Exception:
        pass


def get_session(sid: str, *, user_id: str) -> SftpSession:
    with _lock:
        sess = _sessions.get(sid)
        if sess is None or sess.user_id != user_id:
            raise KeyError("SFTP session not found or expired")
        sess.last_used = time.time()
        return sess


def close_session(sid: str, *, user_id: str) -> None:
    with _lock:
        sess = _sessions.pop(sid, None)
    if sess and sess.user_id == user_id:
        _close_quiet(sess)


def list_dir(sess: SftpSession, path: str) -> list[dict]:
    out = []
    for attr in sess.sftp.listdir_attr(path):
        out.append(
            {
                "name": attr.filename,
                "path": f"{path.rstrip('/')}/{attr.filename}",
                "size": attr.st_size or 0,
                "is_dir": attr.st_mode is not None and (attr.st_mode & 0o170000) == 0o040000,
                "modified": datetime.fromtimestamp(attr.st_mtime, UTC).isoformat() if attr.st_mtime else None,
            }
        )
    out.sort(key=lambda e: (not e["is_dir"], e["name"].lower()))
    return out


def stat_path(sess: SftpSession, path: str) -> dict:
    attr = sess.sftp.stat(path)
    return {
        "name": path.rsplit("/", 1)[-1],
        "path": path,
        "size": attr.st_size or 0,
        "is_dir": (attr.st_mode & 0o170000) == 0o040000,
        "modified": datetime.fromtimestamp(attr.st_mtime, UTC).isoformat() if attr.st_mtime else None,
    }


def open_download(sess: SftpSession, path: str):
    return sess.sftp.open(path, "rb")


def open_upload(sess: SftpSession, path: str):
    return sess.sftp.open(path, "wb")


def mkdir(sess: SftpSession, path: str) -> None:
    sess.sftp.mkdir(path)


def remove(sess: SftpSession, path: str) -> None:
    sess.sftp.remove(path)


def rmdir(sess: SftpSession, path: str) -> None:
    sess.sftp.rmdir(path)


def rename(sess: SftpSession, old: str, new: str) -> None:
    sess.sftp.rename(old, new)
