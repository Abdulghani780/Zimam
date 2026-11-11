using System.Diagnostics;
using System.Net.Http.Json;
using System.Security.Cryptography.X509Certificates;
using Microsoft.Extensions.Hosting;

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

sealed class AgentWorker(IHttpClientFactory clients, ILogger<AgentWorker> logger) : BackgroundService
{
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
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
