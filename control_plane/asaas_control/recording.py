"""Session screen/terminal recording — guacd instruction stream capture.

During a gateway session the control plane already pumps every guacd
instruction to the browser. ``SessionRecorder`` tees that stream into a
JSON-lines file under ``<data>/recordings/<id>.jsonl`` where each line is
``{"t": <ms since start>, "i": "<instruction>"}``, plus a ``<id>.meta.json``
sidecar describing the session.

Replay streams the recorded instructions back over a WebSocket in the same
Guacamole wire format, paced by the recorded inter-arrival times, so a
``guacamole-common-js`` client renders the session again.

Recordings are text (base64 image instructions included) — enable/disable
with ``ASAAS_GW_RECORD`` (default on) and cap retention via
``ASAAS_RECORDING_MAX_MB`` per file is not enforced; operators should set a
retention policy. Files are ACL'd by the install dir like other state.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .config import resolve_data_path


def _recordings_dir() -> Path:
    return resolve_data_path(os.getenv("ASAAS_RECORDINGS_DIR", "data/recordings"))


def recording_enabled() -> bool:
    return os.getenv("ASAAS_GW_RECORD", "1").lower() in {"1", "true", "yes", "on"}


@dataclass
class RecordingMeta:
    recording_id: str
    protocol: str
    asset_id: str
    account_id: str
    user_id: str
    started_at: str
    finished_at: str | None
    instructions: int
    bytes: int


class SessionRecorder:
    """Append-only JSONL writer for one gateway session's guacd->client stream."""

    def __init__(self, recording_id: str, *, protocol: str, asset_id: str, account_id: str, user_id: str):
        self.recording_id = recording_id
        self.meta = RecordingMeta(
            recording_id=recording_id,
            protocol=protocol,
            asset_id=asset_id,
            account_id=account_id,
            user_id=user_id,
            started_at=datetime.now(UTC).isoformat(),
            finished_at=None,
            instructions=0,
            bytes=0,
        )
        self._dir = _recordings_dir()
        self._dir.mkdir(parents=True, exist_ok=True)
        self._path = self._dir / f"{recording_id}.jsonl"
        self._meta_path = self._dir / f"{recording_id}.meta.json"
        self._start = time.monotonic()
        self._fh = self._path.open("w", encoding="utf-8")

    def record(self, instruction: str) -> None:
        t_ms = int((time.monotonic() - self._start) * 1000)
        line = json.dumps({"t": t_ms, "i": instruction}, ensure_ascii=False, separators=(",", ":")) + "\n"
        self._fh.write(line)
        self.meta.instructions += 1
        self.meta.bytes += len(line.encode("utf-8"))

    def close(self) -> None:
        try:
            self._fh.close()
        except Exception:
            pass
        self.meta.finished_at = datetime.now(UTC).isoformat()
        try:
            self._meta_path.write_text(json.dumps(self.meta.__dict__, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass


def _safe_id(recording_id: str) -> str:
    if not recording_id or any(c in recording_id for c in "/\\.."):
        raise ValueError("Invalid recording id")
    return recording_id


def list_recordings() -> list[dict]:
    d = _recordings_dir()
    items = []
    if not d.exists():
        return items
    for meta_path in sorted(d.glob("*.meta.json")):
        try:
            items.append(json.loads(meta_path.read_text(encoding="utf-8")))
        except Exception:
            continue
    items.sort(key=lambda m: m.get("started_at", ""), reverse=True)
    return items


def get_meta(recording_id: str) -> dict | None:
    try:
        rid = _safe_id(recording_id)
    except ValueError:
        return None
    p = _recordings_dir() / f"{rid}.meta.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def recording_file(recording_id: str) -> Path | None:
    try:
        rid = _safe_id(recording_id)
    except ValueError:
        return None
    path = _recordings_dir() / f"{rid}.jsonl"
    return path if path.is_file() else None


def delete_recording(recording_id: str) -> bool:
    try:
        rid = _safe_id(recording_id)
    except ValueError:
        return False
    removed = False
    for suffix in (".jsonl", ".meta.json"):
        p = _recordings_dir() / f"{rid}{suffix}"
        if p.exists():
            p.unlink()
            removed = True
    return removed


async def stream_replay(recording_id: str, send_text) -> int:
    """Replay recorded guacd->client instructions paced by recorded timing.

    Returns the number of instructions sent. Raises ValueError for a bad id.
    """
    rid = _safe_id(recording_id)
    path = _recordings_dir() / f"{rid}.jsonl"
    if not path.exists():
        raise ValueError("Recording not found")
    prev_t = 0
    count = 0
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            t_ms = int(rec.get("t", 0))
            delay = max(0.0, (t_ms - prev_t) / 1000.0)
            prev_t = t_ms
            if delay > 0:
                await asyncio.sleep(min(delay, 5.0))
            await send_text(str(rec["i"]))
            count += 1
    return count
