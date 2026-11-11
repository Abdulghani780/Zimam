# ASAAS Windows Agent

The agent is an outbound-only Windows service. It uses a one-time enrollment result (`ASAAS_AGENT_ID` and `ASAAS_AGENT_KEY`) and an optional client certificate for mTLS. It reports inventory/heartbeat only in this foundation; arbitrary remote command execution is deliberately not implemented.

Build on a Windows machine with the .NET 8 SDK:

```powershell
dotnet restore agent\Asaas.WindowsAgent.csproj
dotnet publish agent\Asaas.WindowsAgent.csproj -c Release -r win-x64 --self-contained false
```
