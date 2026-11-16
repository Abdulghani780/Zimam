# ZIMAM Windows Agent

The agent is an outbound-only Windows service. It uses a one-time enrollment result (`ZIMAM_AGENT_ID` and `ZIMAM_AGENT_KEY`) and an optional client certificate for mTLS. It reports inventory/heartbeat only in this foundation; arbitrary remote command execution is deliberately not implemented.

Build on a Windows machine with the .NET 10 SDK (LTS):

```powershell
dotnet restore agent\Zimam.Agent.csproj
dotnet publish agent\Zimam.Agent.csproj -c Release -r win-x64 --self-contained false
```

## Signed job channel

The control plane can dispatch **read-only** jobs (`system.info`, `process.list`,
`service.list`, `disk.list`, `inventory.collect`, `session.list`, `network.info`,
`eventlog.tail`, `software.list`, `firewall.state`) plus the reviewed
`session.logoff` write job and `agent.update` self-update. Every job carries an Ed25519
signature over `zimam-job|<id>|<agent_id>|<type>|<canonical-payload-json>`; the
agent verifies it against `signing_public_key` (returned at enrollment and on
every poll) before executing, then posts the result to
`/api/v1/agents/{id}/jobs/{job_id}/result`.

The signing seed persists at `ZIMAM_JOB_SIGNING_KEY_FILE` (default
`data/agent-signing.key`) or `ZIMAM_JOB_SIGNING_KEY` (hex). All other write/destructive actions are intentionally not in the allowlist. `session.logoff` is the single reviewed write job: it requires `{"session_id": <positive int>}` in the signed payload and refuses invalid ids.

## Service installation

The published `Zimam.Agent.exe` is self-contained — no .NET runtime needed
on the target. Manage it as a Windows service from an **elevated** prompt:

```powershell
# Set connection config first (persisted into the service registry Environment)
$env:ZIMAM_CONTROL_PLANE_URL = "http://<console-host>:8876"
$env:ZIMAM_AGENT_ID = "<id from enrollment>"
$env:ZIMAM_AGENT_KEY = "<key from enrollment>"
$env:ZIMAM_AGENT_CERT_PATH = "C:\ProgramData\ZIMAM\agent.pfx"   # optional mTLS

.\Zimam.Agent.exe install     # creates auto-start service "ZIMAM Windows Agent"
.\Zimam.Agent.exe status      # sc.exe query
.\Zimam.Agent.exe uninstall   # stop + delete
```

`install` persists every `ZIMAM_*` env var into
`HKLM\SYSTEM\CurrentControlSet\Services\ZIMAM Windows Agent\Environment`, so the
service inherits them at start. To change config later, update that registry
value (REG_MULTI_SZ) and restart the service. Without the env vars the agent
logs that `ZIMAM_AGENT_ID`/`ZIMAM_AGENT_KEY` are required and idles.

`install` also configures SCM restart-on-failure, which the self-update flow
relies on: an `agent.update` job downloads the published bundle
(`GET /api/v1/agents/{id}/update`, agent-key auth), verifies its SHA-256 against
the *signed* job payload, stages it as `<exe>.new`, and the next agent start
swaps binaries and exits so the service comes back on the new build. Publish a
bundle from the console host with `POST /api/v1/agents/update-bundle`
(`X-Update-Version` + `X-Update-Sha256` headers, raw .exe body; admin only).
