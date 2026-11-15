# ASAAS Legacy → Control Plane Migration Plan

**Decision (2026-11-15): gradual migration.** The legacy v2 router
(`backend/app/api/router.py`, ~100 endpoints) remains the compatibility layer for the
local Windows console. Every *new* page or feature must target `/api/v1` in
`control_plane/`. A legacy endpoint is only removed after its v1 replacement is
implemented **and** the consuming page has been switched over.

## Mapping: legacy surface → `/api/v1`

| Legacy area (examples) | v1 equivalent | Status |
|---|---|---|
| `/api/auth/login`, `/logout`, `/me` | `/api/v1/auth/login`, `/logout`, `/me` (+TOTP MFA) | ✅ **login page prefers v1**; bridge below carries the session to legacy endpoints |
| `/api/auth/users*` (create/delete/role/password) | `/api/v1/users` + `/users/{u}/role|password|status` | ✅ **unified in v1** — see identity section |
| `/api/metrics`, `/metrics/history`, `/snapshot`, `/governor/*` | agent `heartbeat` inventory | 🟡 telemetry pipeline not wired to UI |
| `/api/sessions`, `/sessions/disconnect|logoff|shadow` | `/api/v1/sessions`, `POST /sessions/{id}/terminate` | 🟡 terminate returns 501 until gateway lands |
| `/api/users`, `/api/domain/*`, `/api/users/*` (Windows accounts) | `/api/v1/users`, `/api/v1/groups`, `/api/v1/directory/sync` | 🟡 AD/LDAP sync is an open release gate |
| `/api/vault/accounts*` | `/api/v1/assets` + `/api/v1/accounts` (+`/reveal`, `DELETE`) | ✅ **VaultPage migrated** — secrets re-encrypted under control-plane vault; reveal is admin-only + audited |
| `/api/servers*`, `/api/server-groups*` | `/api/v1/assets`, `/api/v1/asset-nodes` | 🟡 **stays legacy for now** — legacy "servers" carry live telemetry (cpu/ram/roles/health) that the v1 Asset model does not; revisit when agent inventory lands |
| `/api/jit/*` | `/api/v1/access-policies` + one-time connection tokens | 🟡 grant workflow partial |
| `/api/audit/*` | `/api/v1/audit/events`, `/audit/verify` | ✅ hash-chained audit exists |
| `/api/servers*`, `/api/server-groups*` | `/api/v1/assets`, `/api/v1/asset-nodes` | 🟡 multi-asset model exists, UI pending |
| `/api/services`, `/api/firewall/*`, `/api/network/*`, `/api/storage/*`, `/api/tasks`, `/api/certificates`, `/api/events`, `/api/hyperv`, `/api/docker`, `/api/roles`, `/api/processes`, `/api/system/*` | agent **signed jobs** (`JobSigner` exists; dispatch/ACK pending) | 🔴 blocked on agent job channel |
| `/api/ports*`, `/api/workspaces/*`, `/api/conflicts`, `/api/quotas`, `/api/action-jobs` | local developer-workspace tooling | ⚪ stays local — not a PAM concern |
| `/api/database/*` explorer | — | ⚪ stays local |
| `/api/ai/diagnose`, `/api/alerts/*`, `/api/notifications` | — | ⚪ stays local |
| `/stitch/*`, `/api/stitch/screens`, `StitchGalleryPage` | removed — design sources and gallery retired | ✅ removed |

## Session bridge (auth slice, implemented)

The two identity stores are separate (control-plane Postgres/SQLite `users` vs
legacy `app_users`), so a single cookie cannot serve both. The bridge:

- v1 sessions use cookie **`asaas_v1_session`** (legacy keeps `asaas_session`).
- `legacy_proxy.py` validates the v1 cookie against the control-plane DB and
  injects `X-ASAAS-Proxy-User: <username>` on forwarded `/api/*` calls;
  client-supplied `X-ASAAS-Proxy-*` headers are always stripped.
- The legacy `_authenticate()` accepts that header **only from loopback** and
  resolves the username in `app_users` — the user must exist locally (same
  username). Browsers cannot forge it (not in CORS allow-headers); a local
  process could, which is acceptable for this appliance threat model.
- Login page tries `/api/v1/auth/login` first, verifies `/api/auth/me` through
  the bridge, and falls back to legacy login on any v1 failure (including when
  the control plane is absent on the legacy origin).

## Identity unification (decision: v1 is the authority)

- `users` gained `role` (admin/operator/viewer), `full_name`, and
  `legacy_password` columns (idempotent `ALTER TABLE` in `init_db`).
- At startup `sync_legacy_identities()` imports `app_users` rows from
  `data/asaas_v2.db` (override path via `ASAAS_LEGACY_DB`), keeping their
  PBKDF2 credential in `legacy_password`.
- `/auth/login` verifies Argon2 first, then the legacy PBKDF2 credential;
  a successful legacy login re-hashes to Argon2 and clears `legacy_password`.
- The proxy forwards `X-ASAAS-Proxy-Role`; the legacy `_authenticate()`
  upserts `app_users` as a **projection** (`db_sync_proxied_user`) with an
  unusable random password — credentials never leave the control plane.
- v1 user-admin endpoints: `POST /users`, `/users/{u}/role`,
  `/users/{u}/password` (self or admin), `/users/{u}/status` (deactivation
  revokes sessions; self-deactivate and last-admin are refused).
- `UsersPage` app-user section reads/writes `/api/v1` exclusively; the
  Windows SAM section stays on legacy endpoints by design.
- Legacy `/api/auth/users*` endpoints remain for compatibility but write to
  the projection only — new code must use `/api/v1/users`.

## Vault slice (implemented)

- `Account.protocol` widened to `rdp|ssh|sftp|winrm|vnc|telnet` (matches the
  BastionService protocol set; connection tokens remain rdp/ssh/sftp only).
- New endpoints: `POST /accounts/{id}/reveal` (admin-only, audited) and
  `DELETE /accounts/{id}` (admin-only, audited); `GET /accounts` now joins
  asset names and exposes `has_secret`/`created_at`.
- `_require_writer` guards all mutating v1 endpoints — viewers are read-only
  (previously any authenticated user could create assets/accounts/policies).
- `VaultPage` migrated: find-or-create asset by name → create account →
  reveal/delete via `/api/v1`. The legacy `vault_credentials` table is
  unused going forward (its AES key differs from the control-plane vault).

## Rules

1. **New UI → `/api/v1` only.** `frontend/src/lib/api.ts` gains a `v1` client; legacy
   calls stay in a clearly-marked `legacy` section until migrated.
2. **Legacy is frozen, not deleted.** Bug fixes allowed; no new endpoints.
3. **Removal gate per endpoint group:** v1 endpoint live + page switched + e2e smoke
   passing. Then delete the legacy route and its service code in the same commit.
4. **Ordering:** auth/users → assets/accounts/policies → connection tokens + gateway →
   sessions/terminate → agent jobs (unblocks all Windows admin actions) → AD sync →
   recordings/replay.
5. The 501/503 release gates in `CONTROL_PLANE.md` remain the definition of done for
   each row above.
