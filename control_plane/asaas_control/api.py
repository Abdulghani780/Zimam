from __future__ import annotations

import hashlib
import json
import secrets
import time
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from .audit import AuditChain
from .config import settings
from .connection_tokens import ConnectionTokenStore
from .models import AccessPolicyRow, Account, Agent, AppSession, Asset, User
from .permissions import AccessContext, AccessPolicy, PermissionEngine
from .security import hash_password, new_token, token_hash, verify_password
from .storage import append_audit, db_session
from .vault import EnvelopeVault

router = APIRouter(prefix="/api/v1")
_connection_store = ConnectionTokenStore(hashlib.sha256((settings.gateway_token or "disabled").encode()).digest())

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


class AccountRequest(BaseModel):
    asset_id: str
    name: str
    username: str
    protocol: str = Field(pattern="^(rdp|ssh|sftp)$")
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
    protocol: str = Field(pattern="^(rdp|ssh|sftp)$")
    actions: list[str] = ["connect"]


class AgentHeartbeat(BaseModel):
    inventory: dict = {}


class MfaVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


def _set_session(response: Response, user_id: str) -> str:
    raw = new_token()
    expires = datetime.now(UTC) + timedelta(seconds=settings.session_ttl_seconds)
    with db_session() as db:
        db.add(AppSession(id=uuid.uuid4().hex, user_id=user_id, token_hash=token_hash(raw), expires_at=expires, revoked=False))
    response.set_cookie("asaas_session", raw, httponly=True, secure=settings.secure_cookies, samesite="lax", max_age=settings.session_ttl_seconds, path="/")
    return raw


def _expired(value: datetime) -> bool:
    current = value if value.tzinfo else value.replace(tzinfo=UTC)
    return current <= datetime.now(UTC)


def _current_user(session_cookie: str | None = Cookie(default=None, alias="asaas_session"), authorization: str | None = Header(default=None)) -> User:
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


@router.post("/auth/bootstrap", status_code=201)
def bootstrap(payload: BootstrapRequest, x_bootstrap_token: str | None = Header(default=None)) -> dict:
    _bootstrap_token(x_bootstrap_token)
    with db_session() as db:
        if db.scalar(select(User.id).limit(1)):
            raise HTTPException(status_code=409, detail="An administrator already exists")
        user = User(id=uuid.uuid4().hex, username=payload.username, password_hash=hash_password(payload.password), is_admin=True, created_at=datetime.now(UTC))
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
        if not user or not user.is_active or not verify_password(user.password_hash, payload.password):
            _fail("Invalid credentials")
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
def logout(response: Response, session_cookie: str | None = Cookie(default=None, alias="asaas_session")) -> dict:
    if session_cookie:
        with db_session() as db:
            row = db.scalar(select(AppSession).where(AppSession.token_hash == token_hash(session_cookie)))
            if row:
                row.revoked = True
    response.delete_cookie("asaas_session", path="/")
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
        return [{"id": x.id, "name": x.name, "hostname": x.hostname, "platform": x.platform, "status": x.status, "node_id": x.node_id} for x in db.scalars(select(Asset).order_by(Asset.name))]


@router.post("/assets", status_code=201)
def create_asset(payload: AssetRequest, user: User = Depends(_current_user)) -> dict:
    with db_session() as db:
        asset = Asset(id=uuid.uuid4().hex, name=payload.name, hostname=payload.hostname, platform=payload.platform, node_id=payload.node_id, status="unknown", created_at=datetime.now(UTC))
        db.add(asset)
        append_audit(db, actor_id=user.id, action="asset.create", target_id=asset.id, payload=payload.model_dump())
        return {"id": asset.id, "name": asset.name, "hostname": asset.hostname, "status": asset.status}


@router.get("/accounts")
def list_accounts(_: User = Depends(_current_user)) -> list[dict]:
    with db_session() as db:
        return [{"id": x.id, "asset_id": x.asset_id, "name": x.name, "username": x.username, "protocol": x.protocol} for x in db.scalars(select(Account).order_by(Account.name))]


@router.post("/accounts", status_code=201)
def create_account(payload: AccountRequest, user: User = Depends(_current_user)) -> dict:
    with db_session() as db:
        if not db.get(Asset, payload.asset_id):
            raise HTTPException(status_code=404, detail="Asset not found")
        sealed = EnvelopeVault(settings.vault_key()).seal(payload.secret.encode(), account_id=payload.asset_id)
        account = Account(id=uuid.uuid4().hex, asset_id=payload.asset_id, name=payload.name, username=payload.username, protocol=payload.protocol, secret_blob=EnvelopeVault.dumps(sealed), created_at=datetime.now(UTC))
        db.add(account)
        append_audit(db, actor_id=user.id, action="account.create", target_id=account.id, payload={"asset_id": payload.asset_id, "protocol": payload.protocol})
        return {"id": account.id, "asset_id": account.asset_id, "name": account.name, "username": account.username, "protocol": account.protocol}


@router.get("/access-policies")
def list_policies(_: User = Depends(_current_user)) -> list[dict]:
    with db_session() as db:
        return [{"id": x.id, "name": x.name, "effect": x.effect, "subject_ids": json.loads(x.subject_ids), "asset_ids": json.loads(x.asset_ids), "account_ids": json.loads(x.account_ids), "protocols": json.loads(x.protocols), "actions": json.loads(x.actions), "valid_from": x.valid_from, "valid_until": x.valid_until} for x in db.scalars(select(AccessPolicyRow).order_by(AccessPolicyRow.name))]


@router.post("/access-policies", status_code=201)
def create_policy(payload: PolicyRequest, user: User = Depends(_current_user)) -> dict:
    with db_session() as db:
        item = AccessPolicyRow(id=uuid.uuid4().hex, name=payload.name, subject_ids=json.dumps(payload.subject_ids), asset_ids=json.dumps(payload.asset_ids), account_ids=json.dumps(payload.account_ids), protocols=json.dumps(payload.protocols), actions=json.dumps(payload.actions), effect=payload.effect, valid_from=payload.valid_from, valid_until=payload.valid_until)
        db.add(item)
        append_audit(db, actor_id=user.id, action="access_policy.create", target_id=item.id, payload=payload.model_dump(mode="json"))
        return {"id": item.id, "name": item.name, "effect": item.effect}


@router.post("/connection-tokens")
def issue_connection_token(payload: ConnectionRequest, user: User = Depends(_current_user)) -> dict:
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


@router.get("/sessions")
def list_sessions(_: User = Depends(_current_user)) -> dict:
    return {"items": [], "count": 0, "gateway_status": "not_configured"}


@router.post("/sessions/{session_id}/terminate")
def terminate_session(session_id: str, _: User = Depends(_current_user)) -> dict:
    raise HTTPException(status_code=501, detail="Session termination is enabled when the gateway adapter is configured")


@router.get("/recordings")
def list_recordings(_: User = Depends(_current_user)) -> dict:
    return {"items": [], "count": 0, "storage_status": "not_configured"}


@router.post("/directory/sync")
def sync_directory(_: User = Depends(_current_user)) -> dict:
    raise HTTPException(status_code=501, detail="AD/LDAP connector is not configured")


@router.get("/users")
def list_users(_: User = Depends(_current_user)) -> list[dict]:
    with db_session() as db:
        return [{"id": x.id, "username": x.username, "is_admin": x.is_admin, "is_active": x.is_active, "mfa_enabled": bool(x.mfa_secret)} for x in db.scalars(select(User).order_by(User.username))]


@router.get("/groups")
def list_groups(_: User = Depends(_current_user)) -> list[dict]:
    return []


@router.get("/asset-nodes")
def list_asset_nodes(_: User = Depends(_current_user)) -> list[dict]:
    with db_session() as db:
        ids = sorted({x.node_id for x in db.scalars(select(Asset)) if x.node_id})
        return [{"id": item, "name": item} for item in ids]


@router.post("/system/backup")
def system_backup(_: User = Depends(_current_user)) -> dict:
    raise HTTPException(status_code=501, detail="Backup worker is not configured; use database and MinIO backup policy")


@router.post("/agents/enroll", status_code=201)
def enroll_agent(name: str, x_agent_enrollment_token: str | None = Header(default=None)) -> dict:
    if not settings.agent_enrollment_token or not x_agent_enrollment_token or not secrets.compare_digest(x_agent_enrollment_token, settings.agent_enrollment_token):
        raise HTTPException(status_code=403, detail="Agent enrollment is disabled or token is invalid")
    raw = new_token()
    with db_session() as db:
        agent = Agent(id=uuid.uuid4().hex, name=name, enrollment_hash=token_hash(raw), status="enrolled", inventory_json="{}")
        db.add(agent)
        return {"agent_id": agent.id, "agent_key": raw, "warning": "Store this key once; it is not shown again."}


@router.post("/agents/{agent_id}/heartbeat")
def heartbeat(agent_id: str, payload: AgentHeartbeat, x_agent_key: str | None = Header(default=None)) -> dict:
    if not x_agent_key:
        raise HTTPException(status_code=401, detail="Agent key required")
    with db_session() as db:
        agent = db.get(Agent, agent_id)
        if not agent or not secrets.compare_digest(agent.enrollment_hash, token_hash(x_agent_key)):
            raise HTTPException(status_code=401, detail="Invalid agent key")
        agent.last_seen_at = datetime.now(UTC)
        agent.status = "online"
        agent.inventory_json = json.dumps(payload.inventory)
        return {"accepted": True, "server_time": datetime.now(UTC)}


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
