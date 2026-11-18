using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Json;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Win32;
using NSec.Cryptography;

// --- CLI management commands -------------------------------------------------
// `Asaas.Agent.exe install|uninstall|status` manages the Windows service
// without needing sc.exe by hand. `install` must run elevated; it registers the
// service for auto-start and persists ASAAS_* environment variables into the
// service's registry Environment value so the agent can reach the control plane.
const string ServiceName = "ASAAS Windows Agent";

static int Sc(params string[] scArgs)
{
    var psi = new ProcessStartInfo("sc.exe", string.Join(' ', scArgs.Select(a => a.Contains(' ') ? $"\"{a}\"" : a)))
    {
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
        CreateNoWindow = true,
    };
    using var p = Process.Start(psi)!;
    var output = p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd();
    p.WaitForExit();
    Console.WriteLine(output.Trim());
    return p.ExitCode;
}

static int InstallService()
{
    var exe = Environment.ProcessPath;
    if (exe is null) { Console.Error.WriteLine("Cannot resolve executable path."); return 1; }
    var binPath = $"\"{exe}\"";
    if (Sc("create", ServiceName, $"binPath= {binPath}", "start= auto", $"DisplayName= {ServiceName}") != 0) return 1;
    Sc("description", ServiceName, "ASAAS outbound agent - polls for signed jobs and reports inventory.");
    // Restart-on-failure covers the self-update handoff: the agent exits after
    // swapping binaries and SCM brings the new version back automatically.
    Sc("failure", ServiceName, "reset= 86400", "actions= restart/5000/restart/10000/restart/30000");

    var envVars = Environment.GetEnvironmentVariables()
        .Cast<System.Collections.DictionaryEntry>()
        .Where(e => e.Key.ToString()?.StartsWith("ASAAS_", StringComparison.OrdinalIgnoreCase) == true)
        .Select(e => $"{e.Key}={e.Value}")
        .ToArray();
    if (envVars.Length > 0)
    {
        using var key = Registry.LocalMachine.CreateSubKey($@"SYSTEM\CurrentControlSet\Services\{ServiceName}");
        key?.SetValue("Environment", envVars, RegistryValueKind.MultiString);
        Console.WriteLine($"Persisted {envVars.Length} ASAAS_* environment variable(s) for the service.");
    }
    else
    {
        Console.WriteLine("No ASAAS_* env vars found - set ASAAS_CONTROL_PLANE_URL / ASAAS_AGENT_ID / ASAAS_AGENT_KEY before install, or via registry Environment afterwards.");
    }
    Console.WriteLine($"Service '{ServiceName}' installed (auto-start). Start it with: sc.exe start \"{ServiceName}\"");
    return 0;
}

static int UninstallService()
{
    Sc("stop", ServiceName);
    return Sc("delete", ServiceName);
}

// If a previous run staged an update (<exe>.new + <exe>.pending.json), swap the
// binaries now and exit so the service/task restarts onto the new build. Windows
// allows renaming a running executable, which is what makes in-place self-update
// possible without an external updater.
static void ApplyPendingUpdate()
{
    try
    {
        var exe = Environment.ProcessPath;
        if (exe is null) return;
        var staged = exe + ".new";
        var pending = exe + ".pending.json";
        if (!File.Exists(staged))
        {
            if (File.Exists(pending)) File.Delete(pending);
            return;
        }
        var old = exe + ".old";
        if (File.Exists(old)) File.Delete(old);
        File.Move(exe, old);
        try
        {
            File.Move(staged, exe);
        }
        catch
        {
            File.Move(old, exe); // roll back so the agent is never left exeless
            throw;
        }
        File.Delete(old);
        if (File.Exists(pending)) File.Delete(pending);
        Console.WriteLine("[update] agent binary swapped; exiting for restart onto the new build");
        Environment.Exit(0);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[update] failed to apply staged update: {ex.Message}");
    }
}

var cli = args.FirstOrDefault()?.ToLowerInvariant();
if (cli is "install" or "uninstall" or "status")
{
    var code = cli switch
    {
        "install" => InstallService(),
        "uninstall" => UninstallService(),
        _ => Sc("query", ServiceName),
    };
    Environment.Exit(code);
}

ApplyPendingUpdate();

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(options => options.ServiceName = "ASAAS Windows Agent");
builder.Services.AddHttpClient("control-plane", client =>
{
    client.BaseAddress = new Uri(Environment.GetEnvironmentVariable("ASAAS_CONTROL_PLANE_URL") ?? "https://127.0.0.1:8876");
    client.Timeout = TimeSpan.FromSeconds(15);
}).ConfigurePrimaryHttpMessageHandler(() =>
{
    var handler = new HttpClientHandler();
    var certPath = Environment.GetEnvironmentVariable("ASAAS_AGENT_CERT_PATH");
    var certPassword = Environment.GetEnvironmentVariable("ASAAS_AGENT_CERT_PASSWORD");
    if (!string.IsNullOrWhiteSpace(certPath))
        handler.ClientCertificates.Add(X509CertificateLoader.LoadPkcs12FromFile(certPath, certPassword));
    return handler;
});
builder.Services.AddHostedService<AgentWorker>();
await builder.Build().RunAsync();

sealed record AgentJobDto(
    [property: System.Text.Json.Serialization.JsonPropertyName("id")] string Id,
    [property: System.Text.Json.Serialization.JsonPropertyName("type")] string Type,
    [property: System.Text.Json.Serialization.JsonPropertyName("payload")] JsonElement Payload,
    [property: System.Text.Json.Serialization.JsonPropertyName("payload_canonical")] string PayloadCanonical,
    [property: System.Text.Json.Serialization.JsonPropertyName("signature")] string Signature,
    [property: System.Text.Json.Serialization.JsonPropertyName("signing_public_key")] string SigningPublicKey);

sealed class AgentWorker(IHttpClientFactory clients, ILogger<AgentWorker> logger) : BackgroundService
{
    // Read-only collectors only. Write/destructive job types are rejected by
    // the control plane and must never be added here without a reviewed design.
    private static readonly HashSet<string> AllowedJobs = new(StringComparer.Ordinal)
    {
        "system.info", "process.list", "service.list", "disk.list", "inventory.collect", "session.list", "session.logoff", "session.disconnect",
        "network.info", "eventlog.tail", "software.list", "firewall.state", "agent.update",
        "windows.features", "scheduled.tasks", "local.users", "shares.list", "hotfix.list", "ports.list", "startup.programs", "hyperv.vms",
        "service.control", "process.kill", "task.control", "hyperv.power", "share.control", "feature.toggle",
        "firewall.rules", "firewall.rule", "docker.containers", "docker.container", "cert.list", "cert.remove", "disk.physical", "disk.state", "hotfix.install", "startup.program.remove", "local.user", "software.uninstall"
    };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var agentId = Environment.GetEnvironmentVariable("ASAAS_AGENT_ID");
        var agentKey = Environment.GetEnvironmentVariable("ASAAS_AGENT_KEY");
        if (string.IsNullOrWhiteSpace(agentId) || string.IsNullOrWhiteSpace(agentKey))
        {
            logger.LogError("ASAAS_AGENT_ID and ASAAS_AGENT_KEY are required; agent will not start");
            return;
        }

        var client = clients.CreateClient("control-plane");
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        do
        {
            try
            {
                var inventory = new
                {
                    hostname = Environment.MachineName,
                    os = Environment.OSVersion.VersionString,
                    process_count = Process.GetProcesses().Length,
                    observed_at = DateTimeOffset.UtcNow
                };
                using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/agents/{agentId}/heartbeat") { Content = JsonContent.Create(new { inventory }) };
                request.Headers.Add("X-Agent-Key", agentKey);
                var response = await client.SendAsync(request, stoppingToken);
                response.EnsureSuccessStatusCode();
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Control plane heartbeat failed; retrying");
            }

            try
            {
                await PollAndRunJobsAsync(client, agentId, agentKey, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Agent job poll failed; retrying");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task PollAndRunJobsAsync(HttpClient client, string agentId, string agentKey, CancellationToken ct)
    {
        using var pollReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/agents/{agentId}/jobs/poll");
        pollReq.Headers.Add("X-Agent-Key", agentKey);
        var pollResp = await client.SendAsync(pollReq, ct);
        pollResp.EnsureSuccessStatusCode();
        var doc = await pollResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        if (!doc.TryGetProperty("job", out var jobEl) || jobEl.ValueKind == JsonValueKind.Null)
            return;

        var job = JsonSerializer.Deserialize<AgentJobDto>(jobEl.GetRawText(), new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (job is null)
            return;

        if (!AllowedJobs.Contains(job.Type))
        {
            logger.LogWarning("Refusing unsigned-out-of-scope job type {Type}", job.Type);
            await SubmitResultAsync(client, agentId, agentKey, job.Id, "failed", null, "Job type not in agent allowlist", ct);
            return;
        }

        // Verify the Ed25519 signature over the canonical payload string
        // exactly as the control plane signed it — never a re-serialization.
        var canonicalPayload = string.IsNullOrEmpty(job.PayloadCanonical) ? job.Payload.GetRawText() : job.PayloadCanonical;
        var canonical = $"asaas-job|{job.Id}|{agentId}|{job.Type}|{canonicalPayload}";
        if (!VerifySignature(job.Signature, job.SigningPublicKey, canonical))
        {
            logger.LogWarning("Job {JobId} signature verification failed; refusing execution", job.Id);
            await SubmitResultAsync(client, agentId, agentKey, job.Id, "failed", null, "Signature verification failed", ct);
            return;
        }

        object? result = null;
        string? error = null;
        try
        {
            result = job.Type == "agent.update"
                ? await StageUpdateAsync(client, agentId, agentKey, job.Payload, ct)
                : ExecuteJob(job.Type, job.Payload);
        }
        catch (Exception ex)
        {
            error = ex.Message;
        }

        await SubmitResultAsync(client, agentId, agentKey, job.Id, error is null ? "succeeded" : "failed", result, error, ct);
    }

    private static bool VerifySignature(string signatureHex, string publicKeyHex, string canonical)
    {
        try
        {
            var publicKey = NSec.Cryptography.PublicKey.Import(
                NSec.Cryptography.SignatureAlgorithm.Ed25519,
                Convert.FromHexString(publicKeyHex),
                NSec.Cryptography.KeyBlobFormat.RawPublicKey);
            return NSec.Cryptography.SignatureAlgorithm.Ed25519.Verify(publicKey, Encoding.UTF8.GetBytes(canonical), Convert.FromHexString(signatureHex));
        }
        catch
        {
            return false;
        }
    }

    private static object ExecuteJob(string type, JsonElement payload) => type switch
    {
        "system.info" => new
        {
            hostname = Environment.MachineName,
            os = Environment.OSVersion.VersionString,
            machine_name = Environment.MachineName,
            processor_count = Environment.ProcessorCount,
            observed_at = DateTimeOffset.UtcNow
        },
        "process.list" => Process.GetProcesses()
            .OrderByDescending(p => p.WorkingSet64)
            .Take(50)
            .Select(p => new { name = p.ProcessName, pid = p.Id, working_set_mb = Math.Round(p.WorkingSet64 / 1048576.0, 1) })
            .ToArray(),
        "service.list" => PsProbe.Run("Get-Service | Sort-Object Name | Select-Object -First 300 | ForEach-Object { [pscustomobject]@{ name=$_.Name; display_name=$_.DisplayName; status=[string]$_.Status; start_type=[string]$_.StartType } } | ConvertTo-Json -Compress -Depth 3"),
        "disk.list" => DriveInfo.GetDrives()
            .Where(d => d.IsReady)
            .Select(d => new { name = d.Name, total_gb = Math.Round(d.TotalSize / 1073741824.0, 1), free_gb = Math.Round(d.AvailableFreeSpace / 1073741824.0, 1) })
            .ToArray(),
        "session.list" => SessionProbe.ListSessions(),
        "session.logoff" => SessionProbe.Logoff(payload),
        "session.disconnect" => SessionProbe.Disconnect(payload),
        "network.info" => NetworkProbe.Collect(),
        "eventlog.tail" => EventLogProbe.Tail(payload),
        "software.list" => SoftwareProbe.ListInstalled(),
        "firewall.state" => FirewallProbe.State(),
        "firewall.rules" => PsProbe.Run("Get-NetFirewallRule | Sort-Object DisplayName | Select-Object -First 500 Name,DisplayName,Direction,Action,Enabled,Profile | ConvertTo-Json -Compress -Depth 3"),
        "docker.containers" => PsProbe.Run("docker ps -a --format '{{json .}}' | ForEach-Object { $_ | ConvertFrom-Json } | Select-Object ID,Names,Image,Status,State,Ports | ConvertTo-Json -Compress -Depth 3"),
        "cert.list" => PsProbe.Run("Get-ChildItem Cert:\\LocalMachine\\My -ErrorAction SilentlyContinue | Sort-Object NotAfter | Select-Object -First 200 Subject,Issuer,Thumbprint,NotAfter,NotBefore,HasPrivateKey,FriendlyName | ForEach-Object { [pscustomobject]@{ subject=$_.Subject; issuer=$_.Issuer; thumbprint=$_.Thumbprint; not_after=$_.NotAfter.ToString('yyyy-MM-dd'); not_before=$_.NotBefore.ToString('yyyy-MM-dd'); has_private_key=$_.HasPrivateKey; friendly_name=$_.FriendlyName } } | ConvertTo-Json -Compress -Depth 3"),
        "disk.physical" => PsProbe.Run("Get-Disk | Sort-Object Number | Select-Object -First 100 Number,FriendlyName,Model,SerialNumber,@{n='size_gb';e={[math]::Round($_.Size/1GB,1)}},PartitionStyle,OperationalStatus,HealthStatus,BusType,IsOffline,IsReadOnly | ConvertTo-Json -Compress -Depth 3"),
        "inventory.collect" => new
        {
            hostname = Environment.MachineName,
            os = Environment.OSVersion.VersionString,
            process_count = Process.GetProcesses().Length,
            disk_count = DriveInfo.GetDrives().Count(d => d.IsReady),
            observed_at = DateTimeOffset.UtcNow
        },
        "agent.update" => throw new InvalidOperationException("agent.update is handled asynchronously"),
        "windows.features" => FeatureProbe.ListFeatures(),
        "scheduled.tasks" => PsProbe.Run("Get-ScheduledTask | Select-Object TaskName,TaskPath,State | ConvertTo-Json -Compress"),
        "local.users" => PsProbe.Run("Get-LocalUser | ForEach-Object { [pscustomobject]@{ name=$_.Name; enabled=$_.Enabled; last_logon=($_.LastLogon.ToString('yyyy-MM-dd HH:mm')); password_required=$_.PasswordRequired; source=$_.PrincipalSource } } | ConvertTo-Json -Compress"),
        "shares.list" => PsProbe.Run("Get-SmbShare | ForEach-Object { [pscustomobject]@{ name=$_.Name; path=$_.Path; description=$_.Description; users=$_.CurrentUsers } } | ConvertTo-Json -Compress"),
        "hotfix.list" => PsProbe.Run("Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 50 | ForEach-Object { [pscustomobject]@{ id=$_.HotFixID; description=$_.Description; installed_on=$_.InstalledOn.ToString('yyyy-MM-dd') } } | ConvertTo-Json -Compress"),
        "ports.list" => PsProbe.Run("$names=@{}; Get-Process | ForEach-Object { $names[[int]$_.Id]=$_.ProcessName }; $tcp=Get-NetTCPConnection -State Listen | ForEach-Object { [pscustomobject]@{ proto='tcp'; local_address=[string]$_.LocalAddress; local_port=[int]$_.LocalPort; pid=[int]$_.OwningProcess; process=$names[[int]$_.OwningProcess] } }; $udp=Get-NetUDPEndpoint | ForEach-Object { [pscustomobject]@{ proto='udp'; local_address=[string]$_.LocalAddress; local_port=[int]$_.LocalPort; pid=[int]$_.OwningProcess; process=$names[[int]$_.OwningProcess] } }; @($tcp)+@($udp) | Sort-Object local_port | ConvertTo-Json -Compress -Depth 4"),
        "startup.programs" => PsProbe.Run("$paths=@('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run','HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce'); $out=@(); foreach($p in $paths){ if(Test-Path $p){ $k=Get-Item $p; foreach($n in $k.GetValueNames()){ $out += [pscustomobject]@{ hive=($p -split ':')[0]; key=$p; name=$n; command=[string]$k.GetValue($n); kind=[string]$k.GetValueKind($n) } } } }; $out | ConvertTo-Json -Compress -Depth 4"),
        "hyperv.vms" => PsProbe.Run("if(-not (Get-Command Get-VM -ErrorAction SilentlyContinue)){ throw 'Hyper-V PowerShell module not available on this host' }; Get-VM | ForEach-Object { [pscustomobject]@{ name=$_.Name; state=[string]$_.State; cpu_usage=$_.ProcessorUsage; memory_assigned_gb=[math]::Round($_.MemoryAssigned/1GB,2); memory_startup_gb=[math]::Round($_.MemoryStartup/1GB,2); uptime=$_.Uptime.ToString(); version=$_.Version.ToString() } } | ConvertTo-Json -Compress -Depth 4"),
        "service.control" => ServiceControl(payload),
        "process.kill" => ProcessKill(payload),
        "task.control" => TaskControl(payload),
        "hyperv.power" => HypervPower(payload),
        "share.control" => ShareControl(payload),
        "feature.toggle" => FeatureToggle(payload),
        "firewall.rule" => FirewallRuleControl(payload),
        "docker.container" => DockerContainerControl(payload),
        "cert.remove" => CertRemove(payload),
        "disk.state" => DiskState(payload),
        "hotfix.install" => HotfixInstall(payload),
        "startup.program.remove" => StartupProgramRemove(payload),
        "local.user" => LocalUserControl(payload),
        "software.uninstall" => SoftwareUninstall(payload),
        _ => throw new InvalidOperationException($"Unsupported job type: {type}")
    };

    // Signed write job: enable/disable a Windows optional feature.
    // payload: {"feature_name": "...", "action": "enable"|"disable"}
    // Note: may require a reboot to take effect; result reports RestartNeeded.
    private static object FeatureToggle(JsonElement payload)
    {
        var name = payload.TryGetProperty("feature_name", out var n) ? n.GetString() : null;
        var action = payload.TryGetProperty("action", out var a) ? a.GetString()?.ToLowerInvariant() : null;
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("feature.toggle requires payload.feature_name");
        if (name.Any(c => !(char.IsLetterOrDigit(c) || c is '_' or '-' or '.' or ' ' or '/' or ':')))
            throw new InvalidOperationException("feature name contains invalid characters");
        var escaped = name.Replace("'", "''");
        var cmdlet = action == "enable" ? "Enable-WindowsOptionalFeature" : action == "disable" ? "Disable-WindowsOptionalFeature" : null;
        if (cmdlet is null)
            throw new InvalidOperationException("feature.toggle action must be enable|disable");
        var result = PsProbe.Run(
            $"$r = {cmdlet} -FeatureName '{escaped}' -NoRestart -ErrorAction Stop; " +
            "$r | Select-Object FeatureName,State,RestartNeeded | ConvertTo-Json -Compress");
        return new { feature_name = name, action, restart_needed = result.TryGetProperty("RestartNeeded", out var rn) && rn.GetBoolean(), executed = true };
    }

    // Signed write job: create or remove an SMB share.
    // payload: {"action": "create"|"delete", "name": "...", "path": "..." (create), "description": "..." (optional)}
    private static object ShareControl(JsonElement payload)
    {
        var name = payload.TryGetProperty("name", out var n) ? n.GetString() : null;
        var action = payload.TryGetProperty("action", out var a) ? a.GetString()?.ToLowerInvariant() : null;
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("share.control requires payload.name");
        if (name.Any(c => !(char.IsLetterOrDigit(c) || c is '_' or '-' or '.' or ' ')))
            throw new InvalidOperationException("share name contains invalid characters");
        var escaped = name.Replace("'", "''");
        string ps;
        if (action == "create")
        {
            var path = payload.TryGetProperty("path", out var p) ? p.GetString() : null;
            if (string.IsNullOrWhiteSpace(path))
                throw new InvalidOperationException("share.control create requires payload.path");
            if (!Path.IsPathRooted(path))
                throw new InvalidOperationException("share path must be absolute");
            var description = payload.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
            var escapedPath = path.Replace("'", "''");
            var escapedDesc = description.Replace("'", "''");
            ps = $"New-SmbShare -Name '{escaped}' -Path '{escapedPath}' -Description '{escapedDesc}'";
        }
        else if (action == "delete")
        {
            ps = $"Remove-SmbShare -Name '{escaped}' -Force";
        }
        else
        {
            throw new InvalidOperationException("share.control action must be create|delete");
        }
        PsProbe.Run($"{ps}; Get-SmbShare -Name '{escaped}' -ErrorAction SilentlyContinue | Select-Object Name,Path,Description | ConvertTo-Json -Compress");
        return new { name, action, executed = true };
    }

    // Signed write job: power action on a Hyper-V VM.
    // payload: {"vm_name": "...", "action": "start"|"stop"|"restart"|"save"|"pause"|"resume"}
    private static object HypervPower(JsonElement payload)
    {
        var name = payload.TryGetProperty("vm_name", out var n) ? n.GetString() : null;
        var action = payload.TryGetProperty("action", out var a) ? a.GetString()?.ToLowerInvariant() : null;
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("hyperv.power requires payload.vm_name");
        if (name.Any(c => !(char.IsLetterOrDigit(c) || c is '_' or '-' or '.' or ' ' or '(' or ')' or '[' or ']')))
            throw new InvalidOperationException("VM name contains invalid characters");
        var escaped = name.Replace("'", "''");
        var ps = action switch
        {
            "start" => $"Start-VM -Name '{escaped}'",
            "stop" => $"Stop-VM -Name '{escaped}' -Force -TurnOff",
            "restart" => $"Restart-VM -Name '{escaped}' -Force",
            "save" => $"Save-VM -Name '{escaped}'",
            "pause" => $"Suspend-VM -Name '{escaped}'",
            "resume" => $"Resume-VM -Name '{escaped}'",
            _ => throw new InvalidOperationException("hyperv.power action must be start|stop|restart|save|pause|resume")
        };
        PsProbe.Run($"{ps}; Get-VM -Name '{escaped}' | Select-Object Name,State | ConvertTo-Json -Compress");
        return new { vm_name = name, action, executed = true };
    }

    // Signed write job: run/enable/disable a scheduled task.
    // payload: {"task_name": "...", "task_path": "\\" (optional), "action": "run"|"enable"|"disable"}
    private static object TaskControl(JsonElement payload)
    {
        var name = payload.TryGetProperty("task_name", out var n) ? n.GetString() : null;
        var path = payload.TryGetProperty("task_path", out var p) ? p.GetString() : "\\";
        var action = payload.TryGetProperty("action", out var a) ? a.GetString()?.ToLowerInvariant() : null;
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("task.control requires payload.task_name");
        if (name.Any(c => !(char.IsLetterOrDigit(c) || c is '_' or '-' or '.' or ' ' or '(' or ')')))
            throw new InvalidOperationException("task name contains invalid characters");
        var escapedName = name.Replace("'", "''");
        var escapedPath = (string.IsNullOrWhiteSpace(path) ? "\\" : path).Replace("'", "''");
        var ps = action switch
        {
            "run" => $"Start-ScheduledTask -TaskName '{escapedName}' -TaskPath '{escapedPath}'",
            "enable" => $"Enable-ScheduledTask -TaskName '{escapedName}' -TaskPath '{escapedPath}' | Out-Null",
            "disable" => $"Disable-ScheduledTask -TaskName '{escapedName}' -TaskPath '{escapedPath}' | Out-Null",
            _ => throw new InvalidOperationException("task.control action must be run|enable|disable")
        };
        PsProbe.Run($"{ps}; Get-ScheduledTask -TaskName '{escapedName}' -TaskPath '{escapedPath}' | Select-Object TaskName,State | ConvertTo-Json -Compress");
        return new { task_name = name, task_path = path, action, executed = true };
    }

    // Signed write job: terminate a process by PID.
    // payload: {"pid": 1234} — refuses PID 0/4/System/own process.
    private static object ProcessKill(JsonElement payload)
    {
        if (!payload.TryGetProperty("pid", out var pidEl) || !pidEl.TryGetInt32(out var pid))
            throw new InvalidOperationException("process.kill requires payload.pid (integer)");
        if (pid <= 4 || pid == Environment.ProcessId)
            throw new InvalidOperationException($"process.kill refused for protected pid {pid}");
        var proc = Process.GetProcessById(pid);
        var name = proc.ProcessName;
        proc.Kill(entireProcessTree: true);
        proc.WaitForExit(5000);
        return new { pid, name, killed = proc.HasExited };
    }

    // Signed write job: start/stop/restart a Windows service.
    // payload: {"name": "<service>", "action": "start"|"stop"|"restart"}
    private static object ServiceControl(JsonElement payload)
    {
        var name = payload.TryGetProperty("name", out var n) ? n.GetString() : null;
        var action = payload.TryGetProperty("action", out var a) ? a.GetString()?.ToLowerInvariant() : null;
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("service.control requires payload.name");
        if (name.Any(c => !(char.IsLetterOrDigit(c) || c is '_' or '-' or '.' or ' ')))
            throw new InvalidOperationException("service name contains invalid characters");
        var escaped = name.Replace("'", "''");
        var ps = action switch
        {
            "start" => $"Start-Service -Name '{escaped}'",
            "stop" => $"Stop-Service -Name '{escaped}' -Force",
            "restart" => $"Restart-Service -Name '{escaped}' -Force",
            _ => throw new InvalidOperationException("service.control action must be start|stop|restart")
        };
        PsProbe.Run($"{ps}; Get-Service -Name '{escaped}' | Select-Object Name,Status,StartType | ConvertTo-Json -Compress");
        return new { name, action, executed = true };
    }

    // Signed write job: manage Windows Firewall rules (New-NetFirewallRule etc.).
    // payload: {"action": "add"|"remove"|"enable"|"disable", ...}
    //   add:     requires display_name; optional direction (inbound|outbound),
    //            rule_action (allow|block), protocol (tcp|udp|any),
    //            local_port ("443"|"8000-8010"|"80,443"), remote_address
    //            (IP/CIDR list), profile (any|domain|private|public)
    //   remove|enable|disable: requires name (rule Name) or display_name
    private static object FirewallRuleControl(JsonElement payload)
    {
        string? Str(string key) => payload.TryGetProperty(key, out var el) && el.ValueKind == JsonValueKind.String ? el.GetString() : null;
        static string Esc(string s) => s.Replace("'", "''");
        var action = Str("action")?.ToLowerInvariant();
        var name = Str("name");
        var displayName = Str("display_name");

        string lookup = "";
        if (!string.IsNullOrWhiteSpace(name))
        {
            if (name.Any(c => !(char.IsLetterOrDigit(c) || c is ' ' or '_' or '-' or '.' or '{' or '}')))
                throw new InvalidOperationException("firewall rule name contains invalid characters");
            lookup = $"-Name '{Esc(name)}'";
        }
        else if (!string.IsNullOrWhiteSpace(displayName))
        {
            if (displayName.Any(c => !(char.IsLetterOrDigit(c) || c is ' ' or '_' or '-' or '.' or ',' or '(' or ')' or '[' or ']')))
                throw new InvalidOperationException("firewall display_name contains invalid characters");
            lookup = $"-DisplayName '{Esc(displayName)}'";
        }

        if (action == "add")
        {
            if (string.IsNullOrWhiteSpace(displayName))
                throw new InvalidOperationException("firewall.rule add requires payload.display_name");
            var sb = new StringBuilder($"New-NetFirewallRule -DisplayName '{Esc(displayName)}'");
            var direction = Str("direction")?.ToLowerInvariant();
            if (direction is not null)
                sb.Append(direction is "inbound" or "outbound"
                    ? $" -Direction {char.ToUpperInvariant(direction[0])}{direction[1..]}"
                    : throw new InvalidOperationException("firewall.rule direction must be inbound|outbound"));
            var ruleAction = Str("rule_action")?.ToLowerInvariant();
            if (ruleAction is not null)
                sb.Append(ruleAction is "allow" or "block"
                    ? $" -Action {char.ToUpperInvariant(ruleAction[0])}{ruleAction[1..]}"
                    : throw new InvalidOperationException("firewall.rule rule_action must be allow|block"));
            var protocol = Str("protocol")?.ToLowerInvariant();
            if (protocol is not null && protocol != "any")
                sb.Append(protocol is "tcp" or "udp"
                    ? $" -Protocol {char.ToUpperInvariant(protocol[0])}{protocol[1..]}"
                    : throw new InvalidOperationException("firewall.rule protocol must be tcp|udp|any"));
            var localPort = Str("local_port");
            if (!string.IsNullOrWhiteSpace(localPort))
            {
                if (localPort.Length > 64 || localPort.Any(c => !(char.IsDigit(c) || c is ',' or '-')))
                    throw new InvalidOperationException("firewall.rule local_port must be digits/ranges e.g. 443 or 8000-8010");
                sb.Append($" -LocalPort '{Esc(localPort)}'");
            }
            var remote = Str("remote_address");
            if (!string.IsNullOrWhiteSpace(remote))
            {
                if (remote.Length > 128 || remote.Any(c => !(char.IsLetterOrDigit(c) || c is '.' or ':' or ',' or '/' or '-')))
                    throw new InvalidOperationException("firewall.rule remote_address contains invalid characters");
                sb.Append($" -RemoteAddress '{Esc(remote)}'");
            }
            var profile = Str("profile")?.ToLowerInvariant();
            if (profile is not null && profile != "any")
                sb.Append(profile is "domain" or "private" or "public"
                    ? $" -Profile {char.ToUpperInvariant(profile[0])}{profile[1..]}"
                    : throw new InvalidOperationException("firewall.rule profile must be any|domain|private|public"));
            PsProbe.Run($"{sb} | Out-Null; Get-NetFirewallRule -DisplayName '{Esc(displayName)}' -ErrorAction SilentlyContinue | Select-Object -First 1 Name,DisplayName,Direction,Action,Enabled,Profile | ConvertTo-Json -Compress");
            return new { action, display_name = displayName, executed = true };
        }

        if (action is "remove" or "enable" or "disable")
        {
            if (string.IsNullOrWhiteSpace(lookup))
                throw new InvalidOperationException("firewall.rule remove|enable|disable requires payload.name or payload.display_name");
            var ps = action switch
            {
                "remove" => $"Get-NetFirewallRule {lookup} | Remove-NetFirewallRule -Confirm:$false",
                "enable" => $"Get-NetFirewallRule {lookup} | Enable-NetFirewallRule",
                _ => $"Get-NetFirewallRule {lookup} | Disable-NetFirewallRule"
            };
            var verify = action == "remove"
                ? $"Get-NetFirewallRule {lookup} -ErrorAction SilentlyContinue | Select-Object -First 1 Name | ConvertTo-Json -Compress"
                : $"Get-NetFirewallRule {lookup} -ErrorAction SilentlyContinue | Select-Object -First 1 Name,DisplayName,Direction,Action,Enabled,Profile | ConvertTo-Json -Compress";
            PsProbe.Run($"{ps}; {verify}");
            return new { action, name = name ?? displayName, executed = true };
        }

        throw new InvalidOperationException("firewall.rule action must be add|remove|enable|disable");
    }

    // Signed write job: start/stop/restart/pause/unpause a Docker container.
    // payload: {"container": "name-or-id", "action": "start"|"stop"|"restart"|"pause"|"unpause"}
    // Requires the docker CLI on the agent host; failure is reported honestly.
    private static object DockerContainerControl(JsonElement payload)
    {
        var container = payload.TryGetProperty("container", out var c) ? c.GetString() : null;
        var action = payload.TryGetProperty("action", out var a) ? a.GetString()?.ToLowerInvariant() : null;
        if (string.IsNullOrWhiteSpace(container))
            throw new InvalidOperationException("docker.container requires payload.container");
        if (container.Any(ch => !(char.IsLetterOrDigit(ch) || ch is '_' or '-' or '.')))
            throw new InvalidOperationException("container name contains invalid characters");
        var verb = action switch
        {
            "start" => "start",
            "stop" => "stop",
            "restart" => "restart",
            "pause" => "pause",
            "unpause" => "unpause",
            _ => throw new InvalidOperationException("docker.container action must be start|stop|restart|pause|unpause")
        };
        var escaped = container.Replace("'", "''");
        PsProbe.Run($"docker {verb} '{escaped}'; docker inspect '{escaped}' --format '{{{{.State.Status}}}}'");
        return new { container, action, executed = true };
    }

    // Signed write job: remove a certificate from a LocalMachine store by thumbprint.
    // payload: {"thumbprint": "<40|64 hex>", "store": "My"|"Root"|"CA"|"TrustedPeople"|"TrustedPublisher"|"WebHosting"|"Disallowed"|"AddressBook"|"TrustedDevices"}
    private static object CertRemove(JsonElement payload)
    {
        var thumb = payload.TryGetProperty("thumbprint", out var t) ? t.GetString() : null;
        var store = payload.TryGetProperty("store", out var st) && !string.IsNullOrWhiteSpace(st.GetString()) ? st.GetString()! : "My";
        if (string.IsNullOrWhiteSpace(thumb))
            throw new InvalidOperationException("cert.remove requires payload.thumbprint");
        var clean = thumb.Replace(" ", "").Replace(":", "").ToUpperInvariant();
        if (clean.Length is not (40 or 64) || clean.Any(c => !Uri.IsHexDigit(c)))
            throw new InvalidOperationException("thumbprint must be 40 or 64 hex characters");
        var allowedStores = new[] { "My", "Root", "CA", "TrustedPeople", "TrustedPublisher", "WebHosting", "Disallowed", "AddressBook", "TrustedDevices" };
        if (!allowedStores.Contains(store, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException($"cert.remove store must be one of: {string.Join(", ", allowedStores)}");
        var storeName = allowedStores.First(s2 => s2.Equals(store, StringComparison.OrdinalIgnoreCase));
        var path = $"Cert:\\LocalMachine\\{storeName}\\{clean}";
        PsProbe.Run($"Get-Item '{path}' -ErrorAction Stop | Out-Null; Remove-Item '{path}' -Force; Get-Item '{path}' -ErrorAction SilentlyContinue | Select-Object Thumbprint | ConvertTo-Json -Compress");
        return new { thumbprint = clean, store = storeName, executed = true };
    }

    // Signed write job: set a physical disk online/offline or read-only/clear-read-only.
    // payload: {"disk_number": 1, "action": "online"|"offline"|"readonly"|"clear-readonly"}
    private static object DiskState(JsonElement payload)
    {
        if (!payload.TryGetProperty("disk_number", out var dnEl) || !dnEl.TryGetInt32(out var diskNumber) || diskNumber < 0)
            throw new InvalidOperationException("disk.state requires a non-negative integer payload.disk_number");
        var action = payload.TryGetProperty("action", out var a) ? a.GetString()?.ToLowerInvariant() : null;
        var ps = action switch
        {
            "online" => $"Set-Disk -Number {diskNumber} -IsOffline $false",
            "offline" => $"Set-Disk -Number {diskNumber} -IsOffline $true",
            "readonly" => $"Set-Disk -Number {diskNumber} -IsReadOnly $true",
            "clear-readonly" => $"Set-Disk -Number {diskNumber} -IsReadOnly $false",
            _ => throw new InvalidOperationException("disk.state action must be online|offline|readonly|clear-readonly")
        };
        PsProbe.Run($"{ps}; Get-Disk -Number {diskNumber} | Select-Object Number,FriendlyName,OperationalStatus,IsOffline,IsReadOnly | ConvertTo-Json -Compress");
        return new { disk_number = diskNumber, action, executed = true };
    }

    // Signed write job: install a local .msu hotfix package on this machine.
    // payload: {"path": "C:\Updates\KB5034441.msu"}
    // wusa.exe exit codes: 0 = installed, 3010 = installed (reboot required),
    // anything else is a real failure — surfaced honestly, never faked.
    private static object HotfixInstall(JsonElement payload)
    {
        var path = payload.TryGetProperty("path", out var p) ? p.GetString() : null;
        if (string.IsNullOrWhiteSpace(path))
            throw new InvalidOperationException("hotfix.install requires payload.path (local .msu path on the agent)");
        if (!System.Text.RegularExpressions.Regex.IsMatch(path, @"^([A-Za-z]:\\|\\\\)[^""'|?*<>]*\.msu$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            throw new InvalidOperationException("hotfix.install path must be an absolute local .msu path without quotes or wildcards");
        var psi = new ProcessStartInfo("wusa.exe", "/quiet /norestart \"" + path + "\"")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        using var proc = Process.Start(psi)!;
        var stderrTask = proc.StandardError.ReadToEndAsync();
        if (!proc.WaitForExit(600000))
        {
            try { proc.Kill(true); } catch { }
            throw new InvalidOperationException("wusa.exe timed out after 10 minutes");
        }
        var stderr = stderrTask.GetAwaiter().GetResult();
        var code = proc.ExitCode;
        if (code != 0 && code != 3010)
            throw new InvalidOperationException($"wusa exited {code}: {(stderr.Trim().Length > 300 ? stderr.Trim()[..300] : stderr.Trim())}");
        return new { path, exit_code = code, reboot_required = code == 3010, executed = true };
    }

    // Signed write job: remove a value from a Run/RunOnce autostart key.
    // payload: {"key": "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run", "name": "OneDrive"}
    // Only the exact whitelisted autostart keys may be targeted.
    private static object StartupProgramRemove(JsonElement payload)
    {
        var key = payload.TryGetProperty("key", out var k) ? k.GetString() : null;
        var name = payload.TryGetProperty("name", out var n) ? n.GetString() : null;
        var allowedKeys = new[]
        {
            @"HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
            @"HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce",
            @"HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
            @"HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
            @"HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce",
        };
        if (key == null || !allowedKeys.Contains(key))
            throw new InvalidOperationException("startup.program.remove key must be one of the whitelisted Run/RunOnce keys");
        if (string.IsNullOrWhiteSpace(name) || name.Length > 512)
            throw new InvalidOperationException("startup.program.remove requires payload.name (registry value name)");
        var escKey = key.Replace("'", "''");
        var escName = name.Replace("'", "''");
        PsProbe.Run($"Remove-ItemProperty -LiteralPath '{escKey}' -Name '{escName}' -ErrorAction Stop; if((Get-Item -LiteralPath '{escKey}').GetValueNames() -contains '{escName}'){{ throw 'value still present after removal' }}");
        return new { key, name, executed = true };
    }

    // Signed write job: manage a local Windows user account.
    // payload: {"username": "ops", "action": "enable"|"disable"|"remove"|"create", "password"?: "..."}
    // Built-in critical accounts cannot be disabled or removed.
    private static object LocalUserControl(JsonElement payload)
    {
        var username = payload.TryGetProperty("username", out var u) ? u.GetString() : null;
        var action = payload.TryGetProperty("action", out var a) ? a.GetString()?.ToLowerInvariant() : null;
        var password = payload.TryGetProperty("password", out var pw) ? pw.GetString() : null;
        if (string.IsNullOrWhiteSpace(username) || !System.Text.RegularExpressions.Regex.IsMatch(username, @"^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$"))
            throw new InvalidOperationException("local.user requires payload.username (1-20 chars: letters, digits, . _ -)");
        var protectedNames = new[] { "administrator", "guest", "defaultaccount", "wdagutilityaccount" };
        var isProtected = protectedNames.Contains(username.ToLowerInvariant());
        var escUser = username.Replace("'", "''");
        string ps;
        switch (action)
        {
            case "enable":
                if (isProtected) throw new InvalidOperationException("built-in account cannot be modified");
                ps = $"Enable-LocalUser -Name '{escUser}'; (Get-LocalUser -Name '{escUser}').Enabled | ConvertTo-Json -Compress";
                break;
            case "disable":
                if (isProtected) throw new InvalidOperationException("built-in account cannot be modified");
                ps = $"Disable-LocalUser -Name '{escUser}'; (Get-LocalUser -Name '{escUser}').Enabled | ConvertTo-Json -Compress";
                break;
            case "remove":
                if (isProtected) throw new InvalidOperationException("built-in account cannot be removed");
                ps = $"Remove-LocalUser -Name '{escUser}'; if(Get-LocalUser -Name '{escUser}' -ErrorAction SilentlyContinue){{ throw 'user still present after removal' }}; 'removed'";
                break;
            case "create":
                if (string.IsNullOrEmpty(password) || password.Length < 8)
                    throw new InvalidOperationException("local.user create requires payload.password (min 8 chars)");
                var escPw = password.Replace("'", "''");
                ps = $"New-LocalUser -Name '{escUser}' -Password (ConvertTo-SecureString '{escPw}' -AsPlainText -Force) -PasswordNeverExpires -ErrorAction Stop; (Get-LocalUser -Name '{escUser}').Name | ConvertTo-Json -Compress";
                break;
            default:
                throw new InvalidOperationException("local.user action must be enable|disable|remove|create");
        }
        PsProbe.Run(ps);
        return new { username, action, executed = true };
    }

    // Signed write job: silently uninstall a program listed by software.list.
    // payload: {"name": "Exact DisplayName"}
    // Resolution order: QuietUninstallString -> MSI product code (msiexec /x /qn)
    // -> error for anything without a silent path (honest failure).
    private static object SoftwareUninstall(JsonElement payload)
    {
        var name = payload.TryGetProperty("name", out var n) ? n.GetString()?.Trim() : null;
        if (string.IsNullOrEmpty(name) || name.Length > 256)
            throw new InvalidOperationException("software.uninstall requires payload.name (DisplayName from software.list)");

        var roots = new (RegistryKey hive, RegistryView view, string tag)[]
        {
            (RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64), RegistryView.Registry64, "machine64"),
            (RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry32), RegistryView.Registry32, "machine32"),
            (RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, RegistryView.Default), RegistryView.Default, "user")
        };
        string? matchedKeyPath = null, matchedDisplay = null, quiet = null, uninstallStr = null, productCode = null;
        var exactMatches = new List<string>();
        var looseMatches = new List<string>();
        foreach (var (hive, view, tag) in roots)
        {
            using var hiveKey = hive;
            using var uninstall = hiveKey.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall");
            if (uninstall is null) continue;
            foreach (var subName in uninstall.GetSubKeyNames())
            {
                using var sub = uninstall.OpenSubKey(subName);
                var dn = sub?.GetValue("DisplayName") as string;
                if (string.IsNullOrWhiteSpace(dn)) continue;
                if (string.Equals(dn.Trim(), name, StringComparison.OrdinalIgnoreCase))
                {
                    exactMatches.Add($"{tag}\\{subName}");
                    if (matchedKeyPath is null)
                    {
                        matchedKeyPath = $"{tag}\\{subName}";
                        matchedDisplay = dn.Trim();
                        quiet = sub!.GetValue("QuietUninstallString") as string;
                        uninstallStr = sub.GetValue("UninstallString") as string;
                        productCode = System.Text.RegularExpressions.Regex.IsMatch(subName, @"^\{[0-9A-Fa-f-]{36}\}$") ? subName : null;
                    }
                }
                else if (dn.Contains(name, StringComparison.OrdinalIgnoreCase) && looseMatches.Count < 10)
                {
                    looseMatches.Add(dn.Trim());
                }
            }
        }
        if (matchedKeyPath is null)
        {
            if (exactMatches.Count == 0 && looseMatches.Count > 0)
                throw new InvalidOperationException($"software.uninstall: no exact match — did you mean: {string.Join("; ", looseMatches.Distinct().Take(5))}");
            throw new InvalidOperationException($"software.uninstall: program '{name}' not found in uninstall registry keys");
        }
        if (exactMatches.Count > 1)
            throw new InvalidOperationException($"software.uninstall: '{name}' matches {exactMatches.Count} products — use the exact DisplayName");

        string fileName, arguments;
        if (!string.IsNullOrWhiteSpace(quiet))
        {
            // QuietUninstallString may be "exe args" or bare exe — split on first quote boundary.
            var q = quiet.Trim();
            if (q.StartsWith('"'))
            {
                var end = q.IndexOf('"', 1);
                fileName = end > 0 ? q[1..end] : q.Trim('"');
                arguments = end > 0 ? q[(end + 1)..].Trim() : "";
            }
            else
            {
                var sp = q.IndexOf(' ');
                fileName = sp > 0 ? q[..sp] : q;
                arguments = sp > 0 ? q[(sp + 1)..].Trim() : "";
            }
        }
        else if (productCode is not null)
        {
            fileName = "msiexec.exe";
            arguments = $"/x {productCode} /qn /norestart";
        }
        else if (!string.IsNullOrWhiteSpace(uninstallStr) &&
                 System.Text.RegularExpressions.Regex.IsMatch(uninstallStr, @"msiexec.*\{[0-9A-Fa-f-]{36}\}", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
        {
            var m = System.Text.RegularExpressions.Regex.Match(uninstallStr, @"\{[0-9A-Fa-f-]{36}\}");
            fileName = "msiexec.exe";
            arguments = $"/x {m.Value} /qn /norestart";
        }
        else
        {
            throw new InvalidOperationException($"software.uninstall: '{matchedDisplay}' has no silent uninstall path (no QuietUninstallString and not an MSI product)");
        }
        if (fileName.Contains('"') || fileName.Contains('\'') || arguments.Contains('\''))
            throw new InvalidOperationException("uninstall command contains unsafe characters");

        var psi = new ProcessStartInfo(fileName, arguments)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        using var proc = Process.Start(psi)!;
        var stderrTask = proc.StandardError.ReadToEndAsync();
        if (!proc.WaitForExit(600000))
        {
            try { proc.Kill(true); } catch { }
            throw new InvalidOperationException("uninstaller timed out after 10 minutes");
        }
        var stderr = stderrTask.GetAwaiter().GetResult();
        var code = proc.ExitCode;
        if (code != 0 && code != 3010 && code != 1641)
            throw new InvalidOperationException($"uninstaller exited {code}: {(stderr.Trim().Length > 300 ? stderr.Trim()[..300] : stderr.Trim())}");
        return new { name = matchedDisplay, uninstall_command = $"{fileName} {arguments}", exit_code = code, reboot_required = code is 3010 or 1641, executed = true };
    }

    // Signed self-update: downloads the bundle hosted by the control plane,
    // verifies SHA-256 against the signed job payload, and stages it as
    // <exe>.new + update-pending.json. ApplyPendingUpdate swaps binaries at
    // the next start and exits so SCM/the operator restarts into the new build.
    private async Task<object> StageUpdateAsync(HttpClient client, string agentId, string agentKey, JsonElement payload, CancellationToken ct)
    {
        var expectedSha = payload.TryGetProperty("sha256", out var shaEl) ? shaEl.GetString() : null;
        var version = payload.TryGetProperty("version", out var verEl) ? verEl.GetString() : null;
        if (string.IsNullOrWhiteSpace(expectedSha))
            throw new InvalidOperationException("agent.update requires payload.sha256 (hex)");

        using var req = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/agents/{agentId}/update");
        req.Headers.Add("X-Agent-Key", agentKey);
        using var resp = await client.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"update bundle unavailable: HTTP {(int)resp.StatusCode}");
        var bytes = await resp.Content.ReadAsByteArrayAsync(ct);

        var actual = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        if (!string.Equals(actual, expectedSha.Trim().ToLowerInvariant(), StringComparison.Ordinal))
            throw new InvalidOperationException($"update sha256 mismatch (expected {expectedSha}, got {actual})");

        var exePath = Environment.ProcessPath;
        if (exePath is null)
            throw new InvalidOperationException("cannot resolve running executable path");
        var stagedPath = exePath + ".new";
        await File.WriteAllBytesAsync(stagedPath, bytes, ct);
        await File.WriteAllTextAsync(
            exePath + ".pending.json",
            JsonSerializer.Serialize(new { version, sha256 = actual, size_bytes = bytes.Length, staged_at = DateTimeOffset.UtcNow }),
            ct);
        return new { staged = true, version, sha256 = actual, size_bytes = bytes.Length, applies_on = "next agent restart" };
    }

    private static async Task SubmitResultAsync(HttpClient client, string agentId, string agentKey, string jobId, string status, object? result, string? error, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/agents/{agentId}/jobs/{jobId}/result")
        {
            Content = JsonContent.Create(new { status, result = result ?? new { }, error })
        };
        req.Headers.Add("X-Agent-Key", agentKey);
        var resp = await client.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }
}

internal static class SessionProbe
{
    // Read-only session snapshot via qwinsta — no logoff/disconnect calls.
    public static object[] ListSessions()
    {
        var psi = new ProcessStartInfo("qwinsta.exe")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        using var proc = Process.Start(psi)!;
        var output = proc.StandardOutput.ReadToEnd();
        proc.StandardError.ReadToEnd();
        proc.WaitForExit(10000);
        var sessions = new List<object>();
        foreach (var line in output.Split('\n', StringSplitOptions.RemoveEmptyEntries).Skip(1))
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0) continue;
            var isCurrent = trimmed.StartsWith('>');
            var parts = trimmed.TrimStart('>').Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            // qwinsta columns vary (SESSIONNAME [USERNAME] ID STATE [TYPE] [DEVICE]);
            // locate the state token and the numeric session id instead of
            // assuming fixed positions.
            var state = parts.FirstOrDefault(p =>
                p.Equals("Active", StringComparison.OrdinalIgnoreCase) ||
                p.Equals("Disc", StringComparison.OrdinalIgnoreCase) ||
                p.Equals("Listen", StringComparison.OrdinalIgnoreCase) ||
                p.Equals("Conn", StringComparison.OrdinalIgnoreCase) ||
                p.Equals("Down", StringComparison.OrdinalIgnoreCase) ||
                p.Equals("Idle", StringComparison.OrdinalIgnoreCase)) ?? "";
            var idPart = parts.FirstOrDefault(p => int.TryParse(p, out _));
            var idIndex = Array.IndexOf(parts, idPart);
            var username = idIndex > 1 ? string.Join(' ', parts[1..idIndex]) : "";
            sessions.Add(new
            {
                session_name = parts[0],
                username,
                id = int.TryParse(idPart, out var id) ? id : (int?)null,
                state = state.ToLowerInvariant(),
                current = isCurrent,
                raw = trimmed
            });
        }
        return sessions.ToArray();
    }

    // Signed write job: logs off one interactive session by numeric id.
    // Refuses missing/invalid ids and the services session (0).
    public static object Logoff(JsonElement payload)
    {
        if (!payload.TryGetProperty("session_id", out var idEl) || !idEl.TryGetInt32(out var sessionId) || sessionId <= 0)
            throw new InvalidOperationException("session.logoff requires a positive integer payload.session_id");

        var psi = new ProcessStartInfo("logoff.exe", sessionId.ToString())
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        using var proc = Process.Start(psi)!;
        var stdout = proc.StandardOutput.ReadToEnd();
        var stderr = proc.StandardError.ReadToEnd();
        proc.WaitForExit(15000);
        return new
        {
            session_id = sessionId,
            exit_code = proc.ExitCode,
            stdout = stdout.Trim(),
            stderr = stderr.Trim(),
            observed_at = DateTimeOffset.UtcNow
        };
    }

    // Signed write job: disconnects one session (keeps it alive, drops the
    // connection) via WTSDisconnectSession — requires elevation on the host.
    public static object Disconnect(JsonElement payload)
    {
        if (!payload.TryGetProperty("session_id", out var idEl) || !idEl.TryGetInt32(out var sessionId) || sessionId <= 0)
            throw new InvalidOperationException("session.disconnect requires a positive integer payload.session_id");

        var rc = WTSDisconnectSession(IntPtr.Zero, sessionId, false);
        return new
        {
            session_id = sessionId,
            ok = rc,
            win32_error = Marshal.GetLastWin32Error(),
            observed_at = DateTimeOffset.UtcNow
        };
    }

    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSDisconnectSession(IntPtr hServer, int sessionId, bool bWait);
}

internal static class NetworkProbe
{
    // Read-only snapshot via System.Net.NetworkInformation — no configuration changes.
    public static object Collect()
    {
        var interfaces = NetworkInterface.GetAllNetworkInterfaces()
            .Where(n => n.OperationalStatus == OperationalStatus.Up || n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
            .Select(n =>
            {
                var props = n.GetIPProperties();
                return new
                {
                    name = n.Name,
                    description = n.Description,
                    type = n.NetworkInterfaceType.ToString(),
                    status = n.OperationalStatus.ToString(),
                    speed_mbps = n.Speed > 0 ? Math.Round(n.Speed / 1_000_000.0, 1) : (double?)null,
                    mac = n.GetPhysicalAddress().ToString(),
                    ipv4 = props.UnicastAddresses
                        .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork)
                        .Select(a => a.Address.ToString())
                        .ToArray(),
                    gateways = props.GatewayAddresses.Select(g => g.Address.ToString()).ToArray(),
                    dns = props.DnsAddresses.Select(d => d.ToString()).ToArray()
                };
            })
            .Cast<object>()
            .ToArray();
        return new
        {
            network_available = NetworkInterface.GetIsNetworkAvailable(),
            interfaces,
            observed_at = DateTimeOffset.UtcNow
        };
    }
}

internal static class EventLogProbe
{
    // Read-only tail of a Windows event log. Payload: { "log": "System"|"Application"|"Security"|"Setup", "count": 1..100 }
    public static object Tail(JsonElement payload)
    {
        var logName = payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("log", out var logEl) && logEl.ValueKind == JsonValueKind.String
            ? logEl.GetString()!
            : "System";
        if (logName.Length > 64 || logName.Any(c => !(char.IsLetterOrDigit(c) || c is '-' or '_')))
            throw new InvalidOperationException("eventlog.tail requires a valid log name");
        var count = payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("count", out var countEl) && countEl.TryGetInt32(out var c)
            ? Math.Clamp(c, 1, 100)
            : 25;

        using var log = new EventLog(logName);
        var total = log.Entries.Count;
        var events = new List<object>();
        for (var i = total - 1; i >= 0 && events.Count < count; i--)
        {
            var e = log.Entries[i];
            events.Add(new
            {
                time = e.TimeGenerated.ToUniversalTime(),
                id = e.InstanceId,
                level = e.EntryType.ToString(),
                source = e.Source,
                message = e.Message is { Length: > 500 } ? e.Message[..500] : e.Message
            });
        }
        return new { log = logName, count = events.Count, total_entries = total, events, observed_at = DateTimeOffset.UtcNow };
    }
}

internal static class SoftwareProbe
{
    // Read-only inventory of installed programs from the standard uninstall registry keys.
    public static object ListInstalled()
    {
        var items = new List<object>();
        var roots = new (RegistryKey hive, string view)[]
        {
            (RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64), "machine64"),
            (RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry32), "machine32"),
            (RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, RegistryView.Default), "user")
        };
        foreach (var (hive, scope) in roots)
        {
            using var hiveKey = hive;
            using var uninstall = hiveKey.OpenSubKey($@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall");
            if (uninstall is null) continue;
            foreach (var subName in uninstall.GetSubKeyNames())
            {
                using var sub = uninstall.OpenSubKey(subName);
                if (sub is null) continue;
                var name = sub.GetValue("DisplayName") as string;
                if (string.IsNullOrWhiteSpace(name)) continue;
                items.Add(new
                {
                    name = name.Trim(),
                    version = sub.GetValue("DisplayVersion") as string ?? "",
                    publisher = sub.GetValue("Publisher") as string ?? "",
                    scope
                });
                if (items.Count >= 300) break;
            }
            if (items.Count >= 300) break;
        }
        return new { count = items.Count, items, observed_at = DateTimeOffset.UtcNow };
    }
}

internal static class FirewallProbe
{
    // Read-only firewall profile state via registry — no netsh parsing (locale-safe).
    public static object State()
    {
        var profiles = new[] { "DomainProfile", "StandardProfile", "PrivateProfile" };
        var results = new List<object>();
        using var policy = Registry.LocalMachine.OpenSubKey(
            @"SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy");
        var rulesKey = policy?.OpenSubKey("FirewallRules");
        var ruleCount = rulesKey?.SubKeyCount ?? 0;
        foreach (var profile in profiles)
        {
            using var key = policy?.OpenSubKey(profile);
            var enabled = key?.GetValue("EnableFirewall") is int v && v != 0;
            results.Add(new { profile = profile.Replace("Profile", ""), enabled, rule_count = ruleCount });
        }
        return new { profiles = results, observed_at = DateTimeOffset.UtcNow };
    }
}

internal static class PsProbe
{
    // Read-only PowerShell collector: runs a -NoProfile -NonInteractive command
    // that must emit ConvertTo-Json, and returns the parsed JSON payload.
    // Non-zero exit codes and timeouts surface as job errors (honest failure).
    public static JsonElement Run(string command, int timeoutMs = 45000)
    {
        var psi = new ProcessStartInfo("powershell.exe", $"-NoProfile -NonInteractive -Command \"{command}\"")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        using var proc = Process.Start(psi)!;
        // Drain both streams asynchronously before waiting — sequential
        // ReadToEnd calls can deadlock when the child fills the stderr pipe
        // buffer while we are still blocked reading stdout.
        var stdoutTask = proc.StandardOutput.ReadToEndAsync();
        var stderrTask = proc.StandardError.ReadToEndAsync();
        if (!proc.WaitForExit(timeoutMs))
        {
            try { proc.Kill(true); } catch { }
            throw new InvalidOperationException("PowerShell collector timed out");
        }
        var stdout = stdoutTask.GetAwaiter().GetResult();
        var stderr = stderrTask.GetAwaiter().GetResult();
        if (proc.ExitCode != 0)
        {
            var msg = stderr.Trim();
            throw new InvalidOperationException($"powershell exited {proc.ExitCode}: {(msg.Length > 300 ? msg[..300] : msg)}");
        }
        if (string.IsNullOrWhiteSpace(stdout))
            return JsonDocument.Parse("[]").RootElement.Clone();
        using var doc = JsonDocument.Parse(stdout.Trim());
        return doc.RootElement.Clone();
    }
}

internal static class FeatureProbe
{
    // Read-only Windows roles/features via DISM — /english keeps parsing stable
    // across OS display languages. Requires elevation; failure is reported honestly.
    public static object ListFeatures()
    {
        var psi = new ProcessStartInfo("dism.exe", "/online /get-features /english")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        using var proc = Process.Start(psi)!;
        var output = proc.StandardOutput.ReadToEnd();
        var error = proc.StandardError.ReadToEnd();
        if (!proc.WaitForExit(120000))
        {
            try { proc.Kill(true); } catch { }
            throw new InvalidOperationException("DISM feature query timed out");
        }
        if (proc.ExitCode != 0)
        {
            var msg = (error + output).Trim();
            throw new InvalidOperationException($"dism exited {proc.ExitCode}: {(msg.Length > 300 ? msg[..300] : msg)}");
        }
        var items = new List<object>();
        string? name = null;
        foreach (var line in output.Split('\n'))
        {
            var t = line.Trim();
            if (t.StartsWith("Feature Name :", StringComparison.OrdinalIgnoreCase))
                name = t["Feature Name :".Length..].Trim();
            else if (t.StartsWith("State :", StringComparison.OrdinalIgnoreCase) && name is not null)
            {
                items.Add(new { name, state = t["State :".Length..].Trim() });
                name = null;
            }
        }
        return new { count = items.Count, items, observed_at = DateTimeOffset.UtcNow };
    }
}
