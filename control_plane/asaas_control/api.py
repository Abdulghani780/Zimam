from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from .audit import AuditChain
from .config import settings
from .connection_tokens import ConnectionTokenStore
from .identity import verify_legacy_password
from .models import AccessPolicyRow, Account, Agent, AgentJob, AppSession, Asset, User
from .permissions import AccessContext, AccessPolicy, PermissionEngine
from .security import hash_password, new_token, token_hash, verify_password
from .signing import get_job_signer
from .storage import append_audit, db_session
from .vault import EnvelopeVault

router = APIRouter(prefix="/api/v1")

_VALID_ROLES = {"admin", "operator", "viewer"}


def _require_admin(user: User) -> None:
    if not (user.is_admin or user.role == "admin"):
        raise HTTPException(status_code=403, detail="Administrator role required")


def _require_writer(user: User) -> None:
    """Mutating endpoints are open to admin/operator; viewers are read-only."""
    role = user.role or ("admin" if user.is_admin else "viewer")
    if role == "viewer":
        raise HTTPException(status_code=403, detail="Viewer role is read-only")
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
    protocol: str = Field(pattern="^(rdp|ssh|sftp)$")
    actions: list[str] = ["connect"]


class AgentHeartbeat(BaseModel):
    inventory: dict = {}


class MfaVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


# Read-only job types the agent is allowed to execute. Write/destructive
# Read-only collectors plus one reviewed write job (session.logoff, which
# requires an explicit session_id payload). Everything else stays behind the
# legacy ActionEngine until a reviewed allowlist and confirmation flow exist.
ALLOWED_JOB_TYPES = {"system.info", "process.list", "service.list", "disk.list", "inventory.collect", "session.list", "session.logoff", "network.info", "eventlog.tail", "software.list", "firewall.state"}


class JobCreateRequest(BaseModel):
    agent_id: str
    job_type: str = Field(min_length=3, max_length=64)
    payload: dict = {}


class AgentJobResult(BaseModel):
    status: str = Field(default="succeeded", pattern="^(succeeded|failed)$")
    result: dict = {}
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
        return [{"id": x.id, "username": x.username, "role": x.role or ("admin" if x.is_admin else "viewer"), "full_name": x.full_name or "", "is_admin": x.is_admin, "is_active": x.is_active, "mfa_enabled": bool(x.mfa_secret), "created_at": x.created_at} for x in db.scalars(select(User).order_by(User.username))]


@router.post("/users", status_code=201)
def create_user(payload: UserCreateRequest, user: User = Depends(_current_user)) -> dict:
    _require_admin(user)
    username = payload.username.strip()
    with db_session() as db:
        if db.scalar(select(User.id).where(User.username == username)):
            raise HTTPException(status_code=409, detail="Username already exists")
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
    running. Contains credential material — admin only. Off-box replication
    and MinIO retention remain deployment concerns.
    """
    _require_admin(user)
    db_path = settings.database_url.removeprefix("sqlite:///")
    if not os.path.isabs(db_path):
        db_path = os.path.abspath(db_path)
    if not os.path.exists(db_path):
        raise HTTPException(status_code=503, detail="Control-plane database file not found")
    backup_dir = Path(db_path).parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    target = backup_dir / f"control_plane_{stamp}.db"

    counts: dict[str, int] = {}
    src = sqlite3.connect(db_path)
    dst = sqlite3.connect(target)
    try:
        src.backup(dst)
        for (table,) in dst.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ):
            counts[table] = dst.execute(f"SELECT COUNT(*) FROM \"{table}\"").fetchone()[0]
    finally:
        dst.close()
        src.close()

    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    manifest = {
        "created_at": datetime.now(UTC).isoformat(),
        "source": os.path.basename(db_path),
        "file": target.name,
        "sha256": digest,
        "size_bytes": target.stat().st_size,
        "row_counts": counts,
        "created_by": user.username,
    }
    (backup_dir / f"control_plane_{stamp}.manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with db_session() as db:
        append_audit(db, actor_id=user.id, action="system.backup", target_id=target.name, payload={"sha256": digest, "size_bytes": manifest["size_bytes"]})
    return {"file": target.name, "path": str(target), "size_bytes": manifest["size_bytes"], "sha256": digest, "row_counts": counts}


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
    raw = new_token()
    with db_session() as db:
        agent = Agent(id=uuid.uuid4().hex, name=name, enrollment_hash=token_hash(raw), status="enrolled", inventory_json="{}")
        db.add(agent)
        return {"agent_id": agent.id, "agent_key": raw, "signing_public_key": get_job_signer().public_key_hex(), "warning": "Store this key once; it is not shown again."}


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

@router.post("/jobs", status_code=201)
def create_job(payload: JobCreateRequest, user: User = Depends(_current_user)) -> dict:
    _require_writer(user)
    if payload.job_type not in ALLOWED_JOB_TYPES:
        raise HTTPException(status_code=400, detail=f"Job type not allowed; supported: {sorted(ALLOWED_JOB_TYPES)}")
    job_id = uuid.uuid4().hex
    payload_json = json.dumps(payload.payload or {}, sort_keys=True, separators=(",", ":"))
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
