"""Off-box backup replication — ships local backup artifacts to a remote
destination configured via ``ASAAS_BACKUP_DEST``.

Supported schemes:

- ``file:///abs/or/unc/path`` or a bare path — plain copy (also covers UNC
  shares like ``\\\\server\\share`` on Windows).
- ``sftp://user@host[:port]/remote/dir`` — Paramiko upload (password via
  ``ASAAS_BACKUP_SFTP_PASSWORD`` or ``ASAAS_BACKUP_SFTP_KEY_PATH``).
- ``s3://bucket/prefix`` — S3-compatible upload via boto3 (lazy import ->
  503-style RuntimeError when boto3 is absent).

Credentials never leave the server; only the artifact + manifest are sent.
``replicate_file`` returns a summary dict and raises on failure so callers
can surface honest errors instead of pretending replication happened.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from urllib.parse import urlparse


def destination() -> str:
    return os.getenv("ASAAS_BACKUP_DEST", "").strip()


def replication_status() -> dict:
    dest = destination()
    scheme = urlparse(dest).scheme if "://" in dest else "file"
    return {
        "configured": bool(dest),
        "scheme": scheme if dest else None,
        # never expose credentials — host/bucket only
        "target": _target_label(dest),
    }


def _target_label(dest: str) -> str | None:
    if not dest:
        return None
    if "://" in dest:
        parsed = urlparse(dest)
        if parsed.scheme == "s3":
            return f"s3://{parsed.netloc}{parsed.path}"
        return f"{parsed.scheme}://{parsed.hostname or parsed.netloc}"
    return dest if not dest.startswith(("\\\\", "/")) else "<local-path>"


def _sftp_password() -> str:
    return os.getenv("ASAAS_BACKUP_SFTP_PASSWORD", "")


def _sftp_key_path() -> str:
    return os.getenv("ASAAS_BACKUP_SFTP_KEY_PATH", "").strip()


def _replicate_sftp(local: Path, parsed) -> dict:
    import paramiko  # lazy — paramiko already a control-plane dep

    user = parsed.username or os.getenv("USER", "")
    host = parsed.hostname
    port = parsed.port or 22
    remote_dir = parsed.path.strip("/") or "."
    if not host or not user:
        raise RuntimeError("SFTP destination requires user@host in ASAAS_BACKUP_DEST")

    transport = paramiko.Transport((host, port))
    pkey = None
    key_path = _sftp_key_path()
    if key_path:
        pkey = paramiko.RSAKey.from_private_key_file(key_path)
    try:
        transport.connect(username=user, password=_sftp_password() or None, pkey=pkey)
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            _makedirs(sftp, remote_dir)
            remote_path = f"{remote_dir}/{local.name}"
            sftp.put(str(local), remote_path)
            remote_manifest = f"{remote_dir}/{local.name.replace('.db', '.manifest.json')}"
            manifest = local.with_suffix(".manifest.json")
            if manifest.exists():
                sftp.put(str(manifest), remote_manifest)
            return {"remote_path": remote_path, "bytes": local.stat().st_size}
        finally:
            sftp.close()
    finally:
        transport.close()


def _makedirs(sftp, remote_dir: str) -> None:
    parts = [p for p in remote_dir.split("/") if p]
    current = ""
    for part in parts:
        current = f"{current}/{part}" if current else f"/{part}"
        try:
            sftp.mkdir(current)
        except OSError:
            pass  # already exists


def _replicate_s3(local: Path, parsed) -> dict:
    try:
        import boto3  # type: ignore
    except ImportError as exc:
        raise RuntimeError("boto3 is not installed; S3 replication unavailable") from exc

    bucket = parsed.netloc
    prefix = parsed.path.strip("/")
    if not bucket:
        raise RuntimeError("S3 destination requires bucket in ASAAS_BACKUP_DEST")
    key = f"{prefix}/{local.name}" if prefix else local.name
    client = boto3.client("s3")
    client.upload_file(str(local), bucket, key)
    manifest = local.with_suffix(".manifest.json")
    if manifest.exists():
        mkey = f"{prefix}/{manifest.name}" if prefix else manifest.name
        client.upload_file(str(manifest), bucket, mkey)
    return {"remote_path": f"s3://{bucket}/{key}", "bytes": local.stat().st_size}


def _replicate_file(local: Path, parsed) -> dict:
    target_dir = Path(parsed.path) if parsed.scheme == "file" else Path(str(parsed))
    if parsed.scheme and parsed.scheme != "file":
        raise RuntimeError(f"Unsupported replication scheme: {parsed.scheme}")
    target_dir.mkdir(parents=True, exist_ok=True)
    dest = target_dir / local.name
    shutil.copy2(local, dest)
    manifest = local.with_suffix(".manifest.json")
    if manifest.exists():
        shutil.copy2(manifest, target_dir / manifest.name)
    return {"remote_path": str(dest), "bytes": local.stat().st_size}


def replicate_file(local_path: str | Path) -> dict:
    """Copy ``local_path`` (+ its ``.manifest.json``) to ASAAS_BACKUP_DEST.

    Returns ``{"configured": False}`` when no destination is set so callers
    can report honestly; raises RuntimeError on transport failures.
    """
    dest = destination()
    if not dest:
        return {"configured": False}
    local = Path(local_path)
    if not local.is_file():
        raise FileNotFoundError(local_path)
    if "://" in dest:
        parsed = urlparse(dest)
        if parsed.scheme == "sftp":
            info = _replicate_sftp(local, parsed)
        elif parsed.scheme == "s3":
            info = _replicate_s3(local, parsed)
        elif parsed.scheme == "file":
            info = _replicate_file(local, parsed)
        else:
            raise RuntimeError(f"Unsupported replication scheme: {parsed.scheme}")
    else:
        info = _replicate_file(local, urlparse("file://" + dest.replace("\\", "/")))
    info["configured"] = True
    info["scheme"] = urlparse(dest).scheme if "://" in dest else "file"
    info["target"] = _target_label(dest)
    return info
