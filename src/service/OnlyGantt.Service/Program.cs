using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.ServiceProcess;

namespace OnlyGantt.Service;

internal static class Program
{
    private const int DefaultPort = 3000;
    private const long MaxLogBytes = 10 * 1024 * 1024;

    public static int Main(string[] args)
    {
        try
        {
            var options = ServiceOptions.Parse(args);
            if (options.ShowHelp)
            {
                Console.WriteLine(ServiceOptions.HelpText);
                return 0;
            }

            var runner = new NodeServerRunner(options);
            if (options.ConsoleMode || Environment.UserInteractive)
            {
                return runner.RunConsole();
            }

            ServiceBase.Run(new OnlyGanttWindowsService(runner));
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private sealed class OnlyGanttWindowsService : ServiceBase
    {
        private readonly NodeServerRunner runner;

        public OnlyGanttWindowsService(NodeServerRunner runner)
        {
            ServiceName = "OnlyGanttWeb";
            CanStop = true;
            CanShutdown = true;
            AutoLog = true;
            this.runner = runner;
        }

        protected override void OnStart(string[] args)
        {
            try
            {
                runner.Start();
            }
            catch (Exception ex)
            {
                ServiceDiagnostics.WriteStartupFailure(ex);
                throw;
            }
        }

        protected override void OnStop()
        {
            runner.Stop();
        }

        protected override void OnShutdown()
        {
            runner.Stop();
            base.OnShutdown();
        }
    }

    private sealed class NodeServerRunner
    {
        private readonly ServiceOptions options;
        private readonly object sync = new();
        private Process? process;
        private bool stopping;
        private Task? stdoutTask;
        private Task? stderrTask;

        public NodeServerRunner(ServiceOptions options)
        {
            this.options = options;
        }

        public int RunConsole()
        {
            Start();
            process?.WaitForExit();
            return process?.ExitCode ?? 1;
        }

        public void Start()
        {
            lock (sync)
            {
                if (process is { HasExited: false })
                {
                    return;
                }

                stopping = false;
                Directory.CreateDirectory(options.LogDir);
                ServiceDiagnostics.ValidateStartup(options);
                RotateLog(options.StdoutLogPath);
                RotateLog(options.StderrLogPath);

                var startInfo = new ProcessStartInfo
                {
                    FileName = options.NodePath,
                    WorkingDirectory = options.AppDir,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };
                startInfo.ArgumentList.Add(options.ServerJs);

                foreach (var pair in options.Environment)
                {
                    startInfo.Environment[pair.Key] = pair.Value;
                }

                process = new Process
                {
                    StartInfo = startInfo,
                    EnableRaisingEvents = true
                };
                process.Exited += HandleProcessExited;

                if (!process.Start())
                {
                    throw new InvalidOperationException("Unable to start OnlyGANTT Node server process.");
                }

                stdoutTask = CopyStreamToFileAsync(process.StandardOutput, options.StdoutLogPath);
                stderrTask = CopyStreamToFileAsync(process.StandardError, options.StderrLogPath);
            }
        }

        public void Stop()
        {
            Process? target;
            lock (sync)
            {
                stopping = true;
                target = process;
            }

            if (target is null || target.HasExited)
            {
                return;
            }

            try
            {
                target.Kill(entireProcessTree: true);
                target.WaitForExit(15000);
            }
            catch (InvalidOperationException)
            {
            }
        }

        private void HandleProcessExited(object? sender, EventArgs args)
        {
            var exitCode = process?.ExitCode ?? 1;
            Task.WaitAll(new[] { stdoutTask, stderrTask }.Where(task => task is not null).Cast<Task>().ToArray(), 5000);

            lock (sync)
            {
                if (stopping)
                {
                    return;
                }
            }

            Environment.Exit(exitCode == 0 ? 1 : exitCode);
        }

        private static async Task CopyStreamToFileAsync(StreamReader reader, string path)
        {
            await using var stream = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.ReadWrite);
            await using var writer = new StreamWriter(stream) { AutoFlush = true };
            while (await reader.ReadLineAsync() is { } line)
            {
                await writer.WriteLineAsync(line);
            }
        }

        private static void RotateLog(string path)
        {
            var file = new FileInfo(path);
            if (!file.Exists || file.Length <= MaxLogBytes)
            {
                return;
            }

            var rotatedPath = path + ".1";
            if (File.Exists(rotatedPath))
            {
                File.Delete(rotatedPath);
            }

            File.Move(path, rotatedPath);
        }
    }

    private sealed class ServiceOptions
    {
        public string AppDir { get; private init; } = AppContext.BaseDirectory;
        public string NodePath { get; private init; } = "node.exe";
        public string ServerJs { get; private init; } = "";
        public string DataDir { get; private init; } = "";
        public string LogDir { get; private init; } = "";
        public int Port { get; private init; } = DefaultPort;
        public string AdminResetCode { get; private init; } = "";
        public bool ConsoleMode { get; private init; }
        public bool ShowHelp { get; private init; }

        public string StdoutLogPath => Path.Combine(LogDir, "service-stdout.log");
        public string StderrLogPath => Path.Combine(LogDir, "service-stderr.log");

        public ReadOnlyDictionary<string, string> Environment
        {
            get
            {
                var env = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["NODE_ENV"] = "production",
                    ["PORT"] = Port.ToString(),
                    ["ONLYGANTT_DATA_DIR"] = DataDir,
                    ["ONLYGANTT_SERVICE_MANAGER"] = "native"
                };

                if (!string.IsNullOrWhiteSpace(AdminResetCode))
                {
                    env["ONLYGANTT_ADMIN_RESET_CODE"] = AdminResetCode;
                }

                return new ReadOnlyDictionary<string, string>(env);
            }
        }

        public static string HelpText => string.Join(System.Environment.NewLine, new[]
        {
            "OnlyGANTT Windows Service host",
            "Options:",
            "  --app-dir <path>",
            "  --node-path <path>",
            "  --server-js <path>",
            "  --data-dir <path>",
            "  --port <1-65535>",
            "  --log-dir <path>",
            "  --admin-reset-code <value>",
            "  --console"
        });

        public static ServiceOptions Parse(string[] args)
        {
            var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var switches = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            for (var index = 0; index < args.Length; index++)
            {
                var item = args[index];
                if (!item.StartsWith("--", StringComparison.Ordinal))
                {
                    throw new ArgumentException($"Unexpected argument '{item}'.");
                }

                var key = item[2..];
                if (key is "console" or "help")
                {
                    switches.Add(key);
                    continue;
                }

                if (index + 1 >= args.Length)
                {
                    throw new ArgumentException($"Missing value for '{item}'.");
                }

                values[key] = args[++index];
            }

            var appDir = FullPath(values.GetValueOrDefault("app-dir") ?? AppContext.BaseDirectory);
            var dataDir = FullPath(values.GetValueOrDefault("data-dir") ?? Path.Combine(appDir, "Data"));
            var logDir = FullPath(values.GetValueOrDefault("log-dir") ?? Path.Combine(dataDir, "log"));
            var serverJs = FullPath(values.GetValueOrDefault("server-js") ?? Path.Combine(appDir, "src", "server", "server.js"));
            var nodePath = values.GetValueOrDefault("node-path") ?? "node.exe";

            if (values.TryGetValue("port", out var rawPort) && (!int.TryParse(rawPort, out var port) || port < 1 || port > 65535))
            {
                throw new ArgumentException("Port must be a number between 1 and 65535.");
            }

            var resolvedPort = values.TryGetValue("port", out rawPort) ? int.Parse(rawPort) : DefaultPort;

            return new ServiceOptions
            {
                AppDir = appDir,
                NodePath = nodePath,
                ServerJs = serverJs,
                DataDir = dataDir,
                LogDir = logDir,
                Port = resolvedPort,
                AdminResetCode = values.GetValueOrDefault("admin-reset-code") ?? "",
                ConsoleMode = switches.Contains("console"),
                ShowHelp = switches.Contains("help")
            };
        }

        private static string FullPath(string path)
        {
            return Path.GetFullPath(System.Environment.ExpandEnvironmentVariables(path));
        }
    }

    private static class ServiceDiagnostics
    {
        private const string EventSource = "OnlyGanttWeb";

        public static void ValidateStartup(ServiceOptions options)
        {
            if (!File.Exists(options.NodePath))
            {
                throw new FileNotFoundException("Node.js executable was not found.", options.NodePath);
            }

            if (!File.Exists(options.ServerJs))
            {
                throw new FileNotFoundException("OnlyGANTT server entrypoint was not found.", options.ServerJs);
            }

            if (IsPortInUse(options.Port))
            {
                throw new InvalidOperationException($"TCP port {options.Port} is already in use. Choose a different port or stop the process using that port before starting OnlyGANTT.");
            }
        }

        public static void WriteStartupFailure(Exception exception)
        {
            try
            {
                if (!EventLog.SourceExists(EventSource))
                {
                    EventLog.CreateEventSource(EventSource, "Application");
                }

                EventLog.WriteEntry(EventSource, exception.ToString(), EventLogEntryType.Error);
            }
            catch
            {
            }
        }

        private static bool IsPortInUse(int port)
        {
            var listeners = IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners();
            return listeners.Any(listener => listener.Port == port);
        }
    }
}
