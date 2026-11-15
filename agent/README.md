# ASAAS Windows Agent

The agent is an outbound-only Windows service. It uses a one-time enrollment result (`ASAAS_AGENT_ID` and `ASAAS_AGENT_KEY`) and an optional client certificate for mTLS. It reports inventory/heartbeat only in this foundation; arbitrary remote command execution is deliberately not implemented.

Build on a Windows machine with the .NET 8 SDK:

```powershell
dotnet restore agent\Asaas.WindowsAgent.csproj
dotnet publish agent\Asaas.WindowsAgent.csproj -c Release -r win-x64 --self-contained false
```

## Signed job channel

The control plane can dispatch **read-only** jobs (`system.info`, `process.list`,
`service.list`, `disk.list`, `inventory.collect`, `session.list`). Every job carries an Ed25519
signature over `asaas-job|<id>|<agent_id>|<type>|<canonical-payload-json>`; the
agent verifies it against `signing_public_key` (returned at enrollment and on
every poll) before executing, then posts the result to
`/api/v1/agents/{id}/jobs/{job_id}/result`.

The signing seed persists at `ASAAS_JOB_SIGNING_KEY_FILE` (default
`data/agent-signing.key`) or `ASAAS_JOB_SIGNING_KEY` (hex). Write/destructive
actions are intentionally not in the allowlist.
