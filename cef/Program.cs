using CefSharp;
using System.Text.Json;

namespace KSClient.CefHost;

internal static class Program
{
    internal static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "KSClient");
    internal static readonly string PrefsPath = Path.Combine(Root,"browser-settings.json");
    internal static readonly string LogPath = Path.Combine(Root,"cef-1.1.6.log");
    internal static BrowserPrefs Active = BrowserPrefs.Default();

    [STAThread]
    static void Main(string[] args)
    {
        Directory.CreateDirectory(Root);
        bool safe = args.Contains("--ks-browser-safe-mode");
        Active = safe ? BrowserPrefs.Default() : BrowserPrefs.Load();
        if (safe) Active.Save();
        ApplicationConfiguration.Initialize();
        var settings = new global::CefSharp.WinForms.CefSettings
        {
            CachePath = Path.Combine(Root, "CefProfile"),
            PersistSessionCookies = true,
            Locale = "en-US"
        };
        if (Active.Gpu == "disabled") settings.CefCommandLineArgs.Add("disable-gpu", "1");
        if (Active.Angle == "d3d11") settings.CefCommandLineArgs.Add("use-angle", "d3d11");
        if (Active.Angle == "opengl") settings.CefCommandLineArgs.Add("use-angle", "gl");
        if (Active.UncapFps)
        {
            // EXPERIMENTAL: attempts to unlock Chromium scheduling. Not guaranteed.
            settings.CefCommandLineArgs.Add("disable-frame-rate-limit", "1");
            settings.CefCommandLineArgs.Add("disable-gpu-vsync", "1");
        }
        // Called by the installer after publishing; checks that the native CEF
        // runtime can initialize on THIS Windows machine, without opening Kirka.
        bool selfTest = args.Contains("--ks-self-test");
        try
        {
            if (!global::CefSharp.Cef.Initialize(settings)) throw new InvalidOperationException("CEF initialization returned false.");
            if (selfTest)
            {
                Log("CEF runtime initialization self-test: PASS");
                return;
            }
            Application.Run(new ClientForm());
        }
        catch (Exception e)
        {
            Log("CEF startup failure: " + e);
            if (selfTest) Environment.ExitCode = 1;
            else MessageBox.Show(e.Message,"KS Client alpha 1.1.6 - CEF", MessageBoxButtons.OK,MessageBoxIcon.Error);
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
