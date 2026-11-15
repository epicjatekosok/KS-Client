using CefSharp;
using CefSharp.WinForms;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace KSClient.CefHost;

internal sealed class ClientForm : Form
{
    const string Game="https://kirka.io/";
    const string Stats="https://kirka-stats.lovable.app/";
    const string Clans="https://kirka-clan-tracker-notpro9.lovable.app/";
    static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
       {"kirka.io","www.kirka.io","kirka-stats.lovable.app","kirka-clan-tracker-notpro9.lovable.app"};
    private readonly ChromiumWebBrowser browser;
    private readonly string overlay;
    private readonly string pacer;
    private BrowserPrefs desired=Program.Active;
    private string menuResolution="native";
    private string gameResolution="native";
    private bool borderless=false;
    private Rectangle oldBounds;
    private FormBorderStyle oldBorder;
    private FormWindowState oldWindowState;
    private bool engineSwitching;
    private System.Windows.Forms.Timer? engineSwitchTimer;
    private string? switchNonce;

    internal ClientForm()
    {
        Text="KS Client alpha 1.1.8 – CEF";
        MinimumSize=new Size(800,500);
        Size=new Size(1280,800);
        StartPosition=FormStartPosition.CenterScreen;
        try {Icon=new Icon(Path.Combine(AppContext.BaseDirectory,"assets","ks-logo.ico"));} catch { }
        KeyPreview=true;
        overlay=File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","overlay.js"));
        pacer=File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","frame_pacer.js"));
        browser=new ChromiumWebBrowser(Game) {Dock=DockStyle.Fill};
        browser.MenuHandler = new ClientMenuHandler(() => desired.ContextMenu);
        browser.RequestHandler = new ClientRequestHandler();
        Controls.Add(browser);
        browser.FrameLoadStart += (_,e)=>{
            if(e.Frame.IsMain && Trust(e.Url,gameOnly:true))
            {
                // May run after early page scripts in some CEF builds; re-tested on load end.
                e.Frame.ExecuteJavaScriptAsync(pacer);
            }
        };
        browser.FrameLoadEnd += (_,e)=>{
            if(!e.Frame.IsMain || !Trust(e.Url))return;
            e.Frame.ExecuteJavaScriptAsync(pacer);
            e.Frame.ExecuteJavaScriptAsync(overlay);
            // This post-injection request fixes the lost initial handshake that
            // could leave Active Browser Engine permanently on "Loading...".
            e.Frame.ExecuteJavaScriptAsync("window.__KS_CLIENT__?.setEngineInfo?.('CEF (CefSharp)');");
            e.Frame.ExecuteJavaScriptAsync("window.__KS_CLIENT__?.setBrowserConfig?.("+JS(desired)+","+JS(Program.Active)+","+JS(NeedsRestart())+",'');");
            if(gameResolution!="native" && IsHandleCreated)BeginInvoke((Action)(()=>SetGameResolution(gameResolution)));
            if(IsHandleCreated)BeginInvoke((Action)(()=>Program.SignalSwitchReady()));
        };
        browser.JavascriptMessageReceived += (_,e)=>{
            // Main-frame URL and current browser address must both stay allowlisted.
            if(!e.Frame.IsMain || !Trust(e.Frame.Url) || !Trust(browser.Address)) return;
            string? raw=e.Message?.ToString();
            if(string.IsNullOrEmpty(raw) || raw.Length>8192) return;
            try
            {
                var msg=JsonSerializer.Deserialize<BridgeMsg>(raw,BrowserPrefs.JsonOpts);
                if(msg!=null && IsHandleCreated)BeginInvoke((Action)(()=>Receive(msg, e.Frame.Url)));
            }
            catch(Exception ex){Program.Log("Bad JS message: "+ex.Message);}
        };
        browser.LoadError += (_,e)=>{if(e.Frame.IsMain)Program.Log($"CEF load: {e.ErrorCode} {e.ErrorText}");};
        KeyDown += (_,e)=>{
            if(e.KeyCode==Keys.F11){ToggleFull();e.Handled=true;}
            if(e.KeyCode==Keys.F1){RunJS("window.__KS_CLIENT__?.toggle?.()");e.Handled=true;}
            if(e.KeyCode==Keys.F10){RunJS("window.__KS_CLIENT__?.toggleHud?.()");e.Handled=true;}
        };
        Program.Log("CEF host started; WebView2 is not used");
    }

    internal static bool Trust(string? source,bool gameOnly=false)
    {
        if(!Uri.TryCreate(source,UriKind.Absolute,out var u)||u.Scheme!="https")return false;
        return gameOnly?u.Host is "kirka.io" or "www.kirka.io":Allowed.Contains(u.Host);
    }
    private static string JS(object value)=>JsonSerializer.Serialize(value,BrowserPrefs.JsonOpts);
    private void RunJS(string code)
    {
        if(Trust(browser.Address))browser.ExecuteScriptAsync(code);
    }
    private void Reply(string method,params object[] args)
      => RunJS("window.__KS_CLIENT__?."+method+"?.apply(window.__KS_CLIENT__,"+JS(args)+");");
    private bool NeedsRestart()=>Program.Active.Gpu!=desired.Gpu||Program.Active.Angle!=desired.Angle||Program.Active.UncapFps!=desired.UncapFps;
    private void ReportPrefs(string status="")
    {
        Reply("setBrowserConfig",desired,Program.Active,NeedsRestart(),status);
    }
    private void Go(string url){if(Trust(url))browser.Load(url);}
    private void ToggleFull()
    {
        if(!borderless)
        {
            oldBounds=Bounds;oldBorder=FormBorderStyle;oldWindowState=WindowState;
            WindowState=FormWindowState.Normal;
            FormBorderStyle=FormBorderStyle.None;
            Bounds=Screen.FromControl(this).Bounds;
            borderless=true;
        }
        else
        {
            FormBorderStyle=oldBorder;Bounds=oldBounds;WindowState=oldWindowState;
            borderless=false;
        }
    }
    private static readonly Dictionary<string,Size> Res=new() { ["720"]=new(1280,720),["1080"]=new(1920,1080),["1440"]=new(2560,1440),["2160"]=new(3840,2160) };
    private void SetMenuResolution(string preset)
    {
        if(preset!="native"&&!Res.ContainsKey(preset))return;
        menuResolution=preset;
        if(borderless)return;
        var area=Screen.FromControl(this).WorkingArea;
        if(preset=="native"){Bounds=area;return;}
        Size r=Res[preset];
        var size=new Size(Math.Min(r.Width,area.Width),Math.Min(r.Height,area.Height));
        Bounds=new Rectangle(area.X+(area.Width-size.Width)/2,area.Y+(area.Height-size.Height)/2,size.Width,size.Height);
    }
    private void SetGameResolution(string preset)
    {
        if(preset!="native"&&!Res.ContainsKey(preset))return;
        gameResolution=preset;
        // CefSharp page zoom is NOT identical to WebView2 rasterizationScale.
        // This controls page dimensions but cannot force game canvas resolution.
        double factor=preset=="native"?1.0:Math.Clamp((double)Res[preset].Height/Math.Max(browser.ClientSize.Height,240),.5,2);
        double level=Math.Log(factor)/Math.Log(1.2);
        browser.SetZoomLevel(level);
    }
    private void Restart()
    {
        try
        {
            var exe=Environment.ProcessPath ?? throw new InvalidOperationException("Executable path unavailable");
            Process.Start(new ProcessStartInfo {FileName=exe,UseShellExecute=true});
            Close();
        }
        catch(Exception ex){ReportPrefs("Restart failed: "+ex.Message);}
    }
    // A switch never closes the current window before the new engine reports
    // that its trusted game document and client overlay have loaded.
    private void SwitchToElectron()
    {
        if(engineSwitching)return;
        var root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"..",".."));
        var launcher=Path.Combine(root,"KS-Client.exe");
        var target=Path.Combine(root,"runtime","Electron","electron.exe");
        if(!File.Exists(launcher)||!File.Exists(target)){
            Reply("setEngineSwitchStatus","Electron or KS Client launcher is missing. Repair the installation.");
            return;
        }
        var nonce=Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var ready=Path.Combine(Program.Root,"engine-switch-"+nonce+".ok");
        var failed=Path.Combine(Program.Root,"engine-switch-"+nonce+".error");
        int checks=0;
        engineSwitching=true;
        switchNonce=nonce;
        Reply("setEngineSwitchStatus","Starting Electron; waiting for the new window...");
        try
        {
            var process=Process.Start(new ProcessStartInfo{
                FileName=launcher, Arguments="--engine electron --ks-switch-token="+nonce,
                WorkingDirectory=root, UseShellExecute=false, CreateNoWindow=true
            });
            if(process is null)throw new InvalidOperationException("Could not start KS Client launcher.");
            process.Dispose();
            engineSwitchTimer=new System.Windows.Forms.Timer{Interval=250};
            engineSwitchTimer.Tick+=(_,_)=>{
                if(File.Exists(ready)){
                    StopSwitchTimer();
                    try{File.Delete(ready);}catch{}
                    try{File.Delete(failed);}catch{}
                    Close();
                }
                else if(File.Exists(failed)||++checks>=80){
                    string reason="Electron did not confirm startup within 20 seconds. CEF remains open.";
                    if(File.Exists(failed)){
                        try{reason=File.ReadAllText(failed);}catch{}
                    }
                    StopSwitchTimer();
                    try{File.WriteAllText(Path.Combine(Program.Root,"selected-engine.txt"),"cef\n");}catch{}
                    try{File.Delete(ready);}catch{}
                    try{File.Delete(failed);}catch{}
                    Reply("setEngineSwitchStatus",reason);
                    Program.Log("CEF->Electron switch failed: "+reason);
                }
            };
            engineSwitchTimer.Start();
        }
        catch(Exception ex){
            StopSwitchTimer();
            Reply("setEngineSwitchStatus","Could not start Electron: "+ex.Message);
            Program.Log("CEF->Electron switch error: "+ex);
        }
    }
    private void StopSwitchTimer()
    {
        engineSwitchTimer?.Stop();
        engineSwitchTimer?.Dispose();
        engineSwitchTimer=null;
        engineSwitching=false;
        switchNonce=null;
    }
    private void Receive(BridgeMsg m,string source)
    {
        if(!Trust(source)||!Trust(browser.Address))return;
        string type=m.Type ?? "";
        if(!Trust(source,true) && type is not("stats" or "clan" or "game" or "fullscreen" or "crash-status" or "diagnostics-poll"))return;
        switch(type)
        {
            case "game": Go(Game);break;
            case "stats": Go(Stats);break;
            case "clan": Go(Clans);break;
            case "fullscreen":ToggleFull();break;
            case "game-resolution":SetGameResolution(m.Preset??"native");break;
            case "menu-resolution":SetMenuResolution(m.Preset??"native");break;
            case "engine-info":Reply("setEngineInfo","CEF (CefSharp)");break;
            case "engine-switch":
                if(m.Engine=="electron")SwitchToElectron();
                break;
            case "browser-config":ReportPrefs();break;
            case "browser-save":
                if(m.Browser is null)return;
                desired=BrowserPrefs.Normalize(m.Browser);
                try { desired.Save(); ReportPrefs(NeedsRestart()?"Saved; restart to apply startup flags.":"Browser preferences saved."); }
                catch(Exception ex){ReportPrefs("Save failed: "+ex.Message);}
                break;
            case "browser-reset":
                desired=m.Section switch {
                    "graphics" => desired with {Gpu="enabled",Angle="default",UncapFps=false},
                    "controls" => desired with {DevTools=false,ContextMenu=false},
                    "all" => BrowserPrefs.Default(),
                    _=>desired
                };
                desired.Save();ReportPrefs("Default preferences saved.");break;
            case "browser-restart":Restart();break;
            case "crash-status":Reply("setCrashStatus","CEF log: "+Program.LogPath);break;
            case "diagnostics-poll":
                Reply("setDiagnostics",new {browserRAM=(int)(Process.GetCurrentProcess().WorkingSet64/1048576),engine="CEF",note="Host process RAM only"});break;
            case "open-logs":Process.Start(new ProcessStartInfo {FileName="explorer.exe",Arguments="\""+Program.Root+"\"",UseShellExecute=true});break;
            case "client-error":Program.Log("Overlay warning: "+(m.Message??"")[..Math.Min((m.Message??"").Length,240)]);break;
        }
    }
    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if(keyData==Keys.F12 && desired.DevTools) {browser.ShowDevTools();return true;}
        if(keyData==Keys.F11) {ToggleFull();return true;}
        if(keyData==Keys.F1){RunJS("window.__KS_CLIENT__?.toggle?.()");return true;}
        if(keyData==Keys.F10){RunJS("window.__KS_CLIENT__?.toggleHud?.()");return true;}
        if(keyData==(Keys.Control|Keys.R)){browser.Reload();return true;}
        return base.ProcessCmdKey(ref msg,keyData);
    }
    protected override void Dispose(bool disposing)
    {
        if(disposing){StopSwitchTimer();browser?.Dispose();}
        base.Dispose(disposing);
    }
}
internal sealed class BridgeMsg
{
    public string? Type {get;set;}
    public string? Preset {get;set;}
    public string? Section {get;set;}
    public string? Message {get;set;}
    public string? Engine {get;set;}
    public BrowserPrefs? Browser {get;set;}
}

// Disable native context menus when requested; don't block Kirka mouse input.
internal sealed class ClientMenuHandler : CefSharp.Handler.ContextMenuHandler
{
    private readonly Func<bool> enabled;
    internal ClientMenuHandler(Func<bool> enabled) { this.enabled=enabled; }
    protected override void OnBeforeContextMenu(IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame,IContextMenuParams parameters,IMenuModel model)
    {
        if(!enabled()) model.Clear();
    }
}
// Navigate the main frame only to the game and its approved stats websites.
internal sealed class ClientRequestHandler : CefSharp.Handler.RequestHandler
{
    protected override bool OnBeforeBrowse(IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame,IRequest request,bool userGesture,bool isRedirect)
      => frame.IsMain && !ClientForm.Trust(request.Url);
}
