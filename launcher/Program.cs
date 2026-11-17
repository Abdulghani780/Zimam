using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;

namespace AsaasLauncher
{
    // ASAAS dev launcher: kills stale project listeners, starts the current
    // backend (:8765) + control plane (:8876) from this repo, opens the UI in
    // an app window, and shuts the servers down when that window closes.
    static class Program
    {
        private const int BackendPort = 8765;
        private const int ControlPlanePort = 8876;

        [STAThread]
        static int Main()
        {
            try
            {
                string scriptDir = AppDomain.CurrentDomain.BaseDirectory;
                string projectDir = Directory.GetParent(scriptDir.TrimEnd('\\'))!.FullName;
                string dataDir = Path.Combine(projectDir, "data");
                string browserProfile = Path.Combine(dataDir, "browser_profile");
                string url = $"http://127.0.0.1:{ControlPlanePort}";

                Directory.CreateDirectory(dataDir);
                Directory.CreateDirectory(browserProfile);

                // Always start from the CURRENT tree: free the project ports so
                // an old installed ASAAS/ASAAS build can never answer instead.
                KillPortListeners(BackendPort);
                KillPortListeners(ControlPlanePort);
                Thread.Sleep(400);

                string pyw = ResolvePythonW(projectDir);
                var started = new List<Process>();

                // Legacy backend (real Windows admin APIs on :8765) — loopback
                // only; the control plane proxies every call so the port is
                // invisible to other machines on the network.
                var bePsi = new ProcessStartInfo
                {
                    FileName = pyw,
                    Arguments = "\"backend\\main.py\" --host 127.0.0.1",
                    WorkingDirectory = projectDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                bePsi.EnvironmentVariables["ASAAS_HOST"] = "127.0.0.1";
                started.Add(Process.Start(bePsi)!);

                // Control plane + built SPA on :8876 (proxies legacy /api).
                var cpPsi = new ProcessStartInfo
                {
                    FileName = pyw,
                    Arguments = "\"control_plane\\serve.py\"",
                    WorkingDirectory = projectDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                cpPsi.EnvironmentVariables["PYTHONPATH"] = Path.Combine(projectDir, "control_plane");
                started.Add(Process.Start(cpPsi)!);

                // Wait for the control plane (it also waits on the backend proxy
                // lazily, so backend health is checked but not blocking forever).
                WaitForHealth($"{url}/api/health", 60_000);

                // Open the UI in a dedicated app window; the launcher stays
                // alive and kills the servers when the window closes.
                Process? browser = LaunchBrowser(browserProfile, url);
                if (browser != null)
                {
                    browser.WaitForExit();
                }
                else
                {
                    // No manageable browser — fall back to default handler and
                    // keep servers running (user closes them manually).
                    Process.Start(new ProcessStartInfo { FileName = url + "/", UseShellExecute = true });
                    return 0;
                }

                foreach (var p in started)
                {
                    try { if (!p.HasExited) p.Kill(true); } catch { }
                    try { p.Dispose(); } catch { }
                }
                return 0;
            }
            catch
            {
                return 1;
            }
        }

        private static string ResolvePythonW(string projectDir)
        {
            var candidates = new[]
            {
                Path.Combine(projectDir, ".venv", "Scripts", "pythonw.exe"),
                Path.Combine(projectDir, ".venv", "Scripts", "python.exe"),
                @"C:\Python315\pythonw.exe",
                @"C:\Python312\pythonw.exe",
                @"C:\Program Files\Python312\pythonw.exe",
                "pythonw.exe",
            };
            foreach (var c in candidates)
                if (File.Exists(c)) return c;
            return "pythonw.exe";
        }

        private static Process StartHidden(string exe, string script, string workDir)
        {
            var psi = new ProcessStartInfo
            {
                FileName = exe,
                Arguments = "\"" + script + "\"",
                WorkingDirectory = workDir,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            return Process.Start(psi)!;
        }

        private static void WaitForHealth(string testUrl, int timeoutMs)
        {
            var deadline = Environment.TickCount64 + timeoutMs;
            while (Environment.TickCount64 < deadline)
            {
                if (IsServerResponding(testUrl)) return;
                Thread.Sleep(400);
            }
        }

        private static Process? LaunchBrowser(string profileDir, string url)
        {
            string chrome = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
            if (!File.Exists(chrome)) chrome = @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe";
            string edge = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
            if (!File.Exists(edge)) edge = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";

            string browserExe = File.Exists(chrome) ? chrome : File.Exists(edge) ? edge : "";
            if (browserExe.Length == 0) return null;

            var psi = new ProcessStartInfo
            {
                FileName = browserExe,
                Arguments = $"--user-data-dir=\"{profileDir}\" --app=\"{url}/\" --new-window --start-maximized",
                UseShellExecute = false,
            };
            return Process.Start(psi);
        }

        private static void KillPortListeners(int port)
        {
            // Parse `netstat -ano` for LISTENING sockets on the project ports and
            // kill the owning PID. Project-specific ports only.
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "netstat.exe",
                    Arguments = "-ano -p tcp",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true,
                };
                using var proc = Process.Start(psi)!;
                string output = proc.StandardOutput.ReadToEnd();
                proc.WaitForExit(10_000);

                var pids = new HashSet<int>();
                foreach (var line in output.Split('\n'))
                {
                    var t = line.Trim();
                    if (!t.Contains(":") || !t.EndsWith("LISTENING", StringComparison.OrdinalIgnoreCase))
                        continue;
                    var parts = t.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length < 5) continue;
                    // Local address is parts[1] like 127.0.0.1:8765 or 0.0.0.0:8876
                    var local = parts[1];
                    int idx = local.LastIndexOf(':');
                    if (idx < 0) continue;
                    if (!int.TryParse(local[(idx + 1)..], out int lp) || lp != port) continue;
                    if (int.TryParse(parts[^1], out int pid) && pid > 4) pids.Add(pid);
                }

                foreach (var pid in pids)
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = "taskkill.exe",
                            Arguments = $"/PID {pid} /F /T",
                            UseShellExecute = false,
                            CreateNoWindow = true,
                        })?.WaitForExit(5_000);
                    }
                    catch { }
                }
            }
            catch { }
        }

        private static bool IsServerResponding(string testUrl)
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create(testUrl);
                req.Timeout = 800;
                req.ReadWriteTimeout = 800;
                req.Method = "GET";
                using var resp = (HttpWebResponse)req.GetResponse();
                return resp.StatusCode == HttpStatusCode.OK;
            }
            catch
            {
                return false;
            }
        }
    }
}
