from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import secrets
import sqlite3
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from .audit import AuditChain
from .backup import create_backup
from .config import resolve_database_path, settings
from .connection_tokens import ConnectionTokenStore
from .gateway import DEFAULT_PORTS, SUPPORTED_PROTOCOLS, enabled as gateway_enabled, open_session, parse_instruction
from .identity import verify_legacy_password
from .license import LicenseError, activate_license, deactivate_license, get_license_state
from . import recording as session_recording
from . import sftp as sftp_path
from .models import AccessPolicyRow, Account, Agent, AgentJob, AppSession, Asset, JitGrantRow, User
from .mtls import ca_cert_pem, ca_status, ensure_ca, issue_client_cert, rotate_ca
from .permissions import AccessContext, AccessPolicy, PermissionEngine
from .security import hash_password, new_token, token_hash, verify_password
from .signing import get_job_signer
from .storage import append_audit, db_session
from .vault import EnvelopeVault

router = APIRouter(prefix="/api/v1")
log = logging.getLogger("asaas_control.api")

_VALID_ROLES = {"admin", "operator", "viewer"}


def _require_admin(user: User) -> None:
    if not (user.is_admin or user.role == "admin"):
        raise HTTPException(status_code=403, detail="Administrator role required")


def _require_writer(user: User) -> None:
    """Mutating endpoints are open to admin/operator; viewers are read-only."""
    role = user.role or ("admin" if user.is_admin else "viewer")
    if role == "viewer":
        raise HTTPException(status_code=403, detail="Viewer role is read-only")
_connection_store = ConnectionTokenStore(
    hashlib.sha256((settings.gateway_token or "disabled").encode()).digest(),
    redis_url=os.environ.get("ASAAS_REDIS_URL") or None,
)

# In-memory sliding-window login throttling: 8 failures per IP+username per 5 minutes.
_login_attempts: dict[str, list[float]] = {}
_LOGIN_WINDOW_SEC = 300
_LOGIN_MAX_ATTEMPTS = 8


def _login_throttle_key(request: Request, username: str) -> str:
    host = request.client.host if request.client else "local"
    return f"{host}:{username}"


class BootstrapRequest(BaseModel):
    username: str = Field(min_length=3, max_length=128)
    password: str = Field(min_length=16, max_length=256)


class LoginRequest(BaseModel):
    username: str
    password: str
    otp: str | None = None


class AssetRequest(BaseModel):
    name: str
    hostname: str
    platform: str = "windows"
    node_id: str | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    protocol: str | None = Field(default=None, pattern="^(rdp|ssh|sftp|winrm|vnc|telnet|database|k8s)?$")
    metadata: dict = Field(default_factory=dict)


class AccountRequest(BaseModel):
    asset_id: str
    name: str
    username: str
    protocol: str = Field(pattern="^(rdp|ssh|sftp|winrm|vnc|telnet)$")
    secret: str = Field(min_length=1)


class PolicyRequest(BaseModel):
    name: str
    subject_ids: list[str] = []
    asset_ids: list[str] = []
    account_ids: list[str] = []
    protocols: list[str] = []
    actions: list[str] = []
    effect: str = Field(default="allow", pattern="^(allow|deny)$")
    valid_from: datetime | None = None
    valid_until: datetime | None = None


class ConnectionRequest(BaseModel):
    asset_id: str
    account_id: str
    protocol: str = Field(pattern="^(rdp|ssh|telnet|vnc)$")
    actions: list[str] = ["connect"]


class AgentHeartbeat(BaseModel):
    inventory: dict = {}


class MfaVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


# Read-only job types the agent is allowed to execute. Write/destructive
# Read-only collectors plus one reviewed write job (session.logoff, which
# requires an explicit session_id payload). Everything else stays behind the
# legacy ActionEngine until a reviewed allowlist and confirmation flow exist.
ALLOWED_JOB_TYPES = {"system.info", "process.list", "service.list", "disk.list", "inventory.collect", "session.list", "session.logoff", "session.disconnect", "network.info", "eventlog.tail", "software.list", "firewall.state", "agent.update", "windows.features", "scheduled.tasks", "local.users", "shares.list", "hotfix.list", "ports.list", "startup.programs", "hyperv.vms", "service.control"}


class JobCreateRequest(BaseModel):
    agent_id: str
    job_type: str = Field(min_length=3, max_length=64)
    payload: dict = {}


class AgentJobResult(BaseModel):
    status: str = Field(default="succeeded", pattern="^(succeeded|failed)$")
    result: dict | list = {}
    error: str | None = None


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=128)
    password: str = Field(min_length=12, max_length=256)
    role: str = Field(default="viewer", pattern="^(admin|operator|viewer)$")
    full_name: str = Field(default="", max_length=255)


class UserRoleRequest(BaseModel):
    role: str = Field(pattern="^(admin|operator|viewer)$")


class UserPasswordRequest(BaseModel):
    new_password: str = Field(min_length=12, max_length=256)


def _set_session(response: Response, user_id: str) -> str:
    raw = new_token()
    expires = datetime.now(UTC) + timedelta(seconds=settings.session_ttl_seconds)
    with db_session() as db:
        db.add(AppSession(id=uuid.uuid4().hex, user_id=user_id, token_hash=token_hash(raw), expires_at=expires, revoked=False))
    response.set_cookie("asaas_v1_session", raw, httponly=True, secure=settings.secure_cookies, samesite="lax", max_age=settings.session_ttl_seconds, path="/")
    return raw


def _expired(value: datetime) -> bool:
    current = value if value.tzinfo else value.replace(tzinfo=UTC)
    return current <= datetime.now(UTC)


def _current_user(session_cookie: str | None = Cookie(default=None, alias="asaas_v1_session"), authorization: str | None = Header(default=None)) -> User:
    raw = session_cookie or (authorization[7:] if authorization and authorization.lower().startswith("bearer ") else None)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    with db_session() as db:
        row = db.scalar(select(AppSession).where(AppSession.token_hash == token_hash(raw), AppSession.revoked.is_(False)))
        if not row or _expired(row.expires_at):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
        user = db.get(User, row.user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User disabled")
        db.expunge(user)
        return user


def _bootstrap_token(token: str | None) -> None:
    if not settings.bootstrap_token or not token or not secrets.compare_digest(token, settings.bootstrap_token):
        raise HTTPException(status_code=403, detail="Bootstrap is disabled or token is invalid")


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "asaas-control-plane", "authenticated": False}


# --- First-run setup wizard (appliance) ---------------------------------------
# Public endpoints that exist only until the first administrator is created.
# After that they return 409 forever — no token required because the appliance
# binds localhost and whoever reaches the console first owns the box anyway.


class SetupCompleteRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=12, max_length=256)
    full_name: str = Field(default="", max_length=128)
    license_token: str | None = Field(default=None, max_length=8192)


@router.get("/setup/status")
def setup_status() -> dict:
    with db_session() as db:
        total = db.scalar(select(func.count()).select_from(User)) or 0
    state = get_license_state()
    return {"needs_setup": total == 0, "user_count": total, "license": state.to_dict()}


@router.post("/setup/complete", status_code=201)
def setup_complete(payload: SetupCompleteRequest, response: Response) -> dict:
    username = payload.username.strip()
    with db_session() as db:
        if db.scalar(select(User.id).limit(1)):
            raise HTTPException(status_code=409, detail="Setup already completed")
        user = User(id=uuid.uuid4().hex, username=username, password_hash=hash_password(payload.password), is_admin=True, role="admin", full_name=payload.full_name or username, created_at=datetime.now(UTC))
        db.add(user)
        db.flush()
        append_audit(db, actor_id=user.id, action="setup.complete", payload={"username": username})
        user_id = user.id

    if payload.license_token:
        try:
            lic = activate_license(payload.license_token)
        except LicenseError as exc:
            raise HTTPException(status_code=400, detail=f"Administrator created, but the license was rejected: {exc}") from exc
        with db_session() as db:
            append_audit(db, actor_id=user_id, action="license.activate", target_id=lic.license_id, payload={"tier": lic.tier, "source": "setup"})

    _set_session(response, user_id)
    return {"authenticated": True, "user_id": user_id, "username": username}


@router.post("/auth/bootstrap", status_code=201)
def bootstrap(payload: BootstrapRequest, x_bootstrap_token: str | None = Header(default=None)) -> dict:
    _bootstrap_token(x_bootstrap_token)
    with db_session() as db:
        if db.scalar(select(User.id).limit(1)):
            raise HTTPException(status_code=409, detail="An administrator already exists")
        user = User(id=uuid.uuid4().hex, username=payload.username, password_hash=hash_password(payload.password), is_admin=True, role="admin", full_name=payload.username, created_at=datetime.now(UTC))
        db.add(user)
        append_audit(db, actor_id=user.id, action="auth.bootstrap")
        return {"id": user.id, "username": user.username}


@router.post("/auth/login")
def login(payload: LoginRequest, request: Request, response: Response) -> dict:
    key = _login_throttle_key(request, payload.username)
    now = time.time()
    attempts = [t for t in _login_attempts.get(key, []) if now - t < _LOGIN_WINDOW_SEC]
    if len(attempts) >= _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many login attempts; try again later")

    def _fail(detail: str) -> None:
        attempts.append(time.time())
        _login_attempts[key] = attempts
        raise HTTPException(status_code=401, detail=detail)

    with db_session() as db:
        user = db.scalar(select(User).where(User.username == payload.username))
        if not user or not user.is_active:
            _fail("Invalid credentials")
        password_ok = verify_password(user.password_hash, payload.password)
        upgraded = False
        if not password_ok and user.legacy_password:
            # Transitional: imported app_users still carry PBKDF2 credentials.
            password_ok = verify_legacy_password(user.legacy_password, payload.password)
            upgraded = password_ok
        if not password_ok:
            _fail("Invalid credentials")
        if upgraded:
            user.password_hash = hash_password(payload.password)
            user.legacy_password = None
        if user.mfa_secret:
            if not payload.otp:
                _fail("MFA required")
            import pyotp
            if not pyotp.TOTP(user.mfa_secret).verify(payload.otp):
                _fail("Invalid MFA code")
        user_id = user.id
    _login_attempts.pop(key, None)
    _set_session(response, user_id)
    return {"authenticated": True, "user_id": user_id}


@router.post("/auth/logout")
def logout(response: Response, session_cookie: str | None = Cookie(default=None, alias="asaas_v1_session")) -> dict:
    if session_cookie:
        with db_session() as db:
            row = db.scalar(select(AppSession).where(AppSession.token_hash == token_hash(session_cookie)))
            if row:
                row.revoked = True
    response.delete_cookie("asaas_v1_session", path="/")
    return {"authenticated": False}


@router.get("/auth/me")
def me(user: User = Depends(_current_user)) -> dict:
    return {"id": user.id, "username": user.username, "is_admin": user.is_admin, "mfa_enabled": bool(user.mfa_secret)}


@router.post("/auth/mfa/setup")
def setup_mfa(user: User = Depends(_current_user)) -> dict:
    import pyotp
    if user.mfa_secret:
        raise HTTPException(status_code=409, detail="MFA is already enabled")
    secret = pyotp.random_base32()
    with db_session() as db:
        row = db.get(User, user.id)
        row.mfa_secret = secret
    return {"enabled": True, "secret": secret, "otpauth_uri": pyotp.TOTP(secret).provisioning_uri(name=user.username, issuer_name="ASAAS")}


@router.post("/auth/mfa/verify")
def verify_mfa(payload: MfaVerifyRequest, user: User = Depends(_current_user)) -> dict:
    import pyotp
    if not user.mfa_secret or not pyotp.TOTP(user.mfa_secret).verify(payload.code):
        raise HTTPException(status_code=401, detail="Invalid MFA code")
    return {"verified": True}


@router.get("/assets")
def list_assets(_: User = Depends(_current_user)) -> list[dict]:
    with db_session() as db:
        return [
            {
                "id": x.id,
                "name": x.name,
                "hostname": x.hostname,
                "platform": x.platform,
                "port": x.port,
                "protocol": x.protocol,
                "metadata": json.loads(x.metadata_json or "{}"),
                "status": x.status,
                "node_id": x.node_id,
                "created_at": x.created_at.isoformat() if x.created_at else None,
            }
            for x in db.scalars(select(Asset).order_by(Asset.name))
        ]


@router.post("/assets", status_code=201)
def create_asset(payload: AssetRequest, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    with db_session() as db:
        asset = Asset(
            id=uuid.uuid4().hex,
            name=payload.name,
            hostname=payload.hostname,
            platform=payload.platform,
            node_id=payload.node_id,
            port=payload.port,
            protocol=payload.protocol,
            metadata_json=json.dumps(payload.metadata, sort_keys=True),
            status="unknown",
            created_at=datetime.now(UTC),
        )
        db.add(asset)
        append_audit(db, actor_id=user.id, action="asset.create", target_id=asset.id, payload=payload.model_dump())
        return {"id": asset.id, "name": asset.name, "hostname": asset.hostname, "port": asset.port, "protocol": asset.protocol, "status": asset.status}


@router.get("/accounts")
def list_accounts(_: User = Depends(_current_user)) -> list[dict]:
    with db_session() as db:
        assets = {a.id: a for a in db.scalars(select(Asset))}
        return [{"id": x.id, "asset_id": x.asset_id, "asset_name": assets[x.asset_id].name if x.asset_id in assets else x.asset_id, "name": x.name, "username": x.username, "protocol": x.protocol, "created_at": x.created_at, "has_secret": bool(x.secret_blob)} for x in db.scalars(select(Account).order_by(Account.name))]


@router.post("/accounts", status_code=201)
def create_account(payload: AccountRequest, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    with db_session() as db:
        if not db.get(Asset, payload.asset_id):
            raise HTTPException(status_code=404, detail="Asset not found")
        sealed = EnvelopeVault(settings.vault_key()).seal(payload.secret.encode(), account_id=payload.asset_id)
        account = Account(id=uuid.uuid4().hex, asset_id=payload.asset_id, name=payload.name, username=payload.username, protocol=payload.protocol, secret_blob=EnvelopeVault.dumps(sealed), created_at=datetime.now(UTC))
        db.add(account)
        append_audit(db, actor_id=user.id, action="account.create", target_id=account.id, payload={"asset_id": payload.asset_id, "protocol": payload.protocol})
        return {"id": account.id, "asset_id": account.asset_id, "name": account.name, "username": account.username, "protocol": account.protocol}


@router.post("/accounts/{account_id}/reveal")
def reveal_account_secret(account_id: str, user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    with db_session() as db:
        account = db.get(Account, account_id)
        if not account or not account.secret_blob:
            raise HTTPException(status_code=404, detail="Account or stored secret not found")
        try:
            # AAD binds the secret to the asset id (see create_account).
            secret = EnvelopeVault(settings.vault_key()).open(
                EnvelopeVault.loads(account.secret_blob), account_id=account.asset_id
            ).decode("utf-8")
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Unable to decrypt stored secret") from exc
        asset = db.get(Asset, account.asset_id)
        append_audit(db, actor_id=user.id, action="account.secret_reveal", target_id=account.id, payload={"asset_id": account.asset_id, "username": account.username})
        return {"account_id": account.id, "username": account.username, "protocol": account.protocol, "asset_name": asset.name if asset else account.asset_id, "secret": secret}


@router.delete("/accounts/{account_id}")
def delete_account(account_id: str, user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    with db_session() as db:
        account = db.get(Account, account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        db.delete(account)
        append_audit(db, actor_id=user.id, action="account.delete", target_id=account_id)
        return {"deleted": True, "account_id": account_id}


@router.get("/access-policies")
def list_policies(_: User = Depends(_current_user)) -> list[dict]:
    with db_session() as db:
        return [{"id": x.id, "name": x.name, "effect": x.effect, "subject_ids": json.loads(x.subject_ids), "asset_ids": json.loads(x.asset_ids), "account_ids": json.loads(x.account_ids), "protocols": json.loads(x.protocols), "actions": json.loads(x.actions), "valid_from": x.valid_from, "valid_until": x.valid_until} for x in db.scalars(select(AccessPolicyRow).order_by(AccessPolicyRow.name))]


@router.post("/access-policies", status_code=201)
def create_policy(payload: PolicyRequest, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    with db_session() as db:
        item = AccessPolicyRow(id=uuid.uuid4().hex, name=payload.name, subject_ids=json.dumps(payload.subject_ids), asset_ids=json.dumps(payload.asset_ids), account_ids=json.dumps(payload.account_ids), protocols=json.dumps(payload.protocols), actions=json.dumps(payload.actions), effect=payload.effect, valid_from=payload.valid_from, valid_until=payload.valid_until)
        db.add(item)
        append_audit(db, actor_id=user.id, action="access_policy.create", target_id=item.id, payload=payload.model_dump(mode="json"))
        return {"id": item.id, "name": item.name, "effect": item.effect}


@router.post("/connection-tokens")
def issue_connection_token(payload: ConnectionRequest, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    if not settings.gateway_token:
        raise HTTPException(status_code=503, detail="Session gateway is not configured")
    with db_session() as db:
        account = db.get(Account, payload.account_id)
        if not account or account.asset_id != payload.asset_id or account.protocol != payload.protocol:
            raise HTTPException(status_code=404, detail="Account binding not found")
        policies = []
        for row in db.scalars(select(AccessPolicyRow)):
            policies.append(AccessPolicy(frozenset(json.loads(row.subject_ids)), frozenset(json.loads(row.asset_ids)), frozenset(json.loads(row.account_ids)), frozenset(json.loads(row.protocols)), frozenset(json.loads(row.actions)), row.valid_from, row.valid_until, row.effect))
        context = AccessContext(user.id, frozenset(), payload.asset_id, payload.account_id, payload.protocol, "connect", datetime.now(UTC))
        if not user.is_admin and not PermissionEngine(policies).is_allowed(context):
            raise HTTPException(status_code=403, detail="Access policy denied")
        token = _connection_store.issue(user_id=user.id, asset_id=payload.asset_id, account_id=payload.account_id, protocol=payload.protocol, actions=frozenset(payload.actions), ttl=timedelta(seconds=settings.connection_token_ttl_seconds))
        append_audit(db, actor_id=user.id, action="connection_token.issue", target_id=payload.asset_id, payload={"account_id": payload.account_id, "protocol": payload.protocol})
        return {"token": token, "expires_in": settings.connection_token_ttl_seconds, "gateway": "external"}


@router.post("/gateway/connection-tokens/consume")
def consume_connection_token(payload: dict, x_gateway_token: str | None = Header(default=None)) -> dict:
    if not settings.gateway_token or not x_gateway_token or not secrets.compare_digest(x_gateway_token, settings.gateway_token):
        raise HTTPException(status_code=403, detail="Gateway authentication failed")
    try:
        claims = _connection_store.consume(str(payload.get("token", "")), expected_protocol=payload.get("protocol"))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return {"user_id": claims.user_id, "asset_id": claims.asset_id, "account_id": claims.account_id, "protocol": claims.protocol, "actions": sorted(claims.actions), "expires_at": claims.expires_at}


@router.websocket("/gateway/{protocol}")
async def gateway_session(websocket: WebSocket, protocol: str, token: str = "") -> None:
    """Guacd session tunnel: one-time connection token -> sealed secret -> guacd.

    The browser speaks the Guacamole protocol over this WebSocket (see
    guacamole-common-js ``WebSocketTunnel``); this endpoint consumes the token,
    resolves credentials server-side (they never reach the browser), runs the
    guacd handshake, then pumps instructions both ways. Requires
    ``ASAAS_GUACD_HOST`` — otherwise the socket closes with 1013.
    """
    # guacamole-common-js always offers the "guacamole" subprotocol; browsers
    # reject the handshake if the server does not echo one back.
    offered = websocket.headers.get("sec-websocket-protocol", "")
    subprotocol = "guacamole" if "guacamole" in offered else None
    await websocket.accept(subprotocol=subprotocol)

    async def _close(code: int, reason: str) -> None:
        try:
            await websocket.close(code=code, reason=reason)
        except Exception:
            pass

    if protocol not in SUPPORTED_PROTOCOLS:
        await _close(1008, f"Unsupported protocol: {protocol}")
        return
    if not gateway_enabled():
        await _close(1013, "Session gateway is not configured (ASAAS_GUACD_HOST)")
        return
    try:
        claims = _connection_store.consume(token, expected_protocol=protocol)
    except ValueError as exc:
        await _close(1008, str(exc))
        return

    account: Account | None = None
    asset: Asset | None = None
    secret = ""
    with db_session() as db:
        account = db.get(Account, claims.account_id)
        asset = db.get(Asset, claims.asset_id)
        if not account or not asset or account.asset_id != asset.id or account.protocol != protocol:
            await _close(1008, "Account/asset binding not found")
            return
        if not account.secret_blob:
            await _close(1008, "Account has no stored credential")
            return
        try:
            secret = EnvelopeVault(settings.vault_key()).open(
                EnvelopeVault.loads(account.secret_blob), account_id=asset.id
            ).decode("utf-8")
        except Exception:
            await _close(1011, "Unable to decrypt stored credential")
            return
        append_audit(db, actor_id=claims.user_id, action="gateway.session_open", target_id=asset.id, payload={"account_id": account.id, "protocol": protocol, "account": account.username})

    params = {
        "hostname": asset.hostname,
        "port": str(asset.port or DEFAULT_PORTS.get(protocol, "")),
        "username": account.username,
        "password": secret,
        "domain": "",
    }
    try:
        session = await open_session(protocol, params)
    except Exception as exc:
        log.warning("guacd connect failed for asset %s: %s", asset.id, exc)
        with db_session() as db:
            append_audit(db, actor_id=claims.user_id, action="gateway.session_failed", target_id=asset.id, payload={"protocol": protocol, "error": str(exc)[:200]})
        await _close(1011, "Upstream gateway connection failed")
        return

    async def _recv():
        try:
            message = await websocket.receive_text()
        except WebSocketDisconnect:
            return None
        # guacamole-common-js tunnels send internal keep-alive pings as
        # instructions with an empty opcode; echo them back like the official
        # servlet does instead of forwarding noise to guacd.
        if isinstance(message, str) and message.endswith(";"):
            try:
                opcode, args = parse_instruction(message)
            except (ValueError, IndexError):
                opcode, args = "", []
            if opcode == "":
                if args and args[0] == "ping":
                    await websocket.send_text(message)
                return await _recv()
        return message

    recorder = None
    if session_recording.recording_enabled():
        try:
            recorder = session_recording.SessionRecorder(
                uuid.uuid4().hex,
                protocol=protocol,
                asset_id=asset.id,
                account_id=account.id,
                user_id=claims.user_id,
            )
        except Exception as exc:
            log.warning("recording init failed: %s", exc)

    async def _send(text: str) -> None:
        await websocket.send_text(text)

    try:
        pump_out = asyncio.create_task(session.pump_to_client(_send, recorder=recorder))
        pump_in = asyncio.create_task(session.pump_from_client(_recv))
        done, pending = await asyncio.wait({pump_out, pump_in}, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        for task in done:
            exc = task.exception()
            if exc:
                log.debug("gateway pump ended: %s", exc)
    finally:
        session.close()
        if recorder is not None:
            try:
                recorder.close()
            except Exception:
                pass
        with db_session() as db:
            append_audit(db, actor_id=claims.user_id, action="gateway.session_close", target_id=asset.id, payload={"protocol": protocol})
        await _close(1000, "session ended")


@router.get("/sessions")
def list_sessions(_: User = Depends(_current_user)) -> dict:
    """Interactive sessions reported by agent ``session.list`` collectors.

    Data is as fresh as each agent's last successful collection — the
    ``collected_at`` field per item makes staleness explicit. Agents that
    never ran the collector contribute nothing (no fabricated rows).
    """
    items: list[dict] = []
    with db_session() as db:
        agents = {a.id: a for a in db.scalars(select(Agent))}
        for job in db.scalars(
            select(AgentJob)
            .where(AgentJob.job_type == "session.list", AgentJob.status == "succeeded", AgentJob.result_json.is_not(None))
            .order_by(AgentJob.completed_at.desc())
        ):
            agent = agents.get(job.agent_id)
            if agent is None or agent.id in {i["agent_id"] for i in items}:
                continue
            try:
                payload = json.loads(job.result_json)
            except (TypeError, ValueError):
                continue
            result = payload.get("result") if isinstance(payload, dict) else payload
            rows = result if isinstance(result, list) else (result.get("sessions") if isinstance(result, dict) else None)
            if not isinstance(rows, list):
                continue
            for s in rows:
                if not isinstance(s, dict):
                    continue
                items.append({
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "agent_status": agent.status,
                    "collected_at": job.completed_at.isoformat() if job.completed_at else None,
                    "session_id": s.get("id"),
                    "session_name": s.get("session_name"),
                    "username": s.get("username"),
                    "state": s.get("state"),
                    "current": bool(s.get("current")),
                })
    return {"items": items, "count": len(items), "source": "agent_collectors"}


class SessionTerminateRequest(BaseModel):
    agent_id: str
    session_id: int = Field(gt=0)


def _queue_session_job(user: User, agent_id: str, session_id: int, job_type: str) -> dict:
    _require_writer(user)
    with db_session() as db:
        if db.get(Agent, agent_id) is None:
            raise HTTPException(status_code=404, detail="Agent not found")
    job_payload = json.dumps({"session_id": session_id}, sort_keys=True, separators=(",", ":"))
    job_id = uuid.uuid4().hex
    signature = get_job_signer().sign(_job_signature_payload(job_id, agent_id, job_type, job_payload)).hex()
    with db_session() as db:
        job = AgentJob(id=job_id, agent_id=agent_id, job_type=job_type, payload_json=job_payload, signature=signature, created_by=user.username, created_at=datetime.now(UTC))
        db.add(job)
        append_audit(db, actor_id=user.id, action=f"session.{job_type.split('.', 1)[1]}", target_id=job_id, payload={"agent_id": agent_id, "session_id": session_id})
    return {"job_id": job_id, "status": "queued", "agent_id": agent_id, "session_id": session_id, "job_type": job_type}


@router.post("/sessions/terminate", status_code=202)
def terminate_session(payload: SessionTerminateRequest, user: User = Depends(_current_user)) -> dict:
    """Queue a signed ``session.logoff`` job for the agent hosting the session.

    Termination is asynchronous: the agent picks the job up on its next
    poll, verifies the Ed25519 signature, and runs ``logoff <id>`` locally.
    """
    return _queue_session_job(user, payload.agent_id, payload.session_id, "session.logoff")


@router.post("/sessions/disconnect", status_code=202)
def disconnect_session(payload: SessionTerminateRequest, user: User = Depends(_current_user)) -> dict:
    """Queue a signed ``session.disconnect`` job (WTSDisconnectSession)."""
    return _queue_session_job(user, payload.agent_id, payload.session_id, "session.disconnect")


@router.post("/sessions/{session_id}/terminate")
def terminate_session_legacy_path(session_id: str, _: User = Depends(_current_user)) -> dict:
    raise HTTPException(status_code=410, detail="Use POST /sessions/terminate with {agent_id, session_id}")


@router.get("/recordings")
def list_recordings(user: User = Depends(_current_user)) -> dict:
    items = session_recording.list_recordings()
    if not user.is_admin:
        items = [i for i in items if i.get("user_id") == user.id]
    return {"items": items, "count": len(items), "storage_status": "active"}


@router.get("/recordings/{recording_id}")
def get_recording(recording_id: str, user: User = Depends(_current_user)) -> dict:
    meta = session_recording.get_meta(recording_id)
    if meta is None or (not user.is_admin and meta.get("user_id") != user.id):
        raise HTTPException(status_code=404, detail="Recording not found")
    return meta


@router.delete("/recordings/{recording_id}", status_code=204)
def delete_recording(recording_id: str, user: User = Depends(_current_user)) -> Response:
    _require_admin(user)
    if not session_recording.delete_recording(recording_id):
        raise HTTPException(status_code=404, detail="Recording not found")
    return Response(status_code=204)


@router.websocket("/recordings/{recording_id}/replay")
async def replay_recording(websocket: WebSocket, recording_id: str, user: User = Depends(_current_user)) -> None:
    """Stream a recorded guacd->client instruction stream back to a client.

    The replaying client still performs its own Guacamole handshake against
    this socket; inbound instructions are ignored and recorded outbound
    instructions are replayed paced by their original timing. Non-admin users
    may only replay their own recordings.
    """
    meta = session_recording.get_meta(recording_id)
    if meta is None or (not user.is_admin and meta.get("user_id") != user.id):
        raise HTTPException(status_code=404, detail="Recording not found")
    offered = websocket.headers.get("sec-websocket-protocol", "")
    subprotocol = "guacamole" if "guacamole" in offered else None
    await websocket.accept(subprotocol=subprotocol)

    async def _recv():
        try:
            return await websocket.receive_text()
        except WebSocketDisconnect:
            return None

    async def _send(text: str) -> None:
        await websocket.send_text(text)

    pump = asyncio.create_task(session_recording.stream_replay(recording_id, _send))
    drain = asyncio.create_task(_recv())
    try:
        done, pending = await asyncio.wait({pump, drain}, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
    finally:
        try:
            await websocket.close(code=1000, reason="replay ended")
        except Exception:
            pass


@router.post("/directory/sync")
def sync_directory(user: User = Depends(_current_user)) -> dict:
    """Pull AD/LDAP users into the ``directory_users`` read model.

    Requires ASAAS_LDAP_URL + ASAAS_LDAP_BASE_DN (+ optional bind creds);
    returns 503 when unconfigured or ldap3 is unavailable.
    """
    _require_admin(user)
    from . import directory

    try:
        result = directory.sync_directory()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Directory sync failed: {exc}") from exc
    with db_session() as db:
        append_audit(db, actor_id=user.id, action="directory.sync", payload=result)
    return result


@router.get("/directory/users")
def list_directory_users(user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    from .models import DirectoryUser

    with db_session() as db:
        rows = list(db.scalars(select(DirectoryUser).order_by(DirectoryUser.username)))
    return {
        "items": [
            {
                "id": r.id,
                "username": r.username,
                "display_name": r.display_name,
                "email": r.email,
                "groups": json.loads(r.groups_json or "[]"),
                "source": r.source,
                "synced_at": r.synced_at,
            }
            for r in rows
        ],
        "count": len(rows),
    }


@router.get("/users")
def list_users(_: User = Depends(_current_user)) -> list[dict]:
    with db_session() as db:
        return [{"id": x.id, "username": x.username, "role": x.role or ("admin" if x.is_admin else "viewer"), "full_name": x.full_name or "", "is_admin": x.is_admin, "is_active": x.is_active, "mfa_enabled": bool(x.mfa_secret), "created_at": x.created_at} for x in db.scalars(select(User).order_by(User.username))]


@router.post("/users", status_code=201)
def create_user(payload: UserCreateRequest, user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    username = payload.username.strip()
    with db_session() as db:
        if db.scalar(select(User.id).where(User.username == username)):
            raise HTTPException(status_code=409, detail="Username already exists")
        user_count = db.scalar(select(func.count()).select_from(User)) or 0
    _check_capacity("users", user_count)
    with db_session() as db:
        item = User(id=uuid.uuid4().hex, username=username, password_hash=hash_password(payload.password), is_admin=payload.role == "admin", role=payload.role, full_name=payload.full_name, created_at=datetime.now(UTC))
        db.add(item)
        append_audit(db, actor_id=user.id, action="user.create", target_id=item.id, payload={"username": username, "role": payload.role})
        return {"id": item.id, "username": item.username, "role": item.role}


@router.post("/users/{username}/role")
def update_user_role(username: str, payload: UserRoleRequest, user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    with db_session() as db:
        row = db.scalar(select(User).where(User.username == username))
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        row.role = payload.role
        row.is_admin = payload.role == "admin"
        append_audit(db, actor_id=user.id, action="user.role_update", target_id=row.id, payload={"username": username, "role": payload.role})
        return {"username": row.username, "role": row.role}


@router.post("/users/{username}/password")
def update_user_password(username: str, payload: UserPasswordRequest, user: User = Depends(_current_user)) -> dict:
    target = db_scalar_user(username)
    is_self = target and target.id == user.id
    if not is_self:
        _require_admin(user)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    with db_session() as db:
        row = db.get(User, target.id)
        row.password_hash = hash_password(payload.new_password)
        row.legacy_password = None
        append_audit(db, actor_id=user.id, action="user.password_reset", target_id=row.id, payload={"username": username, "self": is_self})
        return {"username": row.username, "updated": True}


@router.post("/users/{username}/status")
def update_user_status(username: str, payload: dict, user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    is_active = bool(payload.get("is_active"))
    with db_session() as db:
        row = db.scalar(select(User).where(User.username == username))
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        if row.id == user.id and not is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        if not is_active and row.role == "admin" and row.is_active:
            active_admins = [u for u in db.scalars(select(User).where(User.is_active.is_(True))) if u.role == "admin" or u.is_admin]
            if len(active_admins) <= 1:
                raise HTTPException(status_code=400, detail="Cannot deactivate the last active administrator")
        row.is_active = is_active
        # Revoke all sessions for a deactivated user.
        if not is_active:
            for sess in db.scalars(select(AppSession).where(AppSession.user_id == row.id, AppSession.revoked.is_(False))):
                sess.revoked = True
        append_audit(db, actor_id=user.id, action="user.status_update", target_id=row.id, payload={"username": username, "is_active": is_active})
        return {"username": row.username, "is_active": row.is_active}


def db_scalar_user(username: str) -> User | None:
    with db_session() as db:
        row = db.scalar(select(User).where(User.username == username))
        if row:
            db.expunge(row)
            return row
    return None


# --- JIT elevation grants (time-boxed privileged access, admin-approved) ---

class JitRequest(BaseModel):
    target_role: str = Field(default="Local Administrator", max_length=128)
    reason: str = Field(default="", max_length=2000)
    duration_mins: int = Field(default=30, ge=1, le=480)
    username: str | None = Field(default=None, max_length=128)


class JitDecision(BaseModel):
    approve: bool = True


def _jit_view(row: JitGrantRow) -> dict:
    now = datetime.now(UTC)
    expires = row.expires_at
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    status = row.status
    if status == "active" and expires is not None and expires <= now:
        status = "expired"
    remaining = max(0, int((expires - now).total_seconds())) if status == "active" and expires else 0
    requested = row.requested_at
    if requested is not None and requested.tzinfo is None:
        requested = requested.replace(tzinfo=UTC)
    decided = row.decided_at
    if decided is not None and decided.tzinfo is None:
        decided = decided.replace(tzinfo=UTC)
    return {
        "id": row.id,
        "user": row.username,
        "user_id": row.user_id,
        "target": row.target_role,
        "target_role": row.target_role,
        "role": row.target_role,
        "reason": row.reason,
        "ticket": row.reason,
        "duration_mins": row.duration_mins,
        "remaining_sec": remaining,
        "status": status.upper(),
        "approver": row.approver,
        "created_at": requested.isoformat() if requested else None,
        "decided_at": decided.isoformat() if decided else None,
        "expires_at": expires.isoformat() if expires else None,
    }


@router.get("/jit-grants")
def list_jit_grants(user: User = Depends(_current_user)) -> dict:
    with db_session() as db:
        query = select(JitGrantRow).order_by(JitGrantRow.requested_at.desc())
        if not user.is_admin:
            query = query.where(JitGrantRow.user_id == user.id)
        rows = list(db.scalars(query))
        return {"ok": True, "grants": [_jit_view(r) for r in rows]}


@router.post("/jit-grants", status_code=201)
def create_jit_grant(payload: JitRequest, user: User = Depends(_current_user)) -> dict:
    now = datetime.now(UTC)
    # Admins may request on behalf of another user; that grant still needs a
    # second admin's approval, mirroring the legacy PAM workflow.
    target_user_id, target_username = user.id, user.username
    on_behalf = False
    if payload.username and payload.username.strip() and payload.username.strip() != user.username:
        if not user.is_admin:
            raise HTTPException(status_code=403, detail="Only admins can request grants for other users")
        with db_session() as db:
            other = db.scalar(select(User).where(User.username == payload.username.strip()))
        if not other or not other.is_active:
            raise HTTPException(status_code=404, detail="Target user not found")
        target_user_id, target_username, on_behalf = other.id, other.username, True
    auto = bool(user.is_admin) and not on_behalf
    row = JitGrantRow(
        id=uuid.uuid4().hex,
        user_id=target_user_id,
        username=target_username,
        target_role=payload.target_role.strip() or "Local Administrator",
        reason=payload.reason.strip(),
        duration_mins=payload.duration_mins,
        status="active" if auto else "pending",
        approver=f"Admin Policy Engine ({user.username})" if auto else "Pending Admin Approval",
        requested_at=now,
        decided_at=now if auto else None,
        expires_at=now + timedelta(minutes=payload.duration_mins) if auto else None,
    )
    with db_session() as db:
        db.add(row)
        append_audit(db, actor_id=user.id, action="jit.request", target_id=row.id, payload={"role": row.target_role, "duration_mins": row.duration_mins, "auto": auto})
    return {"ok": True, "grant": _jit_view(row), "message": "JIT grant activated" if auto else "JIT request submitted for approval"}


@router.post("/jit-grants/{grant_id}/decision")
def decide_jit_grant(grant_id: str, payload: JitDecision, user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    now = datetime.now(UTC)
    with db_session() as db:
        row = db.get(JitGrantRow, grant_id)
        if not row or row.status != "pending":
            raise HTTPException(status_code=404, detail="Pending JIT request not found")
        if payload.approve:
            row.status = "active"
            row.approver = user.username
            row.decided_at = now
            row.expires_at = now + timedelta(minutes=row.duration_mins)
            action = "jit.approve"
        else:
            row.status = "rejected"
            row.approver = user.username
            row.decided_at = now
            action = "jit.reject"
        append_audit(db, actor_id=user.id, action=action, target_id=row.id, payload={"user": row.username})
        return {"ok": True, "grant": _jit_view(row)}


@router.post("/jit-grants/{grant_id}/revoke")
def revoke_jit_grant(grant_id: str, user: User = Depends(_current_user)) -> dict:
    now = datetime.now(UTC)
    with db_session() as db:
        row = db.get(JitGrantRow, grant_id)
        if not row or row.status not in {"active", "pending"}:
            raise HTTPException(status_code=404, detail="Active JIT grant not found")
        if not user.is_admin and row.user_id != user.id:
            raise HTTPException(status_code=403, detail="Cannot revoke another user's grant")
        row.status = "revoked"
        row.decided_at = now
        row.approver = user.username if user.is_admin else row.approver
        append_audit(db, actor_id=user.id, action="jit.revoke", target_id=row.id, payload={"user": row.username})
        return {"ok": True, "grant": _jit_view(row)}


@router.get("/groups")
def list_groups(_: User = Depends(_current_user)) -> list[dict]:
    return []


@router.get("/asset-nodes")
def list_asset_nodes(_: User = Depends(_current_user)) -> list[dict]:
    with db_session() as db:
        ids = sorted({x.node_id for x in db.scalars(select(Asset)) if x.node_id})
        return [{"id": item, "name": item} for item in ids]


@router.post("/system/backup")
def system_backup(user: User = Depends(_current_user)) -> dict:
    """Online backup of the control-plane SQLite database into data/backups/.

    Uses the SQLite backup API so the copy is consistent while the server is
    running. Contains credential material — admin only. When
    ``ASAAS_BACKUP_DEST`` is configured the artifact is also replicated
    off-box (file/sftp/s3); replication failures are reported, not hidden.
    """
    _require_admin(user)
    try:
        result = create_backup(created_by=user.username, actor_id=user.id)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Control-plane database file not found") from None
    from . import replication

    replication_info: dict = {"configured": False}
    try:
        replication_info = replication.replicate_file(result["path"])
    except Exception as exc:  # transport failure — backup itself succeeded
        replication_info = {"configured": True, "error": str(exc)}
    if replication_info.get("configured") and not replication_info.get("error"):
        with db_session() as db:
            append_audit(
                db,
                actor_id=user.id,
                action="system.backup.replicate",
                target_id=result["file"],
                payload={"scheme": replication_info.get("scheme"), "target": replication_info.get("target")},
            )
    result["replication"] = replication_info
    return result


@router.get("/system/backup/replication")
def backup_replication_status(user: User = Depends(_current_user)) -> dict:
    """Whether off-box backup replication is configured (no secrets)."""
    _require_admin(user)
    from . import replication

    return replication.replication_status()


# --- License & entitlements ---------------------------------------------------


def _check_capacity(kind: str, current: int) -> None:
    """Enforce license limits (max_agents / max_users). ``None`` = unlimited."""
    limit = get_license_state().limits.get(f"max_{kind}")
    if limit is not None and current >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"License limit reached (max_{kind}={limit}). Upgrade your ASAAS plan.",
        )


class LicenseActivateRequest(BaseModel):
    token: str = Field(min_length=20, max_length=8192)


@router.get("/license")
def license_status(_: User = Depends(_current_user)) -> dict:
    return get_license_state().to_dict()


@router.post("/license/activate")
def license_activate(payload: LicenseActivateRequest, user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    try:
        lic = activate_license(payload.token)
    except LicenseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    with db_session() as db:
        append_audit(db, actor_id=user.id, action="license.activate", target_id=lic.license_id, payload={"tier": lic.tier, "customer": lic.customer, "expires_at": lic.expires_at})
    return {"ok": True, "license_id": lic.license_id, "tier": lic.tier, "expires_at": lic.expires_at}


@router.post("/license/deactivate")
def license_deactivate(user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    removed = deactivate_license()
    with db_session() as db:
        append_audit(db, actor_id=user.id, action="license.deactivate", payload={})
    return {"ok": True, "removed": removed}


def _require_agent(agent_id: str, agent_key: str | None) -> Agent:
    if not agent_key:
        raise HTTPException(status_code=401, detail="Agent key required")
    with db_session() as db:
        agent = db.get(Agent, agent_id)
        if not agent or not secrets.compare_digest(agent.enrollment_hash, token_hash(agent_key)):
            raise HTTPException(status_code=401, detail="Invalid agent key")
        db.expunge(agent)
        return agent


def _job_signature_payload(job_id: str, agent_id: str, job_type: str, payload_json: str) -> bytes:
    return f"asaas-job|{job_id}|{agent_id}|{job_type}|{payload_json}".encode()


@router.get("/agents")
def list_agents(_: User = Depends(_current_user)) -> list[dict]:
    with db_session() as db:
        return [{"id": a.id, "name": a.name, "status": a.status, "last_seen_at": a.last_seen_at, "inventory": json.loads(a.inventory_json or "{}")} for a in db.scalars(select(Agent).order_by(Agent.name))]


@router.post("/agents/enroll", status_code=201)
def enroll_agent(name: str, x_agent_enrollment_token: str | None = Header(default=None)) -> dict:
    if not settings.agent_enrollment_token or not x_agent_enrollment_token or not secrets.compare_digest(x_agent_enrollment_token, settings.agent_enrollment_token):
        raise HTTPException(status_code=403, detail="Agent enrollment is disabled or token is invalid")
    with db_session() as db:
        agent_count = db.scalar(select(func.count()).select_from(Agent)) or 0
    _check_capacity("agents", agent_count)
    raw = new_token()
    with db_session() as db:
        agent = Agent(id=uuid.uuid4().hex, name=name, enrollment_hash=token_hash(raw), status="enrolled", inventory_json="{}")
        db.add(agent)
        return {"agent_id": agent.id, "agent_key": raw, "signing_public_key": get_job_signer().public_key_hex(), "warning": "Store this key once; it is not shown again."}


# --- mTLS CA / client certificate issuance (admin only) ---------------------


@router.get("/pki/status")
def pki_status(user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    return ca_status()


@router.post("/pki/ca", status_code=201)
def pki_init_ca(user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    ca_cert, _ = ensure_ca()
    with db_session() as db:
        append_audit(db, actor_id=user.id, action="pki.ca.init", payload={"subject": ca_cert.subject.rfc4514_string()})
    return ca_status()


@router.post("/pki/ca/rotate")
def pki_rotate_ca(user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    result = rotate_ca()
    with db_session() as db:
        append_audit(db, actor_id=user.id, action="pki.ca.rotate")
    return result


@router.get("/pki/ca.crt")
def pki_ca_cert(user: User = Depends(_current_user)) -> Response:
    _require_admin(user)
    pem = ca_cert_pem()
    if pem is None:
        raise HTTPException(status_code=404, detail="PKI CA not initialized; POST /pki/ca first")
    return Response(content=pem, media_type="application/x-pem-file")


@router.post("/agents/{agent_id}/cert", status_code=201)
def issue_agent_cert(agent_id: str, user: User = Depends(_current_user)) -> dict:
    """Issue an mTLS client certificate for an enrolled agent.

    Returns the PEM bundle once; the pair is also persisted under
    ``<pki>/issued/`` for redeploy. Agents present it on their HTTP client
    once the TLS terminator enforces client certificates.
    """
    _require_admin(user)
    with db_session() as db:
        agent = db.get(Agent, agent_id)
        if agent is None:
            raise HTTPException(status_code=404, detail="Agent not found")
        agent_name = agent.name
    issued = issue_client_cert(f"agent-{agent_name}", san_dns=())
    with db_session() as db:
        append_audit(
            db,
            actor_id=user.id,
            action="pki.agent_cert.issue",
            target_id=agent_id,
            payload={"serial": issued.serial, "expires_at": issued.expires_at.isoformat()},
        )
    return {
        "agent_id": agent_id,
        "serial": issued.serial,
        "common_name": issued.common_name,
        "expires_at": issued.expires_at.isoformat(),
        "cert_pem": issued.cert_pem,
        "key_pem": issued.key_pem,
        "paths": {"cert": str(issued.cert_path), "key": str(issued.key_path)},
    }


@router.post("/agents/{agent_id}/heartbeat")
def heartbeat(agent_id: str, payload: AgentHeartbeat, x_agent_key: str | None = Header(default=None)) -> dict:
    _require_agent(agent_id, x_agent_key)
    with db_session() as db:
        agent = db.get(Agent, agent_id)
        agent.last_seen_at = datetime.now(UTC)
        agent.status = "online"
        agent.inventory_json = json.dumps(payload.inventory)
        return {"accepted": True, "server_time": datetime.now(UTC)}


# --- Signed agent jobs -----------------------------------------------------

# --- Agent self-update bundles ------------------------------------------------
#
# Admins upload a signed-channel update package once; agents pull it through an
# authenticated endpoint and only apply it when the *signed job payload* sha256
# matches the bytes they downloaded. The job signature (not the bundle) is the
# trust root — a tampered bundle fails the hash check agent-side.


def _update_bundle_dir() -> Path:
    db_path = resolve_database_path()
    if db_path is None:
        raise HTTPException(status_code=503, detail="SQLite database required for update bundles")
    return db_path.parent / "agent-updates"


def _update_manifest() -> dict | None:
    manifest_path = _update_bundle_dir() / "manifest.json"
    if not manifest_path.is_file():
        return None
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


@router.post("/agents/update-bundle", status_code=201)
async def upload_update_bundle(request: Request, user: User = Depends(_current_user)) -> dict:
    """Upload the agent self-update binary (raw body = the .exe bytes).

    Headers: ``X-Update-Version`` (semver string) and ``X-Update-Sha256``
    (hex digest of the exact bytes — agents verify against it).
    """
    _require_admin(user)
    version = request.headers.get("x-update-version", "").strip()
    expected_sha = request.headers.get("x-update-sha256", "").strip().lower()
    if not version or not expected_sha:
        raise HTTPException(status_code=400, detail="X-Update-Version and X-Update-Sha256 headers are required")
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty bundle body")
    actual_sha = hashlib.sha256(body).hexdigest()
    if actual_sha != expected_sha:
        raise HTTPException(status_code=400, detail=f"sha256 mismatch: body hashes to {actual_sha}")

    bundle_dir = _update_bundle_dir()
    bundle_dir.mkdir(parents=True, exist_ok=True)
    exe_path = bundle_dir / "Asaas.Agent.exe"
    exe_path.write_bytes(body)
    manifest = {
        "version": version,
        "sha256": actual_sha,
        "size_bytes": len(body),
        "file": exe_path.name,
        "uploaded_by": user.username,
        "uploaded_at": datetime.now(UTC).isoformat(),
    }
    (bundle_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    with db_session() as db:
        append_audit(db, actor_id=user.id, action="agent.update_bundle", target_id=version, payload={"sha256": actual_sha, "size_bytes": len(body)})
    return manifest


@router.get("/agents/update-bundle")
def update_bundle_status(_: User = Depends(_current_user)) -> dict:
    manifest = _update_manifest()
    if not manifest:
        return {"available": False}
    return {"available": True, **manifest}


@router.get("/agents/{agent_id}/update")
def download_agent_update(agent_id: str, x_agent_key: str | None = Header(default=None)):
    """Agent-key-authenticated bundle download used by the agent.update job."""
    _require_agent(agent_id, x_agent_key)
    manifest = _update_manifest()
    exe_path = _update_bundle_dir() / "Asaas.Agent.exe"
    if not manifest or not exe_path.is_file():
        raise HTTPException(status_code=404, detail="No agent update bundle published")
    return FileResponse(
        exe_path,
        media_type="application/octet-stream",
        filename="Asaas.Agent.exe",
        headers={"X-Update-Version": str(manifest.get("version", "")), "X-Update-Sha256": str(manifest.get("sha256", ""))},
    )


def _latest_results_map(db, agent_id: str) -> dict:
    """Most recent succeeded result per job_type for an agent (open session)."""
    rows = list(db.scalars(
        select(AgentJob)
        .where(AgentJob.agent_id == agent_id, AgentJob.status == "succeeded", AgentJob.result_json.is_not(None))
        .order_by(AgentJob.completed_at.desc())
    ))
    latest: dict[str, dict] = {}
    for job in rows:
        if job.job_type in latest:
            continue
        try:
            payload = json.loads(job.result_json)
        except (TypeError, ValueError):
            continue
        latest[job.job_type] = {
            "job_id": job.id,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "result": payload.get("result") if isinstance(payload, dict) else payload,
            "error": payload.get("error") if isinstance(payload, dict) else None,
        }
    return latest


@router.get("/agents/{agent_id}/results/latest")
def agent_latest_results(agent_id: str, _: User = Depends(_current_user)) -> dict:
    """Latest succeeded result per collector job type for one agent.

    Agent job results already persist in ``agent_jobs.result_json``; this
    read-model dedupes to the most recent success per ``job_type`` so the UI
    can render real collector output (system.info, service.list, network.info…)
    without replaying job history.
    """
    with db_session() as db:
        agent = db.get(Agent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        latest = _latest_results_map(db, agent_id)
    return {"agent_id": agent_id, "results": latest}


@router.get("/fleet/summary")
def fleet_summary(_: User = Depends(_current_user)) -> dict:
    """Fleet-wide read-model: every agent with status, inventory summary,
    hostname-matched v1 asset, and per-collector latest-result coverage.

    Powers the Overview dashboard with real agent telemetry instead of
    legacy-only metrics. No fabricated values — agents without results
    simply report ``collector_count: 0``.
    """
    with db_session() as db:
        agents = list(db.scalars(select(Agent).order_by(Agent.name)))
        assets = list(db.scalars(select(Asset)))
        entries = []
        for ag in agents:
            try:
                inv = json.loads(ag.inventory_json or "{}")
            except (TypeError, ValueError):
                inv = {}
            if not isinstance(inv, dict):
                inv = {}
            hn = str(inv.get("hostname") or "").lower()
            linked = None
            for a in assets:
                ah = str(a.hostname or "").lower()
                if hn and ah and (ah == hn or ah in hn or hn in ah):
                    linked = {"id": a.id, "name": a.name, "hostname": a.hostname}
                    break
            results = _latest_results_map(db, ag.id)
            completed = [r["completed_at"] for r in results.values() if r.get("completed_at")]
            entries.append({
                "id": ag.id,
                "name": ag.name,
                "status": ag.status,
                "last_seen_at": ag.last_seen_at.isoformat() if ag.last_seen_at else None,
                "hostname": inv.get("hostname"),
                "os": inv.get("os"),
                "process_count": inv.get("process_count"),
                "linked_asset": linked,
                "collector_count": len(results),
                "collectors": sorted(results.keys()),
                "last_collection_at": max(completed) if completed else None,
            })
    return {
        "agents": entries,
        "totals": {
            "agents": len(entries),
            "online": sum(1 for e in entries if e["status"] == "online"),
            "with_results": sum(1 for e in entries if e["collector_count"] > 0),
        },
    }


@router.post("/jobs", status_code=201)
def create_job(payload: JobCreateRequest, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    if payload.job_type not in ALLOWED_JOB_TYPES:
        raise HTTPException(status_code=400, detail=f"Job type not allowed; supported: {sorted(ALLOWED_JOB_TYPES)}")
    job_payload = payload.payload or {}
    if payload.job_type == "agent.update":
        # The signed payload must pin the exact bundle on the server — an
        # agent.update job without a matching published bundle cannot succeed.
        manifest = _update_manifest()
        if not manifest:
            raise HTTPException(status_code=409, detail="No agent update bundle published; upload one via POST /agents/update-bundle")
        if not job_payload:
            job_payload = {"version": manifest["version"], "sha256": manifest["sha256"]}
        elif str(job_payload.get("sha256", "")).lower() != str(manifest["sha256"]).lower() or str(job_payload.get("version")) != str(manifest["version"]):
            raise HTTPException(status_code=400, detail="agent.update payload must match the published bundle version/sha256")
    job_id = uuid.uuid4().hex
    payload_json = json.dumps(job_payload, sort_keys=True, separators=(",", ":"))
    signature = get_job_signer().sign(_job_signature_payload(job_id, payload.agent_id, payload.job_type, payload_json)).hex()
    with db_session() as db:
        if not db.get(Agent, payload.agent_id):
            raise HTTPException(status_code=404, detail="Agent not found")
        job = AgentJob(id=job_id, agent_id=payload.agent_id, job_type=payload.job_type, payload_json=payload_json, signature=signature, created_by=user.username, created_at=datetime.now(UTC))
        db.add(job)
        append_audit(db, actor_id=user.id, action="agent.job_create", target_id=job_id, payload={"agent_id": payload.agent_id, "job_type": payload.job_type})
        return {"id": job.id, "agent_id": job.agent_id, "job_type": job.job_type, "status": "pending"}


@router.get("/jobs")
def list_jobs(agent_id: str | None = None, _: User = Depends(_current_user)) -> list[dict]:
    stmt = select(AgentJob).order_by(AgentJob.created_at.desc())
    if agent_id:
        stmt = stmt.where(AgentJob.agent_id == agent_id)
    with db_session() as db:
        return [{"id": j.id, "agent_id": j.agent_id, "job_type": j.job_type, "status": j.status, "result": json.loads(j.result_json) if j.result_json else None, "created_by": j.created_by, "created_at": j.created_at, "completed_at": j.completed_at} for j in db.scalars(stmt.limit(200))]


@router.post("/agents/{agent_id}/jobs/poll")
def poll_jobs(agent_id: str, x_agent_key: str | None = Header(default=None)) -> dict:
    _require_agent(agent_id, x_agent_key)
    with db_session() as db:
        job = db.scalar(
            select(AgentJob)
            .where(AgentJob.agent_id == agent_id, AgentJob.status == "pending")
            .order_by(AgentJob.created_at.asc())
            .limit(1)
        )
        if not job:
            return {"job": None}
        job.status = "delivered"
        job.delivered_at = datetime.now(UTC)
        return {
            "job": {
                "id": job.id,
                "type": job.job_type,
                "payload": json.loads(job.payload_json),
                # Exact canonical string the signature covers — the agent must
                # verify over these bytes, not a re-serialized JSON object.
                "payload_canonical": job.payload_json,
                "signature": job.signature,
                "signing_public_key": get_job_signer().public_key_hex(),
            }
        }


@router.post("/agents/{agent_id}/jobs/{job_id}/result")
def submit_job_result(agent_id: str, job_id: str, payload: AgentJobResult, x_agent_key: str | None = Header(default=None)) -> dict:
    _require_agent(agent_id, x_agent_key)
    with db_session() as db:
        job = db.get(AgentJob, job_id)
        if not job or job.agent_id != agent_id:
            raise HTTPException(status_code=404, detail="Job not found")
        if job.status not in {"delivered", "pending"}:
            raise HTTPException(status_code=409, detail=f"Job already {job.status}")
        job.status = payload.status
        job.result_json = json.dumps({"result": payload.result, "error": payload.error}, ensure_ascii=False)
        job.completed_at = datetime.now(UTC)
        return {"accepted": True, "job_id": job.id, "status": job.status}


@router.get("/audit/events")
def audit_events(_: User = Depends(_current_user)) -> list[dict]:
    from .models import AuditEvent
    with db_session() as db:
        return [{"sequence": x.sequence, "actor_id": x.actor_id, "action": x.action, "target_id": x.target_id, "payload": json.loads(x.payload_json), "previous_hash": x.previous_hash, "event_hash": x.event_hash, "created_at": x.created_at} for x in db.scalars(select(AuditEvent).order_by(AuditEvent.sequence))]


@router.get("/audit/verify")
def verify_audit(_: User = Depends(_current_user)) -> dict:
    from .models import AuditEvent
    with db_session() as db:
        rows = list(db.scalars(select(AuditEvent).order_by(AuditEvent.sequence)))
    chain = AuditChain(hashlib.sha256((settings.vault_key() + b"/audit")).digest())
    records = []
    from .audit import AuditRecord
    for row in rows:
        records.append(AuditRecord(row.sequence, row.created_at, row.actor_id, row.action, row.target_id, json.loads(row.payload_json), row.previous_hash, row.event_hash))
    result = chain.verify(records)
    return {"chain_intact": result.intact, "failed_index": result.failed_index, "root_signature": result.root_signature}


# --- SFTP data path (paramiko sessions; credentials stay server-side) -------


class SftpOpenRequest(BaseModel):
    asset_id: str
    account_id: str


class SftpPathRequest(BaseModel):
    path: str


class SftpRenameRequest(BaseModel):
    old_path: str
    new_path: str


def _load_policies(db) -> list[AccessPolicy]:
    policies = []
    for row in db.scalars(select(AccessPolicyRow)):
        policies.append(AccessPolicy(frozenset(json.loads(row.subject_ids)), frozenset(json.loads(row.asset_ids)), frozenset(json.loads(row.account_ids)), frozenset(json.loads(row.protocols)), frozenset(json.loads(row.actions)), row.valid_from, row.valid_until, row.effect))
    return policies


def _authorize_file_access(user: User, asset_id: str, account_id: str, action: str) -> None:
    """Admins bypass; others need an allow policy matching action 'sftp'."""
    if user.is_admin:
        return
    with db_session() as db:
        context = AccessContext(user.id, frozenset(), asset_id, account_id, "sftp", action, datetime.now(UTC))
        if not PermissionEngine(_load_policies(db)).is_allowed(context):
            raise HTTPException(status_code=403, detail="Access policy denied")


def _sftp_session_or_404(sid: str, user: User):
    try:
        return sftp_path.get_session(sid, user_id=user.id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="SFTP session not found or expired") from exc


@router.post("/sftp/session", status_code=201)
def sftp_open(payload: SftpOpenRequest, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    with db_session() as db:
        account = db.get(Account, payload.account_id)
        asset = db.get(Asset, payload.asset_id)
        if not account or not asset or account.asset_id != asset.id or account.protocol not in ("ssh", "sftp"):
            raise HTTPException(status_code=404, detail="SSH account/asset binding not found")
        if not account.secret_blob:
            raise HTTPException(status_code=409, detail="Account has no stored credential")
        context = AccessContext(user.id, frozenset(), asset.id, account.id, "sftp", "connect", datetime.now(UTC))
        if not user.is_admin and not PermissionEngine(_load_policies(db)).is_allowed(context):
            raise HTTPException(status_code=403, detail="Access policy denied")
        try:
            secret = EnvelopeVault(settings.vault_key()).open(
                EnvelopeVault.loads(account.secret_blob), account_id=asset.id
            ).decode("utf-8")
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Unable to decrypt stored secret") from exc
        append_audit(db, actor_id=user.id, action="sftp.session_open", target_id=asset.id, payload={"account_id": account.id, "account": account.username})
    try:
        sess = sftp_path.open_session(
            user_id=user.id,
            asset_id=asset.id,
            account_id=account.id,
            hostname=asset.hostname,
            port=asset.port or 22,
            username=account.username,
            password=secret,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        with db_session() as db:
            append_audit(db, actor_id=user.id, action="sftp.session_failed", target_id=asset.id, payload={"error": str(exc)[:200]})
        raise HTTPException(status_code=502, detail=f"SFTP connect failed: {exc}") from exc
    return {"session_id": sess.sid, "asset_id": asset.id, "account": account.username, "ttl_seconds": sftp_path.SESSION_TTL_SECONDS}


@router.get("/sftp/session/{sid}/list")
def sftp_list(sid: str, path: str = "/", user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    sess = _sftp_session_or_404(sid, user)
    _authorize_file_access(user, sess.asset_id, sess.account_id, "list")
    try:
        return {"path": path, "entries": sftp_path.list_dir(sess, path)}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"SFTP list failed: {exc}") from exc


@router.get("/sftp/session/{sid}/stat")
def sftp_stat(sid: str, path: str, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    sess = _sftp_session_or_404(sid, user)
    _authorize_file_access(user, sess.asset_id, sess.account_id, "stat")
    try:
        return sftp_path.stat_path(sess, path)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"SFTP stat failed: {exc}") from exc


@router.get("/sftp/session/{sid}/download")
def sftp_download(sid: str, path: str, user: User = Depends(_current_user)) -> StreamingResponse:
    _require_writer(user)
    sess = _sftp_session_or_404(sid, user)
    _authorize_file_access(user, sess.asset_id, sess.account_id, "download")
    try:
        fh = sftp_path.open_download(sess, path)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"SFTP download failed: {exc}") from exc
    filename = path.rsplit("/", 1)[-1] or "download"
    return StreamingResponse(fh, media_type="application/octet-stream", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.post("/sftp/session/{sid}/upload", status_code=201)
async def sftp_upload(sid: str, path: str, request: Request, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    sess = _sftp_session_or_404(sid, user)
    _authorize_file_access(user, sess.asset_id, sess.account_id, "upload")
    body = await request.body()
    try:
        with sftp_path.open_upload(sess, path) as fh:
            fh.write(body)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"SFTP upload failed: {exc}") from exc
    return {"uploaded": path, "bytes": len(body)}


@router.post("/sftp/session/{sid}/mkdir", status_code=201)
def sftp_mkdir(sid: str, payload: SftpPathRequest, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    sess = _sftp_session_or_404(sid, user)
    _authorize_file_access(user, sess.asset_id, sess.account_id, "mkdir")
    try:
        sftp_path.mkdir(sess, payload.path)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"SFTP mkdir failed: {exc}") from exc
    return {"created": payload.path}


@router.post("/sftp/session/{sid}/rename")
def sftp_rename(sid: str, payload: SftpRenameRequest, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    sess = _sftp_session_or_404(sid, user)
    _authorize_file_access(user, sess.asset_id, sess.account_id, "rename")
    try:
        sftp_path.rename(sess, payload.old_path, payload.new_path)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"SFTP rename failed: {exc}") from exc
    return {"renamed": payload.old_path, "to": payload.new_path}


@router.post("/sftp/session/{sid}/delete")
def sftp_delete(sid: str, payload: SftpPathRequest, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    sess = _sftp_session_or_404(sid, user)
    _authorize_file_access(user, sess.asset_id, sess.account_id, "delete")
    try:
        info = sftp_path.stat_path(sess, payload.path)
        if info["is_dir"]:
            sftp_path.rmdir(sess, payload.path)
        else:
            sftp_path.remove(sess, payload.path)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"SFTP delete failed: {exc}") from exc
    return {"deleted": payload.path}


@router.delete("/sftp/session/{sid}", status_code=204)
def sftp_close(sid: str, user: User = Depends(_current_user)) -> Response:
    _require_writer(user)
    sftp_path.close_session(sid, user_id=user.id)
    return Response(status_code=204)
