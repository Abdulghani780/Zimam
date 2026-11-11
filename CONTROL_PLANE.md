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
- append-only audit rows with `previous_hash`, `event_hash` and verification endpoint;
- Compose baseline for PostgreSQL, Redis, MinIO and guacd;
- legacy v2 compatibility routes no longer generate RDP files, reveal vault secrets, or claim fake JIT/replay success.

## Explicit release gates still open

The code intentionally returns a clear `501`/`503` for pieces that are not wired yet: Guacamole/SSH/SFTP proxy data paths, Redis-backed token consumption across workers, live session termination, screen/terminal recording persistence and replay, AD/LDAP synchronization, backup/restore worker, signed agent jobs, and production mTLS certificate issuance. Those must be completed and load/security tested before selling the product as a JumpServer replacement.

Run the v1 API locally with the instructions in `control_plane/README.md`; production deployment requires a populated `control_plane/.env`, TLS reverse proxy, PostgreSQL, MinIO retention/legal-hold policy, and an independent security review.
