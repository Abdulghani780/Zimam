from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    mfa_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AppSession(Base):
    __tablename__ = "app_sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    hostname: Mapped[str] = mapped_column(String(255))
    node_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    platform: Mapped[str] = mapped_column(String(32), default="windows")
    status: Mapped[str] = mapped_column(String(32), default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), index=True)
    name: Mapped[str] = mapped_column(String(128))
    username: Mapped[str] = mapped_column(String(255))
    protocol: Mapped[str] = mapped_column(String(16))
    secret_blob: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AccessPolicyRow(Base):
    __tablename__ = "access_policies"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    subject_ids: Mapped[str] = mapped_column(Text)
    asset_ids: Mapped[str] = mapped_column(Text)
    account_ids: Mapped[str] = mapped_column(Text)
    protocols: Mapped[str] = mapped_column(Text)
    actions: Mapped[str] = mapped_column(Text)
    effect: Mapped[str] = mapped_column(String(16), default="allow")
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    enrollment_hash: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[str] = mapped_column(String(32), default="enrolled")
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    inventory_json: Mapped[str] = mapped_column(Text, default="{}")


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    actor_id: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(255))
    target_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    previous_hash: Mapped[str] = mapped_column(String(64), default="")
    event_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
