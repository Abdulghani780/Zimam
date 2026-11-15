using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using NSec.Cryptography;

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
        handler.ClientCertificates.Add(new X509Certificate2(certPath, certPassword));
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
        "system.info", "process.list", "service.list", "disk.list", "inventory.collect", "session.list", "session.logoff"
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
