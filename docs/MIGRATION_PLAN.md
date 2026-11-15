# ASAAS Legacy → Control Plane Migration Plan

**Decision (2026-11-15): gradual migration.** The legacy v2 router
(`backend/app/api/router.py`, ~100 endpoints) remains the compatibility layer for the
local Windows console. Every *new* page or feature must target `/api/v1` in
`control_plane/`. A legacy endpoint is only removed after its v1 replacement is
implemented **and** the consuming page has been switched over.

## Mapping: legacy surface → `/api/v1`

| Legacy area (examples) | v1 equivalent | Status |
|---|---|---|
| `/api/auth/login`, `/logout`, `/me` | `/api/v1/auth/login`, `/logout`, `/me` (+TOTP MFA) | ✅ covered — switch pages first |
| `/api/auth/users*` (create/delete/role/password) | `/api/v1/users` (read-only today) | 🟡 user admin writes pending |
| `/api/metrics`, `/metrics/history`, `/snapshot`, `/governor/*` | agent `heartbeat` inventory | 🟡 telemetry pipeline not wired to UI |
| `/api/sessions`, `/sessions/disconnect|logoff|shadow` | `/api/v1/sessions`, `POST /sessions/{id}/terminate` | 🟡 terminate returns 501 until gateway lands |
| `/api/users`, `/api/domain/*`, `/api/users/*` (Windows accounts) | `/api/v1/users`, `/api/v1/groups`, `/api/v1/directory/sync` | 🟡 AD/LDAP sync is an open release gate |
| `/api/vault/accounts*`, `/api/bastion/connect` | `/api/v1/accounts`, `/api/v1/connection-tokens`, `/gateway/connection-tokens/consume` | 🟡 secrets are vault-encrypted; proxy data path 501 |
| `/api/jit/*` | `/api/v1/access-policies` + one-time connection tokens | 🟡 grant workflow partial |
| `/api/audit/*` | `/api/v1/audit/events`, `/audit/verify` | ✅ hash-chained audit exists |
| `/api/servers*`, `/api/server-groups*` | `/api/v1/assets`, `/api/v1/asset-nodes` | 🟡 multi-asset model exists, UI pending |
| `/api/services`, `/api/firewall/*`, `/api/network/*`, `/api/storage/*`, `/api/tasks`, `/api/certificates`, `/api/events`, `/api/hyperv`, `/api/docker`, `/api/roles`, `/api/processes`, `/api/system/*` | agent **signed jobs** (`JobSigner` exists; dispatch/ACK pending) | 🔴 blocked on agent job channel |
| `/api/ports*`, `/api/workspaces/*`, `/api/conflicts`, `/api/quotas`, `/api/action-jobs` | local developer-workspace tooling | ⚪ stays local — not a PAM concern |
| `/api/database/*` explorer | — | ⚪ stays local |
| `/api/ai/diagnose`, `/api/alerts/*`, `/api/notifications` | — | ⚪ stays local |
| `/stitch/*` | removed (design sources dropped) | ⚪ route should be retired with the page |

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
