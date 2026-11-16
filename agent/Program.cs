using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Json;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Win32;
using NSec.Cryptography;

// --- CLI management commands -------------------------------------------------
// `Asaas.WindowsAgent.exe install|uninstall|status` manages the Windows service
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
    Sc("description", ServiceName, "ASAAS Server Control outbound agent - polls for signed jobs and reports inventory.");

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
        "system.info", "process.list", "service.list", "disk.list", "inventory.collect", "session.list", "session.logoff",
        "network.info", "eventlog.tail", "software.list", "firewall.state"
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
            result = ExecuteJob(job.Type, job.Payload);
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
        "service.list" => ServiceProbe.ListServices(),
        "disk.list" => DriveInfo.GetDrives()
            .Where(d => d.IsReady)
            .Select(d => new { name = d.Name, total_gb = Math.Round(d.TotalSize / 1073741824.0, 1), free_gb = Math.Round(d.AvailableFreeSpace / 1073741824.0, 1) })
            .ToArray(),
        "session.list" => SessionProbe.ListSessions(),
        "session.logoff" => SessionProbe.Logoff(payload),
        "network.info" => NetworkProbe.Collect(),
        "eventlog.tail" => EventLogProbe.Tail(payload),
        "software.list" => SoftwareProbe.ListInstalled(),
        "firewall.state" => FirewallProbe.State(),
        "inventory.collect" => new
        {
            hostname = Environment.MachineName,
            os = Environment.OSVersion.VersionString,
            process_count = Process.GetProcesses().Length,
            disk_count = DriveInfo.GetDrives().Count(d => d.IsReady),
            observed_at = DateTimeOffset.UtcNow
        },
        _ => throw new InvalidOperationException($"Unsupported job type: {type}")
    };

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
}

internal static class ServiceProbe
{
    public static object[] ListServices()
    {
        // Read-only snapshot via sc.exe query — no service control operations.
        var psi = new ProcessStartInfo("sc.exe", "query state= all")
        {
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        using var proc = Process.Start(psi)!;
        var output = proc.StandardOutput.ReadToEnd();
        proc.WaitForExit(10000);
        return output.Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Where(l => l.StartsWith("SERVICE_NAME:", StringComparison.OrdinalIgnoreCase))
            .Take(200)
            .Select(l => new { name = l["SERVICE_NAME:".Length..].Trim() })
            .Cast<object>()
            .ToArray();
    }
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
