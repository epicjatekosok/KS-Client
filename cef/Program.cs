using CefSharp;
using System.Text.Json;

namespace KSClient.CefHost;

internal static class Program
{
    internal static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "KSClient");
    internal static readonly string PrefsPath = Path.Combine(Root,"browser-settings.json");
    internal static readonly string LogPath = Path.Combine(Root,"cef-1.0.19.log");
    internal static BrowserPrefs Active = BrowserPrefs.Default();
    internal static readonly string FixedMarker=Path.Combine(Root,"cef-fixed-frame-target");
    internal static bool FixedTarget;
    internal static BrowserPrefs Requested=BrowserPrefs.Default();
    internal static string? SwitchToken;
    internal static bool SwitchProbe;
    private static System.Windows.Forms.Timer? probeTimer;
    internal static void SignalSwitchReady()
    {
        string? token = SwitchToken;
        if (token is null || token.Length != 32 || token.Any(c => !Uri.IsHexDigit(c))) return;
        SwitchToken = null;
        try
        {
            // Native WinForms window exists; Kirka network/overlay availability
            // is intentionally NOT part of the engine switch handshake.
            File.WriteAllText(Path.Combine(Root, "engine-switch-" + token + ".ready"), "cef");
            Log("Native CEF window ready; launcher confirmation pending");
            if (SwitchProbe)
            {
                int checks = 0;
                probeTimer = new System.Windows.Forms.Timer { Interval = 250 };
                probeTimer.Tick += (_, _) =>
                {
                    if (File.Exists(Path.Combine(Root, "engine-switch-" + token + ".ok")))
                    {
                        probeTimer.Stop();
                        Application.Exit();
                    }
                    else if (++checks > 240)
                    {
                        probeTimer.Stop();
                        Environment.ExitCode = 3;
                        Application.Exit();
                    }
                };
                probeTimer.Start();
            }
        }
        catch (Exception ex) { Log("Could not signal CEF readiness: " + ex.Message); }
    }

    [STAThread]
    static void Main(string[] args)
    {
        Directory.CreateDirectory(Root);
        var switchArg=args.FirstOrDefault(a=>a.StartsWith("--ks-switch-token=",StringComparison.Ordinal));
        SwitchToken=switchArg is null?null:switchArg.Substring("--ks-switch-token=".Length);
        SwitchProbe = args.Contains("--ks-switch-probe") && SwitchToken is not null;
        bool bridgeProbe = args.Contains("--ks-bridge-probe");
        bool selfTest = args.Contains("--ks-self-test");
        bool safe = args.Contains("--ks-browser-safe-mode");
        // Chrome-style CEF uses Chromium's normal browser UI/input stack.
        // --ks-cef-alloy is a diagnostic fallback for older CEF behavior.
        bool alloyFallback = args.Contains("--ks-cef-alloy");
        CefSharpSettings.RuntimeStyle = alloyFallback ? CefRuntimeStyle.Alloy : CefRuntimeStyle.Chrome;
        Log("CEF runtime style: "+(alloyFallback?"Alloy fallback":"Chrome")+
            "; native Chromium pointer lock and cursor handling enabled");
        Requested = (safe || selfTest) ? BrowserPrefs.Default() : BrowserPrefs.Load();
        FixedTarget = File.Exists(FixedMarker);
        Active = Requested with {UncapFps=Requested.UncapFps && !FixedTarget};
        if (safe && !selfTest) Requested.Save();
        ApplicationConfiguration.Initialize();
        var settings = new global::CefSharp.WinForms.CefSettings
        {
            CachePath = Path.Combine(Root, selfTest ? "CefSmokeProfile" : "CefProfile"),
            PersistSessionCookies = !selfTest,
            Locale = "en-US",
            LogFile = Path.Combine(Root, "cef-native-debug.log"),
            LogSeverity = selfTest || args.Contains("--ks-cef-verbose") ? global::CefSharp.LogSeverity.Verbose : global::CefSharp.LogSeverity.Warning
        };
        var subprocess = Path.Combine(AppContext.BaseDirectory, "CefSharp.BrowserSubprocess.exe");
        if (File.Exists(subprocess)) settings.BrowserSubprocessPath = subprocess;
        if (selfTest)
        {
            settings.CefCommandLineArgs.Add("disable-gpu", "1");
            settings.CefCommandLineArgs.Add("disable-gpu-compositing", "1");
        }
        if (Active.Gpu == "disabled") settings.CefCommandLineArgs.Add("disable-gpu", "1");
        if (Active.Angle == "d3d11") settings.CefCommandLineArgs.Add("use-angle", "d3d11");
        if (Active.Angle == "opengl") settings.CefCommandLineArgs.Add("use-angle", "gl");
        if (Active.UncapFps)
        {
            // EXPERIMENTAL: attempts to unlock Chromium scheduling. Not guaranteed.
            settings.CefCommandLineArgs.Add("disable-frame-rate-limit", "1");
            settings.CefCommandLineArgs.Add("disable-gpu-vsync", "1");
        }
        Log("FPS startup flags: requested="+Active.UncapFps+"; native Chromium switches appended="+Active.UncapFps);
        // Called by the installer after publishing; checks that the native CEF
        // runtime can initialize on THIS Windows machine, without opening Kirka.
        try
        {
            if (!global::CefSharp.Cef.Initialize(settings)) throw new InvalidOperationException("CEF initialization returned false.");
            if (selfTest)
            {
                // Initialize Chromium's native subprocesses fully before shutdown.
                // Immediate Cef.Initialize -> Cef.Shutdown can race on Windows CI
                // and occasionally end in a 0xC0000005 native access violation.
                // This keeps the real native initialization AND shutdown gates.
                using var smokeContext=new ApplicationContext();
                using var smokeTimer=new System.Windows.Forms.Timer {Interval=1200};
                smokeTimer.Tick+=(_,_)=>{smokeTimer.Stop();smokeContext.ExitThread();};
                smokeTimer.Start();
                Application.Run(smokeContext);
                Log("CEF runtime initialization with message pump self-test: PASS");
                return;
            }
            Application.Run(new ClientForm(SwitchProbe,bridgeProbe));
        }
        catch (Exception e)
        {
            Log("CEF startup failure: " + e);
            if (selfTest) Environment.ExitCode = 1;
            else MessageBox.Show(e.Message,"KS Client Beta 1.0.19 - CEF", MessageBoxButtons.OK,MessageBoxIcon.Error);
        }
        finally { if (global::CefSharp.Cef.IsInitialized == true) global::CefSharp.Cef.Shutdown(); }
    }

    internal static void Log(string text)
    {
        try { File.AppendAllText(LogPath,DateTime.UtcNow.ToString("O")+" "+text[..Math.Min(text.Length,1200)]+Environment.NewLine); } catch { }
    }
}

internal sealed record BrowserPrefs(string Gpu, string Angle, bool DevTools, bool ContextMenu, bool UncapFps)
{
    public static BrowserPrefs Default() => new("enabled", "default", false, false, false);
    public static BrowserPrefs Normalize(BrowserPrefs p) => p with
    {
        Gpu = p.Gpu == "disabled" ? "disabled" : "enabled",
        Angle = p.Angle is "d3d11" or "opengl" ? p.Angle : "default"
    };
    public static BrowserPrefs Load()
    {
        try
        {
            return Normalize(JsonSerializer.Deserialize<BrowserPrefs>(File.ReadAllText(Program.PrefsPath),JsonOpts)! ?? Default());
        }
        catch { return Default(); }
    }
    public void Save()
    {
        Directory.CreateDirectory(Program.Root);
        var tmp=Program.PrefsPath+".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(Normalize(this),JsonOpts));
        File.Move(tmp,Program.PrefsPath,true);
    }
    internal static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web) {WriteIndented=true,PropertyNamingPolicy=JsonNamingPolicy.CamelCase};
}
