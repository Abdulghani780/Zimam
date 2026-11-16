# ZIMAM â€” Installation & Operations Guide

Appliance deployment for Windows Server 2022/2025 (also runs on Windows 10/11 for evaluation).

## What the installer does

`ZIMAM-Setup-x.y.z.exe` (Inno Setup, admin required):

- Installs to `C:\Program Files\ZIMAM\` (`bin\`, `web\`, `scripts\`)
- Registers two auto-start scheduled tasks running as SYSTEM:
  - **ZIMAM Backend** â€” legacy bridge on `127.0.0.1:8765`
  - **ZIMAM Control Plane** â€” v1 API + SPA on `127.0.0.1:8876`
- Registers per-minute watchdog tasks that restart either service if its port stops listening
- Creates the data directory with restricted ACLs
- Adds Start Menu shortcuts; optionally opens the console at `http://127.0.0.1:8876/`

No Python, Node.js, or .NET runtime is required on the target â€” everything is bundled.

## First boot

1. Open `http://127.0.0.1:8876/` â€” the **first-run wizard** appears (once only).
2. Create the administrator account (12+ character password).
3. Paste a signed license key **or** choose the free 30-day trial.
4. Sign in. The wizard never appears again.

## Configuration

Create `control-plane.env` next to `zimam-control.exe` (or one directory up â€” the `<app>` install root). Real environment variables take precedence. See `control-plane.env.example`:

```ini
ZIMAM_HOST=0.0.0.0
ZIMAM_CP_PORT=8876
ZIMAM_TLS_CERT=C:\ProgramData\ZIMAM\tls\cert.pem
ZIMAM_TLS_KEY=C:\ProgramData\ZIMAM\tls\key.pem
ZIMAM_BACKUP_INTERVAL_HOURS=24
ZIMAM_BACKUP_KEEP=14
```

Restart the **ZIMAM Control Plane** task after changes (`schtasks /end` + `/run`, or reboot).

### TLS

Generate a self-signed certificate with SANs for every name/IP clients will use:

```powershell
python tools\gen-server-cert.py --host 192.168.10.20 --host console.contoso.local
```

Copy `cert.pem`/`key.pem` to a protected directory (e.g. `C:\ProgramData\ZIMAM\tls\`) and set the two env keys above. For production, prefer an internal-CA certificate or a TLS-terminating reverse proxy.

## Agents

The console enrolls agents with a one-time enrollment token. On each target Windows machine, from an **elevated** prompt:

```powershell
$env:ZIMAM_CONTROL_PLANE_URL = "http://<console>:8876"   # or https:// once TLS is on
$env:ZIMAM_AGENT_ID = "<id>"
$env:ZIMAM_AGENT_KEY = "<key>"
.\Zimam.Agent.exe install
.\Zimam.Agent.exe status
```

`install` creates the auto-start **ZIMAM Windows Agent** service, persists the `ZIMAM_*` variables into its registry environment, and configures restart-on-failure. Dispatch jobs from **Agents** in the console; `agent.update` pushes signed self-updates (publish a bundle first via `POST /api/v1/agents/update-bundle`).

## Backups

- Manual: **Settings â†’ Control-plane backup** or `POST /api/v1/system/backup` (admin)
- Scheduled: every `ZIMAM_BACKUP_INTERVAL_HOURS` into `<data>\backups\` with SHA-256 manifests; keeps `ZIMAM_BACKUP_KEEP` newest
- Backups contain credential material â€” protect `data\backups\` like the database itself

## Logs & health

- Health: `GET /api/v1/health` (public)
- Audit chain: **Audit** page â†’ verify hash chain; `GET /api/v1/audit/verify`
- Task logs: Task Scheduler â†’ ZIMAM tasks; agent logs via `sc.exe` / Event Viewer


## Remote sessions (guacd)

Browser-based RDP/SSH sessions go through the built-in Guacamole gateway. Deploy `guacd` (e.g. `docker run -d -p 4822:4822 guacamole/guacd:1.6.0`) and point the control plane at it in `control-plane.env`:

```
ZIMAM_GUACD_HOST=127.0.0.1
ZIMAM_GUACD_PORT=4822
ZIMAM_GATEWAY_TOKEN=<shared-secret>   # required for /connection-tokens
```

Then create an asset + vault account (protocol `ssh`/`rdp`), and use **Assets → direct-session button**: the console issues a one-time token, the browser opens `/api/v1/gateway/{protocol}?token=...` and credentials are injected server-side only. Verified live against guacd 1.6.0 + OpenSSH (display, cursor and input all flow).
## Uninstall

Run `Uninstall ZIMAM` from Settings. It removes the scheduled tasks; data under the install `data\` directory is preserved unless removed manually.
