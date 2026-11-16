"""Transparent passthrough proxy for the legacy v2 API.

Until each feature group migrates to ``/api/v1`` (see
``docs/MIGRATION_PLAN.md``), the control plane forwards ``/api/*`` requests
to the local legacy backend so the SPA served at the origin root works on a
single origin. ``/api/v1`` routes are registered earlier and always win.
"""
from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select

from .models import AppSession, User
from .security import token_hash
from .storage import db_session

router = APIRouter()

LEGACY_BASE_URL = os.getenv("ZIMAM_LEGACY_API_URL", "http://127.0.0.1:8765").rstrip("/")

# Header used to carry an authenticated /api/v1 identity to the legacy
# backend. The proxy strips any client-supplied value before injecting its
# own, so browsers can never forge it (it is also absent from the legacy
# CORS allow-headers list).
PROXY_USER_HEADER = "x-zimam-proxy-user"
PROXY_ROLE_HEADER = "x-zimam-proxy-role"
V1_SESSION_COOKIE = "zimam_v1_session"


def _v1_session_identity(raw: str | None) -> tuple[str, str] | None:
    """Resolve a control-plane session cookie to (username, role), or None."""
    if not raw:
        return None
    try:
        with db_session() as db:
            row = db.scalar(
                select(AppSession).where(
                    AppSession.token_hash == token_hash(raw),
                    AppSession.revoked.is_(False),
                )
            )
            if not row:
                return None
            expires = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=UTC)
            if expires <= datetime.now(UTC):
                return None
            user = db.get(User, row.user_id)
            if not user or not user.is_active:
                return None
            return user.username, (user.role or ("admin" if user.is_admin else "viewer"))
    except Exception:
        return None

# Long-lived SSE streams must not hit the default 5s read timeout.
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=None, write=30.0, pool=30.0),
            follow_redirects=False,
        )
    return _client


_HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length",
    # Browser origin/referer belong to the SPA↔control-plane hop. Forwarding
    # them to the legacy backend makes its same-origin check reject every
    # proxied call with «Origin غير مسموح» — the proxy is server-to-server.
    "origin", "referer",
}

_PASS_RESPONSE_HEADERS = {
    "content-type", "cache-control", "set-cookie", "x-content-type-options",
    "x-frame-options", "access-control-allow-origin",
    "access-control-allow-credentials", "vary", "pragma", "expires",
    "content-disposition", "content-security-policy",
}


@router.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy_legacy(path: str, request: Request):
    url = f"{LEGACY_BASE_URL}/api/{path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"

    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in _HOP_BY_HOP and not k.lower().startswith("x-zimam-proxy-")
    }
    identity = await asyncio.to_thread(_v1_session_identity, request.cookies.get(V1_SESSION_COOKIE))
    if identity:
        headers[PROXY_USER_HEADER], headers[PROXY_ROLE_HEADER] = identity
    body = await request.body()

    client = _get_client()
    try:
        upstream = client.build_request(request.method, url, headers=headers, content=body)
        resp = await client.send(upstream, stream=True)
    except httpx.HTTPError:
        return JSONResponse(
            status_code=502,
            content={
                "ok": False,
                "error": "خدمة ZIMAM المحلية غير متاحة. شغّل الخادم على المنفذ 8765.",
            },
        )

    async def stream_body():
        try:
            async for chunk in resp.aiter_raw():
                yield chunk
        finally:
            await resp.aclose()

    out_headers = [
        (k, v) for k, v in resp.headers.multi_items()
        if k.lower() in _PASS_RESPONSE_HEADERS
    ]
    # Starlette headers are a Mapping; append manually to preserve
    # duplicate Set-Cookie headers.
    proxy_resp = StreamingResponse(stream_body(), status_code=resp.status_code)
    seen: dict[str, int] = {}
    for k, v in out_headers:
        key = k.lower()
        if key == "set-cookie" or seen.get(key, 0) == 0:
            proxy_resp.headers.append(k, v)
            seen[key] = seen.get(key, 0) + 1
    return proxy_resp
