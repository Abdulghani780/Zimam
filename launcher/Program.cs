using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;

namespace ZimamLauncher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            try
            {
                string scriptDir = AppDomain.CurrentDomain.BaseDirectory;
                string projectDir = Directory.GetParent(scriptDir.TrimEnd('\\')).FullName;
                string mainPy = Path.Combine(projectDir, "backend", "main.py");
                string dataDir = Path.Combine(projectDir, "data");
                string browserProfile = Path.Combine(dataDir, "browser_profile");
                string url = "http://127.0.0.1:8765";

                if (!Directory.Exists(dataDir)) Directory.CreateDirectory(dataDir);
                if (!Directory.Exists(browserProfile)) Directory.CreateDirectory(browserProfile);

                // Locate pythonw.exe
                string pyw = @"C:\Python315\pythonw.exe";
                if (!File.Exists(pyw)) pyw = @"C:\Python312\pythonw.exe";
                if (!File.Exists(pyw)) pyw = @"C:\Program Files\Python312\pythonw.exe";
                if (!File.Exists(pyw)) pyw = "pythonw.exe";

                // Check if server is running
                bool serverOnline = IsServerResponding(url + "/api/health");
                if (!serverOnline)
                {
                    ProcessStartInfo pyPsi = new ProcessStartInfo
                    {
                        FileName = pyw,
                        Arguments = "\"" + mainPy + "\"",
                        WorkingDirectory = projectDir,
                        UseShellExecute = true,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    Process.Start(pyPsi);

                    for (int i = 0; i < 30; i++)
                    {
                        Thread.Sleep(250);
                        if (IsServerResponding(url + "/api/health"))
                        {
                            serverOnline = true;
                            break;
                        }
                    }
                }

                // Locate browser (Chrome or Edge)
                string chrome = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
                if (!File.Exists(chrome)) chrome = @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe";
                string edge = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                if (!File.Exists(edge)) edge = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";

                string browserExe = "";
                if (File.Exists(chrome)) browserExe = chrome;
                else if (File.Exists(edge)) browserExe = edge;

                if (!string.IsNullOrEmpty(browserExe))
                {
                    string args = string.Format("--user-data-dir=\"{0}\" --app=\"{1}/\" --new-window --start-maximized", browserProfile, url);
                    ProcessStartInfo bPsi = new ProcessStartInfo
                    {
                        FileName = browserExe,
                        Arguments = args,
                        UseShellExecute = true
                    };
                    Process.Start(bPsi);
                }
                else
                {
                    ProcessStartInfo defPsi = new ProcessStartInfo
                    {
                        FileName = url + "/",
                        UseShellExecute = true
                    };
                    Process.Start(defPsi);
                }
            }
            catch { }
        }

        static bool IsServerResponding(string testUrl)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(testUrl);
                req.Timeout = 800;
                req.ReadWriteTimeout = 800;
                req.Method = "GET";
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
