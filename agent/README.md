# ASAAS Windows Agent

The agent is an outbound-only Windows service. It uses a one-time enrollment result (`ASAAS_AGENT_ID` and `ASAAS_AGENT_KEY`) and an optional client certificate for mTLS. It reports inventory/heartbeat only in this foundation; arbitrary remote command execution is deliberately not implemented.

Build on a Windows machine with the .NET 10 SDK (LTS):

```powershell
dotnet restore agent\Asaas.Agent.csproj
dotnet publish agent\Asaas.Agent.csproj -c Release -r win-x64 --self-contained false
```

## Signed job channel

The control plane dispatches signed collector jobs and the reviewed write jobs
listed in `ALLOWED_JOB_TYPES` in `control_plane/asaas_control/api.py`. The agent
has a second, matching allowlist and validates each payload before execution.
Every job carries an Ed25519 signature over
`asaas-job|<id>|<agent_id>|<type>|<canonical-payload-json>`; the agent verifies it
against `signing_public_key` before executing, then posts the result to
`/api/v1/agents/{id}/jobs/{job_id}/result`.

The signing seed persists at `ASAAS_JOB_SIGNING_KEY_FILE` (default
`data/agent-signing.key`) or `ASAAS_JOB_SIGNING_KEY` (hex). JIT access uses
`jit.grant` and `jit.revoke` jobs bound to a grant, target agent, Windows account,
and reviewed local group. A grant becomes active only after the agent verifies
membership. The result records whether this grant added the membership so a later
revocation never removes a pre-existing permanent membership. Expired grants are
queued for revocation by the control-plane reconciliation loop.

## Service installation

The published `Asaas.Agent.exe` is self-contained — no .NET runtime needed
on the target. Manage it as a Windows service from an **elevated** prompt:

```powershell
# Set connection config first (persisted into the service registry Environment)
$env:ASAAS_CONTROL_PLANE_URL = "http://<console-host>:8876"
$env:ASAAS_AGENT_ID = "<id from enrollment>"
$env:ASAAS_AGENT_KEY = "<key from enrollment>"
$env:ASAAS_AGENT_CERT_PATH = "C:\ProgramData\ASAAS\agent.pfx"   # optional mTLS

.\Asaas.Agent.exe install     # creates auto-start service "ASAAS Windows Agent"
.\Asaas.Agent.exe status      # sc.exe query
.\Asaas.Agent.exe uninstall   # stop + delete
```

`install` persists every `ASAAS_*` env var into
`HKLM\SYSTEM\CurrentControlSet\Services\ASAAS Windows Agent\Environment`, so the
service inherits them at start. To change config later, update that registry
value (REG_MULTI_SZ) and restart the service. Without the env vars the agent
logs that `ASAAS_AGENT_ID`/`ASAAS_AGENT_KEY` are required and idles.

`install` also configures SCM restart-on-failure, which the self-update flow
relies on: an `agent.update` job downloads the published bundle
(`GET /api/v1/agents/{id}/update`, agent-key auth), verifies its SHA-256 against
the *signed* job payload, stages it as `<exe>.new`, and the next agent start
swaps binaries and exits so the service comes back on the new build. Publish a
bundle from the console host with `POST /api/v1/agents/update-bundle`
(`X-Update-Version` + `X-Update-Sha256` headers, raw .exe body; admin only).
