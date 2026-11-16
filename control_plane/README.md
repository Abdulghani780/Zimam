# ASAAS Control Plane

This is the new `/api/v1` control plane foundation. It is intentionally separate from the legacy local Windows monitor until the gateway and agent cut-over is complete.

## Local run

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r control_plane\requirements.txt
$env:PYTHONPATH="$PWD\control_plane"
$env:ASAAS_BOOTSTRAP_TOKEN="use-a-one-time-random-value"
python -m uvicorn asaas_control.app:app --host 127.0.0.1 --port 8876
```

Bootstrap the first administrator with `POST /api/v1/setup/complete` (or `POST /api/v1/auth/bootstrap` + `X-Bootstrap-Token`). Both seal permanently once the first user exists — the packaged appliance normally uses the `/setup` wizard page instead. Passwords are never returned to the browser. Account secrets are AES-256-GCM encrypted and are only intended to be opened by a gateway process.

From the repository root, `powershell -ExecutionPolicy Bypass -File .\run_asaas.ps1` starts both local services when their ports are free and opens the console at `http://127.0.0.1:8876`.

## Configuration

`control_plane/serve.py` (the packaged entry point) loads `control-plane.env` — a `KEY=VALUE` file searched next to the exe, one directory up (the `<app>/bin` install layout), then the repo root. Real environment variables win. See `control-plane.env.example`. Notable keys:

- `ASAAS_HOST` / `ASAAS_CP_PORT` — bind address (default `127.0.0.1:8876`)
- `ASAAS_TLS_CERT` + `ASAAS_TLS_KEY` — PEM paths for direct HTTPS; generate a self-signed pair with `python tools/gen-server-cert.py --host <lan-ip-or-name>`
- `ASAAS_BACKUP_INTERVAL_HOURS` (default `24`, `0` disables) and `ASAAS_BACKUP_KEEP` (default `14`) — scheduled SQLite backups into `data/backups/` with SHA-256 manifests; manual trigger stays at `POST /api/v1/system/backup`
- `ASAAS_LICENSE_FILE`, `ASAAS_JOB_SIGNING_KEY_FILE` — license token and Ed25519 job-signing seed locations

Licensing is offline Ed25519: `GET /api/v1/license`, `POST /api/v1/license/activate`, `POST /api/v1/license/deactivate`; sign customer licenses with `python tools/sign-license.py`. Expired licenses flip the console to read-only while auth/agent/heartbeat paths stay up.

The current foundation includes local authentication, optional TOTP verification for users with an MFA secret, assets, accounts, policy binding, one-time connection tokens, agent enrollment/heartbeat, scheduled + manual backups, license entitlements, and hash-chain audit verification. It does **not** yet claim a production RDP/SSH gateway, AD/LDAP synchronization, or recording storage; those integrations remain explicit release gates.
