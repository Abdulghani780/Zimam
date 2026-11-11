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

Bootstrap the first administrator with `POST /api/v1/auth/bootstrap` and the `X-Bootstrap-Token` header. Passwords are never returned to the browser. Account secrets are AES-256-GCM encrypted and are only intended to be opened by a gateway process.

For the transitional release, use `control_plane/bootstrap_admin.py` instead. It updates both the v1 Control Plane administrator and the legacy v2 console account, so the same credentials work while the UI is being migrated.

From the repository root, `powershell -ExecutionPolicy Bypass -File .\run_asaas.ps1` starts both local services when their ports are free and opens the console at `http://127.0.0.1:8765`.

The current foundation includes local authentication, optional TOTP verification for users with an MFA secret, assets, accounts, policy binding, one-time connection tokens, agent enrollment/heartbeat, and hash-chain audit verification. It does **not** yet claim a production RDP/SSH gateway, AD/LDAP synchronization, or recording storage; those integrations remain explicit release gates.
