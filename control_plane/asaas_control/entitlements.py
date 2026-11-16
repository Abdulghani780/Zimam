"""Entitlement enforcement: feature gates + expired-license read-only mode.

Two mechanisms:

1. ``feature_required`` — mutating endpoints mapped to a licensed feature
   return 403 when the active license/trial does not include it.

2. Expired licenses (past ``expires_at + grace_days``, or trial elapsed)
   switch the control plane to read-only: every mutating ``/api/v1`` call
   returns 403 except an explicit whitelist (auth, license management,
   health, and agent telemetry endpoints — monitoring must never stop).
"""
from __future__ import annotations

import re

from fastapi import HTTPException, Request, Response
from fastapi.responses import JSONResponse

from .license import LicenseState, get_license_state

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# (compiled path pattern, required feature). First match wins.
FEATURE_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"^/api/v1/accounts"), "vault"),
    (re.compile(r"^/api/v1/assets$"), "vault"),  # POST create only; GET list is open
    (re.compile(r"^/api/v1/access-policies"), "policies"),
    (re.compile(r"^/api/v1/jobs$"), "remote_jobs"),
    (re.compile(r"^/api/v1/connection-tokens$"), "bastion"),
    (re.compile(r"^/api/v1/system/backup$"), "backup"),
]

# Mutating paths that stay writable even when the license is expired.
EXPIRED_WRITE_WHITELIST = [
    re.compile(r"^/api/v1/auth/"),
    re.compile(r"^/api/v1/license"),
    re.compile(r"^/api/v1/bootstrap"),
    re.compile(r"^/api/v1/health"),
    re.compile(r"^/api/v1/agents/"),  # heartbeat / poll / result — telemetry continues
]


def _is_whitelisted(path: str) -> bool:
    return any(rx.match(path) for rx in EXPIRED_WRITE_WHITELIST)


def check_feature(state: LicenseState, feature: str, detail: str | None = None) -> None:
    if not state.has_feature(feature):
        raise HTTPException(
            status_code=403,
            detail=detail or f"This feature requires the '{feature}' entitlement. Upgrade your ASAAS Server Control license.",
        )


async def license_guard(request: Request, call_next) -> Response:
    """FastAPI middleware: feature gates + expired read-only enforcement."""
    path = request.url.path
    if not path.startswith("/api/v1") or request.method in SAFE_METHODS:
        return await call_next(request)

    state = get_license_state()

    if state.mode == "expired" and not _is_whitelisted(path):
        return JSONResponse(
            status_code=403,
            content={
                "detail": "License expired — the console is in read-only mode. Renew your ASAAS Server Control license to re-enable changes.",
                "code": "license_expired",
            },
        )

    # Feature gates apply in every non-expired mode (trial has enterprise features).
    for rx, feature in FEATURE_RULES:
        if rx.match(path) and request.method != "GET":
            try:
                check_feature(state, feature)
            except HTTPException as exc:
                return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
            break

    return await call_next(request)
