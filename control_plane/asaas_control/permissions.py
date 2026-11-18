from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime


def _matches(values: frozenset[str], value: str) -> bool:
    return not values or value in values or "*" in values


@dataclass(frozen=True)
class AccessContext:
    user_id: str
    group_ids: frozenset[str]
    asset_id: str
    account_id: str
    protocol: str
    action: str
    at: datetime


@dataclass(frozen=True)
class AccessPolicy:
    subject_ids: frozenset[str]
    asset_ids: frozenset[str]
    account_ids: frozenset[str]
    protocols: frozenset[str]
    actions: frozenset[str]
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    effect: str = "allow"

    def matches(self, context: AccessContext) -> bool:
        subjects = {context.user_id, *context.group_ids}
        if not subjects.intersection(self.subject_ids) and self.subject_ids and "*" not in self.subject_ids:
            return False
        if not (_matches(self.asset_ids, context.asset_id) and _matches(self.account_ids, context.account_id) and _matches(self.protocols, context.protocol) and _matches(self.actions, context.action)):
            return False
        at = context.at if context.at.tzinfo else context.at.replace(tzinfo=UTC)
        return not ((self.valid_from and at < self.valid_from) or (self.valid_until and at > self.valid_until))


class PermissionEngine:
    def __init__(self, policies: list[AccessPolicy]):
        self.policies = policies

    def is_allowed(self, context: AccessContext) -> bool:
        matched = [p for p in self.policies if p.matches(context)]
        return bool(matched) and not any(p.effect.lower() == "deny" for p in matched)
