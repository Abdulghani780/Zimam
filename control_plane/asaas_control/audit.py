from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()


@dataclass
class AuditRecord:
    sequence: int
    occurred_at: datetime
    actor_id: str
    action: str
    target_id: str | None
    payload: dict[str, Any] = field(default_factory=dict)
    previous_hash: str = ""
    event_hash: str = ""

    def material(self) -> bytes:
        return _canonical({"sequence": self.sequence, "occurred_at": self.occurred_at.isoformat(), "actor_id": self.actor_id, "action": self.action, "target_id": self.target_id, "payload": self.payload, "previous_hash": self.previous_hash})


@dataclass(frozen=True)
class AuditVerification:
    intact: bool
    failed_index: int | None = None
    root_signature: str | None = None


class AuditChain:
    def __init__(self, signing_key: bytes):
        self.signing_key = signing_key
        self._last_hash = ""
        self._next_sequence = 0

    def append(self, *, actor_id: str, action: str, target_id: str | None = None, payload: dict[str, Any] | None = None, previous_hash: str = "") -> AuditRecord:
        previous = previous_hash or self._last_hash
        record = AuditRecord(self._next_sequence, datetime.now(UTC), actor_id, action, target_id, payload or {}, previous)
        record.event_hash = hashlib.sha256(record.material()).hexdigest()
        self._last_hash = record.event_hash
        self._next_sequence += 1
        return record

    def append_to(self, records: list[AuditRecord], **kwargs: Any) -> AuditRecord:
        record = self.append(previous_hash=records[-1].event_hash if records else "", **kwargs)
        record.sequence = len(records)
        record.event_hash = hashlib.sha256(record.material()).hexdigest()
        records.append(record)
        return record

    def verify(self, records: list[AuditRecord]) -> AuditVerification:
        previous = ""
        for index, record in enumerate(records):
            if record.previous_hash != previous or hashlib.sha256(record.material()).hexdigest() != record.event_hash:
                return AuditVerification(False, index)
            previous = record.event_hash
        root = hmac.new(self.signing_key, previous.encode(), hashlib.sha256).hexdigest() if records else hmac.new(self.signing_key, b"", hashlib.sha256).hexdigest()
        return AuditVerification(True, root_signature=root)
