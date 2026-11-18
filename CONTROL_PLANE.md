# ASAAS enterprise control plane

The repository now contains an isolated v1 control plane under `control_plane/asaas_control` and a Windows outbound agent under `agent/`.

```text
Console (React) -> FastAPI Control Plane -> PostgreSQL
                                      -> Redis / MinIO / guacd (compose adapters)
Windows Agent -----------------------> heartbeat (outbound mTLS-ready)
Session gateway ----------------------> one-time connection token
```

## Implemented foundation

- server-side cookie sessions and Argon2 password hashes;
- explicit first-admin bootstrap token (no seeded credentials);
- optional TOTP verification and MFA setup endpoint;
- assets, accounts and access policies bound to user, asset, account, protocol, action and time;
- AES-256-GCM account-secret envelopes; secrets are never returned by list endpoints;
- HMAC-signed, one-time, short-lived connection tokens plus gateway-only consumption;
- agent enrollment/heartbeat with one-time agent key and mTLS-ready HTTP client;
- signed agent job channel: control plane issues Ed25519-signed read-only jobs, agent verifies the signature over the canonical payload before executing and posts results back;
- `GET /api/v1/agents` + `/api/v1/jobs` power the console `/agents` page (enrolled agents, job history, dispatch modal);
- append-only audit rows with `previous_hash`, `event_hash` and verification endpoint;
- Ed25519-signed licenses (`data/license.json`) with offline verification, tier defaults (starter/pro/enterprise), 30-day trial, grace period, read-only expiry mode, and capacity/feature enforcement (`license.py`, `entitlements.py`); vendor signing via `tools/sign-license.py`;
- Compose baseline for PostgreSQL, Redis, MinIO and guacd;
- legacy v2 compatibility routes no longer generate RDP files, reveal vault secrets, or claim fake JIT/replay success.

## Explicit release gates still open

The code intentionally returns a clear `501`/`503` for pieces that are not wired yet. Production mTLS issuance is implemented in `asaas_control/mtls.py`: a local ECDSA P-256 CA under `ASAAS_MTLS_DIR` (default `data/pki`) issues client-auth certificates via admin endpoints (`POST /api/v1/pki/ca`, `POST /api/v1/agents/{id}/cert`, `GET /api/v1/pki/ca.crt`); enforcing client-cert verification at the TLS terminator remains a deployment step. The SFTP data path is implemented in `asaas_control/sftp.py`: `POST /api/v1/sftp/session` opens a paramiko SFTP session against an SSH-protocol asset using the vaulted credential (never exposed to the client), and session-scoped endpoints provide list/stat/download/upload/mkdir/rename/delete plus `DELETE /sftp/session/{id}`; file ops are gated by `sftp` access-policy actions and audited on open/close. Screen/terminal recording is implemented in `asaas_control/recording.py`: every guacd->client instruction is teed to `data/recordings/<id>.jsonl` (timed) during gateway sessions (`ASAAS_GW_RECORD`, default on); `GET /api/v1/recordings[/{id}]`, `DELETE /api/v1/recordings/{id}` (admin) and `WS /api/v1/recordings/{id}/replay` stream the recording back paced by original timing — non-admins see/replay only their own sessions. AD/LDAP sync is implemented in `asaas_control/directory.py`: `POST /api/v1/directory/sync` (admin) binds via `ASAAS_LDAP_URL`/`ASAAS_LDAP_BIND_*`/`ASAAS_LDAP_BASE_DN`/`ASAAS_LDAP_USER_FILTER` (ldap3, lazy import -> 503 unconfigured) and upserts users into the `directory_users` read model (never creates login accounts); `GET /api/v1/directory/users` lists them. Off-box backup replication is implemented in `asaas_control/replication.py`: `ASAAS_BACKUP_DEST` accepts `file://`/bare path (incl. UNC), `sftp://user@host[:port]/dir` (Paramiko; `ASAAS_BACKUP_SFTP_PASSWORD`/`_KEY_PATH`), or `s3://bucket/prefix` (boto3); `POST /api/v1/system/backup` replicates automatically when configured (failures reported in `replication`, never hidden) and `GET /api/v1/system/backup/replication` reports status without secrets. Live session termination is implemented: `POST /api/v1/sessions/terminate` and `/sessions/disconnect` queue signed `session.logoff`/`session.disconnect` agent jobs (Ed25519) that the Windows agent executes locally. Redis-backed one-time token consumption is implemented: `ConnectionTokenStore` uses atomic `SET NX EX` when `ASAAS_REDIS_URL` is set (required for multi-worker deployments); without it the store degrades to per-process memory, which is only safe for a single worker. The guacd session gateway is implemented (`/api/v1/gateway/{rdp,ssh,telnet,vnc}` WebSocket → one-time token → sealed secret → guacd handshake/pump) and activates when `ASAAS_GUACD_HOST` points at a deployed guacd; verified end-to-end against guacd 1.6.0 (Docker) with a live SSH session: handshake, display instructions and keep-alive pings all flow correctly; the browser viewer uses guacamole-common-js (RemoteSession on the Assets page). Signed agent jobs (Ed25519, read-only allowlist: system.info/process.list/service.list/disk.list/inventory.collect/session.list/network.info/eventlog.tail/software.list/firewall.state/agent.update + session.logoff signed write job requiring session_id payload) are implemented end-to-end and verified live against the Windows agent (all four new collectors returned real host data). Those must be completed and load/security tested before selling the product as a JumpServer replacement.

Run the v1 API locally with the instructions in `control_plane/README.md`; production deployment requires a populated `control_plane/.env`, TLS reverse proxy, PostgreSQL, MinIO retention/legal-hold policy, and an independent security review.

## Legacy API bridge

`asaas_control/legacy_proxy.py` transparently forwards `/api/*` (everything except `/api/v1`) to the legacy backend (`ASAAS_LEGACY_API_URL`, default `http://127.0.0.1:8765`), including SSE streams and `Set-Cookie` headers. The SPA is served at the control-plane origin root (`/`) with an `index.html` fallback for client-side routes, so the console works fully on one origin while pages migrate to `/api/v1` one group at a time. `run_asaas.ps1` now starts both services and opens `http://127.0.0.1:8876/` when the control plane is healthy.
