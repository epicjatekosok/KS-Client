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
    private KSLoadingPanel? loadingPanel;
    private int pointerLockedFlag;
    private System.Windows.Forms.Timer? loadingTimeout;
    private readonly string overlay;
    private readonly string pacer;
    private readonly string extras;
    private readonly string cefInputProbe;
    private readonly string workshop;
    private readonly string integrationBoot;
    private readonly string integrationCore;
    private readonly string gameRuntime;
    private readonly string drawTelemetry;
    private readonly string graphics;
    private readonly string advanced;
    private readonly string freezeGuard;
    private readonly string earlyGameJS;
    private readonly string nativeLoginGate;

    // Preserve the complete KS feature set after Kirka signs in, but never
    // hook the game's original login buttons, password fields or Google picker.
    // The game's own localStorage token is checked ONLY as a boolean inside
    // its Chromium renderer. No credential is sent to the CEF host.
    private static string AfterKirkaLogin(string script)
    {
        const string condition =
            "(location.hostname==='kirka.io'||location.hostname==='www.kirka.io')";
        return "(function(){try{if("+condition+
            "&&!localStorage.getItem('token'))return;}catch(_){return;}\n"+
            script+"\n})();";
    }
    private BrowserPrefs desired=Program.Active;
    private string menuResolution="native";
    private string gameResolution="native";
    private bool borderless=false;
    private Rectangle oldBounds;
    private FormBorderStyle oldBorder;
    private FormWindowState oldWindowState;
    // The same non-secret updater preferences are used by Electron, CEF and the game Settings.
    private sealed record NativeUpdatePreferences(bool Automatic,bool AutoDownload,string Channel);
    private static readonly string UpdaterPreferencesPath=Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"KSClient","updater-preferences.json");
    private NativeUpdatePreferences nativeUpdaterPrefs=ReadUpdaterPreferences();
    private object? lastNativeUpdateStatus;
    private static NativeUpdatePreferences ReadUpdaterPreferences()
    {
        try {
            using var doc=JsonDocument.Parse(File.ReadAllText(UpdaterPreferencesPath));
            var value=doc.RootElement;
            bool enabled(string key)=>value.TryGetProperty(key,out var v)&&v.ValueKind==JsonValueKind.False?false:true;
            string channel=value.TryGetProperty("channel",out var c)?c.GetString()??"beta":"beta";
            if(channel is not("alpha" or "beta" or "stable"))channel="beta";
            return new NativeUpdatePreferences(enabled("automatic"),enabled("autoDownload"),channel);
        }catch{return new NativeUpdatePreferences(true,true,"beta");}
    }
    private void SaveUpdaterPreferences(BridgeMsg msg)
    {
        string channel=msg.Channel is "alpha" or "beta" or "stable"?msg.Channel:"beta";
        nativeUpdaterPrefs=new NativeUpdatePreferences(msg.Automatic==true,msg.AutoDownload==true,channel);
        try {
            Directory.CreateDirectory(Path.GetDirectoryName(UpdaterPreferencesPath)!);
            File.WriteAllText(UpdaterPreferencesPath,JsonSerializer.Serialize(new {
                automatic=nativeUpdaterPrefs.Automatic,autoDownload=nativeUpdaterPrefs.AutoDownload,channel=nativeUpdaterPrefs.Channel
            }));
        }catch(Exception ex){Program.Log("Update preferences not saved: "+ex.GetType().Name);}
    }
    private void ReportNativeUpdateStatus(object status,string? splashText=null)
    {
        lastNativeUpdateStatus=status;
        if(splashText is not null && loadingPanel is not null && !loadingPanel.IsDisposed)
            loadingPanel.Status(splashText);
        Reply("setUpdateStatus",status);
    }
    private DateTime lastAutoUpdateCheck=DateTime.MinValue;
    private bool updateCheckInProgress;
    private bool engineSwitching;
    private System.Windows.Forms.Timer? engineSwitchTimer;
    private string? switchNonce;
    private readonly bool bridgeProbe;
    private System.Windows.Forms.Timer? bridgeProbeTimeout;
    // CEF provider callbacks can originate from Chromium threads. Only UI work
    // is dispatched to WinForms; no login URL, token or cookie crosses IPC.
    private void ShowAccountHelp()
    {
        if(!IsDisposed && IsHandleCreated)
            BeginInvoke((Action)(()=>Reply("openAccountHelp")));
    }

    internal ClientForm(bool switchProbe = false, bool bridgeProbe = false)
    {
        this.bridgeProbe=bridgeProbe;
        Text="KS Client Beta 1.0.12 – CEF";
        MinimumSize=new Size(800,500);
        Size=new Size(1280,800);
        StartPosition=FormStartPosition.CenterScreen;
        try {Icon=new Icon(Path.Combine(AppContext.BaseDirectory,"assets","ks-logo.ico"));} catch { }
        KeyPreview=true;
        nativeLoginGate=File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","native_login_gate.js"));
        overlay=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","overlay.js")));
        pacer=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","frame_pacer.js")));
        extras=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","game_extras.js")));
        cefInputProbe=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","cef_input_probe.js")));
        workshop=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","workshop.js")));
        integrationBoot=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","integration_bootstrap.js")));
        integrationCore=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","integration_core.js")));
        gameRuntime=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","game_runtime.js")));
        drawTelemetry=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","render_telemetry.js")));
        graphics=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","webgl_cosmetics.js")));
        advanced=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","advanced_integration.js")));
        freezeGuard=AfterKirkaLogin(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"overlay","freeze_guard.js")));
        // One sequential script evaluation eliminates cross-task injection races.
        earlyGameJS=string.Join("\n;\n",cefInputProbe,pacer,integrationBoot,drawTelemetry,graphics,freezeGuard,gameRuntime);
        // A real CEF renderer->host PostMessage test. This is an offline page,
        // never an injected live Kirka script or external test dependency.
        var bridgeHtml="<html><body><script>setTimeout(function(){if(window.CefSharp && window.CefSharp.PostMessage){window.CefSharp.PostMessage(JSON.stringify({type:'ks-bridge-probe'}));}},350);</script>KS bridge probe</body></html>";
        var initial=bridgeProbe ? "data:text/html;charset=utf-8;base64,"+Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(bridgeHtml))
            : switchProbe ? "about:blank" : Game;
        // CefSharp defaults to WS_EX_NOACTIVATE, unlike Electron's normal BrowserWindow.
        // Activation must be enabled BEFORE the native child window is created.
        browser=new ChromiumWebBrowser(initial) {Dock=DockStyle.Fill,ActivateBrowserOnCreation=true};
        browser.MenuHandler = new ClientMenuHandler(() => desired.ContextMenu);
        browser.PermissionHandler = new ClientGamePermissionHandler();
        // Do not intercept OnCursorChange: Chromium must own the real cursor,
        // capture/release and relative mouse deltas. The earlier native handler
        // could hide an arrow without providing an actual pointer lock.
        browser.RenderProcessMessageHandler = new KSEarlyIntegrationHandler(earlyGameJS);
        // No custom LifeSpanHandler: let CEF create normal browser popups.
        // Its native popup/navigation lifecycle is no longer filtered by
        // an extra KS-specific OAuth domain list or window.opener handler.
        if (!switchProbe && !bridgeProbe)
            browser.RequestHandler = new ClientRequestHandler(() => {
                try {
                    if(IsHandleCreated && !IsDisposed && !Disposing)
                        BeginInvoke((Action)(() => {if(!IsDisposed)SwitchToElectron();}));
                } catch(InvalidOperationException) {Program.Log("CEF switch ignored during shutdown");}
            });
        Controls.Add(browser);
        if(!switchProbe && !bridgeProbe) {
            loadingPanel=new KSLoadingPanel(Path.Combine(AppContext.BaseDirectory,"assets","ks-logo.png"));
            Controls.Add(loadingPanel);
            loadingPanel.BringToFront();
            loadingTimeout=new System.Windows.Forms.Timer {Interval=18000};
            loadingTimeout.Tick+=(_,_)=>{
                loadingTimeout?.Stop();
                Program.Log("Startup splash timeout; enabling game interaction");
                CloseLoadingPanel();
            };
            loadingTimeout.Start();
        }
        // Keep native keyboard/mouse focus on the embedded Chromium control.
        // Pointer lock still requires the game's real user gesture and CEF approval.
        Activated += (_, _) => { if(!bridgeProbe) FocusGameBrowser(); };
        Deactivate += (_, _) => SetPointerLockState(false);
        FormClosed += (_, _) => { SetPointerLockState(false);CloseLoadingPanel(); };
        // No forced focus in MouseDown: it can interrupt the trusted click that
        // Kirka itself uses to request pointer lock.
        browser.FrameLoadStart += (_,e)=>{
            try {
                // A Kirka SPA route may detach/dispose its frame mid-callback.
                if(e.Frame.IsValid && e.Frame.IsMain && Trust(e.Url,gameOnly:true))
                    e.Frame.ExecuteJavaScriptAsync(earlyGameJS);
            } catch(ObjectDisposedException) { Program.Log("CEF frame start skipped: frame disposed by navigation"); }
              catch(Exception ex) { Program.Log("CEF frame start: "+ex.Message); }
        };
        browser.FrameLoadEnd += (_,e)=>{
            try {
            if(!e.Frame.IsValid || !e.Frame.IsMain || !Trust(e.Url))return;
            // Passive polling reloads once after Kirka itself authenticates.
            // Its own login form and Google UI see no KS input interception.
            e.Frame.ExecuteJavaScriptAsync(nativeLoginGate);
            e.Frame.ExecuteJavaScriptAsync(cefInputProbe);
            e.Frame.ExecuteJavaScriptAsync(pacer);
            e.Frame.ExecuteJavaScriptAsync(drawTelemetry);
            e.Frame.ExecuteJavaScriptAsync(gameRuntime);
            e.Frame.ExecuteJavaScriptAsync(overlay);
            e.Frame.ExecuteJavaScriptAsync(extras);
            e.Frame.ExecuteJavaScriptAsync(workshop);
            e.Frame.ExecuteJavaScriptAsync(integrationBoot);
            e.Frame.ExecuteJavaScriptAsync(integrationCore);
            e.Frame.ExecuteJavaScriptAsync(graphics);
            e.Frame.ExecuteJavaScriptAsync(advanced);
            e.Frame.ExecuteJavaScriptAsync(freezeGuard);
            // This post-injection request fixes the lost initial handshake that
            // could leave Active Browser Engine permanently on "Loading...".
            e.Frame.ExecuteJavaScriptAsync("window.__KS_CLIENT__?.setEngineInfo?.('CEF (CefSharp)');");
            e.Frame.ExecuteJavaScriptAsync("window.__KS_CLIENT__?.setBrowserConfig?.("+JS(desired)+","+JS(Program.Active)+","+JS(NeedsRestart())+",'');");
            if(lastNativeUpdateStatus is not null)
                e.Frame.ExecuteJavaScriptAsync("window.__KS_CLIENT__?.setUpdateStatus?.("+JS(lastNativeUpdateStatus)+");");
            if(gameResolution!="native" && IsHandleCreated)BeginInvoke((Action)(()=>SetGameResolution(gameResolution)));
            if(IsHandleCreated)BeginInvoke((Action)(() => CloseLoadingPanel()));
            // Readiness is signalled by WinForms Shown, not FrameLoadEnd.
            } catch(ObjectDisposedException){Program.Log("CEF frame end skipped: frame disposed during Kirka navigation");}
              catch(Exception ex){Program.Log("CEF frame end: "+ex.Message);}
        };
        browser.JavascriptMessageReceived += (_,e)=>{
            try {
            // Diagnostic test verifies the real Chromium->CefSharp bridge. A
            // successfully launched native window alone is insufficient.
            if(bridgeProbe) {
                var rawProbe=e.Message?.ToString() ?? "";
                Program.Log("CEF bridge probe received: "+rawProbe[..Math.Min(128,rawProbe.Length)]);
                if(rawProbe.Contains("ks-bridge-probe",StringComparison.Ordinal)) {
                    if(IsHandleCreated)BeginInvoke((Action)(() => {
                        bridgeProbeTimeout?.Stop();
                        Program.Log("CEF JavascriptMessageReceived bridge probe PASS");
                        Close();
                    }));
                }
                return;
            }
            // Main-frame URL and current browser address must both stay allowlisted.
            // IMPORTANT: snapshot the source now, while the IFrame is alive.
            // Never capture e.Frame inside a queued WinForms BeginInvoke callback.
            if(!e.Frame.IsValid || !e.Frame.IsMain)return;
            var sourceUrl=e.Frame.Url;
            if(!Trust(sourceUrl) || !Trust(browser.Address)) {
                Program.Log("CEF bridge request rejected (origin, frame or address)");
                return;
            }
            string? raw=e.Message?.ToString();
            if(string.IsNullOrEmpty(raw) || raw.Length>8192) return;
            try
            {
                var msg=JsonSerializer.Deserialize<BridgeMsg>(raw,BrowserPrefs.JsonOpts);
                if(msg!=null && IsHandleCreated) {
                    if(msg.Type is "engine-switch" or "engine-info" or "browser-config") Program.Log("CEF bridge received: "+msg.Type);
                    BeginInvoke((Action)(()=>{if(!IsDisposed)Receive(msg, sourceUrl);}));
                }
            }
            catch(Exception ex){Program.Log("Bad JS message: "+ex.Message);}
            } catch(ObjectDisposedException){Program.Log("CEF bridge message ignored: IFrame disposed");}
              catch(InvalidOperationException ex){Program.Log("CEF bridge UI closing: "+ex.Message);}
        };
        browser.LoadError += (_,e)=>{
            try {
                if(e.Frame.IsValid && e.Frame.IsMain){
                    Program.Log($"CEF load: {e.ErrorCode} {e.ErrorText}");
                    if(IsHandleCreated && !IsDisposed)BeginInvoke((Action)(() => {if(!IsDisposed)CloseLoadingPanel();}));
                }
            }catch(ObjectDisposedException){Program.Log("CEF load error frame disposed");}
        };
        KeyDown += (_,e)=>{
            if(e.KeyCode==Keys.F11){ToggleFull();e.Handled=true;}
            if(e.KeyCode==Keys.F1){RunJS("window.__KS_CLIENT__?.toggle?.()");e.Handled=true;}
            if(e.KeyCode==Keys.F10){RunJS("window.__KS_CLIENT__?.toggleHud?.()");e.Handled=true;}
        };
        // Never require Kirka.io to load before reporting native window readiness.
        Shown += (_, _) => {
            if(bridgeProbe) {
                bridgeProbeTimeout=new System.Windows.Forms.Timer {Interval=15000};
                bridgeProbeTimeout.Tick+=(_,_)=>{
                    bridgeProbeTimeout.Stop();
                    Program.Log("CEF JavascriptMessageReceived bridge probe timed out");
                    Environment.ExitCode=17;
                    Close();
                };
                bridgeProbeTimeout.Start();
                return;
            }
            BeginInvoke((Action)(() => Program.SignalSwitchReady()));
            // Startup check is independent of Kirka.io page loading; never stall gameplay.
            if(!switchProbe && nativeUpdaterPrefs.Automatic)
                CheckKSUpdate(nativeUpdaterPrefs.Channel,true,nativeUpdaterPrefs.AutoDownload);
        };
        Program.Log("CEF native window created; gameplay loading is independent");
    }

    private void FocusGameBrowser()
    {
        if(!Trust(browser.Address,gameOnly:true) || !browser.IsBrowserInitialized || !IsHandleCreated || !Visible) return;
        try {
            browser.Focus();
            // Let CefSharp apply the Windows child-window activation rules.
            // Never call Win32 SetFocus across CEF/UI threads or force cursor state.
            browser.GetBrowser().GetHost().SetFocus(true);
        } catch(Exception ex) { Program.Log("CEF game native focus: "+ex.Message); }
    }

    private void SetPointerLockState(bool locked)
    {
        if(locked && (!Trust(browser.Address,gameOnly:true) || Form.ActiveForm != this)) return;
        // Diagnostic mirror ONLY. Actual lock and cursor lifecycle belongs
        // to Chromium and the real JS document.pointerLockElement.
        bool previous=Interlocked.Exchange(ref pointerLockedFlag,locked?1:0)==1;
        if(previous!=locked)Program.Log("CEF JS pointer lock state: "+(locked?"locked":"released"));
    }

    private void CloseLoadingPanel()
    {
        loadingTimeout?.Stop();
        loadingTimeout?.Dispose();
        loadingTimeout=null;
        var panel=loadingPanel;
        loadingPanel=null;
        if(panel!=null){
            Controls.Remove(panel);
            panel.Dispose();
            if(Trust(browser.Address,gameOnly:true))FocusGameBrowser();
        }
    }

    internal static bool Trust(string? source,bool gameOnly=false)
    {
        if(!Uri.TryCreate(source,UriKind.Absolute,out var u)||u.Scheme!="https")return false;
        return gameOnly?u.Host is "kirka.io" or "www.kirka.io":Allowed.Contains(u.Host);
    }
    private static string JS(object value)=>JsonSerializer.Serialize(value,BrowserPrefs.JsonOpts);
    // A Kirka single-page route, login callback, reload, or CEF popup may
    // destroy the underlying IBrowser between a trusted JS event and a native
    // WinForms reply. CefSharp.ExecuteScriptAsync throws when IBrowser is null.
    // Guard every native->renderer reply here, not only FrameLoadEnd.
    private void RunJS(string code)
    {
        if(IsDisposed || Disposing || !browser.IsBrowserInitialized || browser.IsDisposed)
            return;
        try
        {
            if(!Trust(browser.Address))return;
            var native=browser.GetBrowser();
            if(native is null || native.IsDisposed)return;
            var frame=native.MainFrame;
            if(frame is null || !frame.IsValid)return;
            frame.ExecuteJavaScriptAsync(code);
        }
        catch(ObjectDisposedException)
        {
            Program.Log("CEF JavaScript reply skipped: browser/frame disposed");
        }
        catch(InvalidOperationException ex)
        {
            Program.Log("CEF JavaScript reply skipped: "+ex.Message);
        }
        catch(Exception ex)
        {
            Program.Log("CEF JavaScript reply failed safely: "+ex.GetType().Name);
        }
    }
    private void Reply(string method,params object[] args)
      => RunJS("window.__KS_CLIENT__?."+method+"?.apply(window.__KS_CLIENT__,"+JS(args)+");");
    private bool NeedsRestart()=>Program.Active.Gpu!=desired.Gpu||Program.Active.Angle!=desired.Angle||Program.Active.UncapFps!=desired.UncapFps;
    private string UpdateLauncher() => Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"..","..","KS-Client.exe"));
    private async void CheckKSUpdate(string channel,bool automatic,bool prefetch)
    {
        if(updateCheckInProgress){ReportNativeUpdateStatus(new {state="checking",message="A GitHub release check is already in progress…"});return;}
        if(automatic && DateTime.UtcNow-lastAutoUpdateCheck<TimeSpan.FromHours(24))return;
        if(automatic)lastAutoUpdateCheck=DateTime.UtcNow;
        updateCheckInProgress=true;
        ReportNativeUpdateStatus(new {state="checking",message="Checking GitHub for updates…"},"CHECKING UPDATES…");
        try
        {
            var exe=UpdateLauncher();
            using var process=Process.Start(new ProcessStartInfo {
                FileName=exe,UseShellExecute=false,CreateNoWindow=true,
                RedirectStandardOutput=true,WorkingDirectory=Path.GetDirectoryName(exe)!
                ,ArgumentList={"--ks-update-check","--channel="+channel}
            }) ?? throw new InvalidOperationException("Updater could not start.");
            using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(48));
            string raw=await process.StandardOutput.ReadToEndAsync(timeout.Token);
            await process.WaitForExitAsync(timeout.Token);
            if(raw.Length>65536 || process.ExitCode!=0)throw new InvalidOperationException("Update response failed.");
            using var document=JsonDocument.Parse(raw);
            var result=document.RootElement.Clone();
            if(IsHandleCreated)BeginInvoke((Action)(() => {
                var available=result.TryGetProperty("state",out var state)&&state.GetString()=="available";
                ReportNativeUpdateStatus(result,available?"UPDATE AVAILABLE":"LOADING KS CLIENT");
                if(automatic && prefetch && nativeUpdaterPrefs.Automatic && nativeUpdaterPrefs.AutoDownload && available)
                    LaunchUpdateHelper("prefetch",channel);
            }));
        }
        catch(Exception ex)
        {
            if(IsHandleCreated)BeginInvoke((Action)(() => ReportNativeUpdateStatus(new {state="unavailable",message=ex.Message},"LOADING KS CLIENT")));
        }
        finally{updateCheckInProgress=false;}
    }
    private async void LaunchUpdateHelper(string mode,string channel)
    {
        if(mode=="install"){
            var choice=MessageBox.Show(this,
                "Download and install the verified KS Client update? The game will close; saved data will remain.",
                "KS Client Update",MessageBoxButtons.YesNo,MessageBoxIcon.Question);
            if(choice!=DialogResult.Yes)return;
        }
        try {
            var exe=UpdateLauncher();
            using var process=Process.Start(new ProcessStartInfo {
                FileName=exe,UseShellExecute=false,CreateNoWindow=true,
                RedirectStandardOutput=true,WorkingDirectory=Path.GetDirectoryName(exe)!,
                ArgumentList={"--ks-update-"+mode,"--channel="+channel}
            }) ?? throw new InvalidOperationException("Updater could not start.");
            using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(28));
            var raw=await process.StandardOutput.ReadToEndAsync(timeout.Token);
            await process.WaitForExitAsync(timeout.Token);
            using var doc=JsonDocument.Parse(raw);
            var ok=doc.RootElement.TryGetProperty("state",out var status)&&status.GetString()=="started";
            if(!ok)throw new InvalidOperationException(doc.RootElement.TryGetProperty("message",out var detail)?detail.GetString():"Updater could not start.");
            if(mode=="install" && IsHandleCreated) BeginInvoke((Action)(() => Close()));
        } catch(Exception ex) {
            if(IsHandleCreated)BeginInvoke((Action)(() => Reply("setUpdateStatus",new {state="error",message=ex.Message})));
        }
    }
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
                else if(File.Exists(failed)||++checks>=200){
                    string reason="Electron did not confirm native startup within 50 seconds. CEF remains open.";
                    if(File.Exists(failed)){
                        try{reason=File.ReadAllText(failed);}catch{}
                    }
                    StopSwitchTimer();
                    // Launcher commits engine selection only after native readiness.
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
        if(!Trust(source,true) && type is not("stats" or "clan" or "game" or "fullscreen" or "crash-status" or "diagnostics-poll" or "update-check" or "update-install" or "update-open-release" or "discord-community" or "auth-help"))return;
        switch(type)
        {
            case "game": Go(Game);break;
            case "update-open-release":
                // Retained for older overlays. Beta 1.0.13 uses the fixed
                // native request-command above to survive bridge races.
                _=Task.Run(()=>ClientCommunityLinks.OpenPublicReleases());
                break;
            case "auth-help":ShowAccountHelp();break;
            case "discord-community":
                Reply("setCommunityStatus",ClientCommunityLinks.OpenInvite()
                    ? "KS Discord invite handed to Windows default browser."
                    : "Could not start your Windows default browser. Copy https://discord.gg/cxP386yGjk");
                break;
            case "stats": Go(Stats);break;
            case "clan": Go(Clans);break;
            case "fullscreen":ToggleFull();break;
            case "game-resolution":SetGameResolution(m.Preset??"native");break;
            case "menu-resolution":SetMenuResolution(m.Preset??"native");break;
            case "engine-info":Reply("setEngineInfo","CEF (CefSharp)");break;
            case "engine-switch":
                if(m.Engine=="electron")SwitchToElectron();
                break;
            case "update-config":
                SaveUpdaterPreferences(m);
                if(lastNativeUpdateStatus is not null)Reply("setUpdateStatus",lastNativeUpdateStatus);
                else if(!updateCheckInProgress && nativeUpdaterPrefs.Automatic && lastAutoUpdateCheck==DateTime.MinValue)
                    CheckKSUpdate(nativeUpdaterPrefs.Channel,true,nativeUpdaterPrefs.AutoDownload);
                break;
            case "update-check":CheckKSUpdate(m.Channel=="stable"?"stable":m.Channel=="alpha"?"alpha":"beta",m.Automatic==true,m.AutoDownload==true);break;
            case "update-install":LaunchUpdateHelper("install",m.Channel=="stable"?"stable":m.Channel=="alpha"?"alpha":"beta");break;
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
            case "game-input-diagnostics":
                if(m.Message is "locked" or "released" or "pointerlockerror" or "gesture" or "motion-ok" or "motion-missing" or "fallback" or "request-failed") {
                    Program.Log("Kirka pointer lock: "+m.Message);
                    if(m.Message=="locked")SetPointerLockState(true);
                    else if(m.Message is "released" or "pointerlockerror")SetPointerLockState(false);
                    else if(m.Message=="gesture")FocusGameBrowser();
                }
                break;
            case "crash-status":Reply("setCrashStatus","CEF log: "+Program.LogPath);break;
            case "game-join":
                if(Uri.TryCreate(m.Url,UriKind.Absolute,out var targetUrl)
                    && Trust(targetUrl.ToString(),gameOnly:true)
                    && (targetUrl.AbsolutePath.StartsWith("/games/",StringComparison.Ordinal)
                    || targetUrl.AbsolutePath.StartsWith("/hub/ranked",StringComparison.Ordinal)
                    || targetUrl.AbsolutePath.StartsWith("/servers/",StringComparison.Ordinal)))
                    Go(targetUrl.ToString());
                break;
            case "game-screenshot":
                try
                {
                    var dir=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyPictures),"KSClient");
                    Directory.CreateDirectory(dir);
                    var output=Path.Combine(dir,"KSClient-"+DateTime.Now.ToString("yyyyMMdd-HHmmss-fff")+".png");
                    // Windows WinForms captures the visible browser rectangle.
                    // Occluding windows can appear in the screenshot.
                    using var shot=new Bitmap(Math.Max(1,browser.ClientSize.Width),Math.Max(1,browser.ClientSize.Height));
                    using(var g=Graphics.FromImage(shot))g.CopyFromScreen(browser.PointToScreen(Point.Empty),Point.Empty,shot.Size);
                    shot.Save(output,System.Drawing.Imaging.ImageFormat.Png);
                    Reply("setGameExtraStatus","Screenshot saved: "+output);
                }
                catch(Exception ex){Reply("setGameExtraStatus","Screenshot failed: "+ex.Message);}
                break;
            case "resource-save":
                try{
                    KSResourceSwap.SetEnabled(m.Enabled==true);
                    Reply("setWorkshopStatus",m.Enabled==true ? "Resource swaps enabled. Reload game to apply." : "Resource swaps disabled.");
                }catch(Exception ex){Reply("setWorkshopStatus","Cannot save swapper configuration: "+ex.Message);}
                break;
            case "resource-scan":
                try{var r=KSResourceSwap.Scan();Reply("setWorkshopStatus",r);}
                catch(Exception ex){Reply("setWorkshopStatus","Swapper scan failed: "+ex.Message);}
                break;
            case "resource-folder":
                try{var folder=KSResourceSwap.Folder();Process.Start(new ProcessStartInfo{
                    FileName="explorer.exe",Arguments="\""+folder+"\"",UseShellExecute=true
                });}catch(Exception ex){Reply("setWorkshopStatus","Could not open swapper folder: "+ex.Message);}
                break;
            case "fps-diagnostics":
                Reply("setNativeFpsDiagnostics",new {
                    engine="CEF",
                    requested=desired.UncapFps,
                    activeAtStartup=Program.Active.UncapFps,
                    frameRateLimitSwitch=Program.Active.UncapFps,
                    gpuVsyncSwitch=Program.Active.UncapFps,
                    gpuAccelerationRequested=Program.Active.Gpu!="disabled",
                    note="CEF startup flags requested; GPU/game FPS cannot be inferred"
                });break;
            case "diagnostics-poll":
                Reply("setDiagnostics",KSDiagnostics.Sample());break;
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
        if(keyData==(Keys.Control|Keys.Alt|Keys.E)){SwitchToElectron();return true;}
        if(keyData==(Keys.Control|Keys.R)){browser.Reload();return true;}
        return base.ProcessCmdKey(ref msg,keyData);
    }
    protected override void Dispose(bool disposing)
    {
        if(disposing){StopSwitchTimer();bridgeProbeTimeout?.Stop();bridgeProbeTimeout?.Dispose();browser?.Dispose();}
        base.Dispose(disposing);
    }
}
internal sealed class BridgeMsg
{
    public string? Type {get;set;}
    public string? Preset {get;set;}
    public string? Url {get;set;}
    public bool? Enabled {get;set;}
    public string? Section {get;set;}
    public string? Message {get;set;}
    public string? Engine {get;set;}
    public string? Channel {get;set;}
    public bool? Automatic {get;set;}
    public bool? AutoDownload {get;set;}
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
// Keep the KS-specific resource swapper and the internal engine switch.
// Unlike previous versions, Kirka's login providers and their native popups
// are not routed through a KS-managed authentication/navigation allowlist.
internal sealed class ClientRequestHandler : CefSharp.Handler.RequestHandler
{
    private readonly Action requestSwitchToElectron;
    internal ClientRequestHandler(Action requestSwitchToElectron)
    {
        this.requestSwitchToElectron=requestSwitchToElectron;
    }
    protected override IResourceRequestHandler GetResourceRequestHandler(
        IWebBrowser chromiumWebBrowser,IBrowser browser,IFrame frame,IRequest request,
        bool isNavigation,bool isDownload,string requestInitiator,ref bool disableDefaultHandling)
    {
        if(isNavigation||isDownload)return null!;
        var file=KSResourceSwap.Match(request.Url,requestInitiator);
        return file is null ? null! : new KSResourceRequestHandler(file);
    }
    protected override bool OnBeforeBrowse(IWebBrowser chromiumWebBrowser,IBrowser browser,
        IFrame frame,IRequest request,bool userGesture,bool isRedirect)
    {
        // Fixed same-origin commands are intercepted BEFORE Chromium navigates.
        // They avoid a dropped CefSharp.PostMessage while Kirka changes frames.
        // Nothing arbitrary can reach Windows: ONLY these literal actions work.
        // Keep this completely independent from Kirka's original OAuth popups.
        if(frame.IsMain)
        {
            string command=request.Url?.TrimEnd('/') ?? "";
            bool trusted=ClientForm.Trust(frame.Url,gameOnly:true) &&
                         ClientForm.Trust(chromiumWebBrowser.Address,gameOnly:true);
            if(string.Equals(command,"https://kirka.io/__ksclient_internal_switch_electron__",
                StringComparison.OrdinalIgnoreCase))
            {
                if(trusted)requestSwitchToElectron();
                return true;
            }
            if(string.Equals(command,"https://kirka.io/__ksclient_internal_open_discord__",
                StringComparison.OrdinalIgnoreCase))
            {
                if(trusted)_=Task.Run(()=>ClientCommunityLinks.OpenInvite());
                return true;
            }
            if(string.Equals(command,"https://kirka.io/__ksclient_internal_open_releases__",
                StringComparison.OrdinalIgnoreCase))
            {
                if(trusted)_=Task.Run(()=>ClientCommunityLinks.OpenPublicReleases());
                return true;
            }
        }
        // Kirka's Discord invite is a community shortcut, not an identity
        // provider. Only a genuine invite URL may open the fixed KS invite.
        if(userGesture && ClientForm.Trust(chromiumWebBrowser.Address,gameOnly:true)
            && ClientCommunityLinks.IsDiscordTarget(request.Url))
        {
            _=Task.Run(()=>ClientCommunityLinks.OpenInvite());
            return true;
        }
        // Security baseline only: never let web content navigate the browser
        // to local files or privileged script schemes. All ordinary HTTP(S)
        // account and callback URLs are left to Chromium, with NO host list.
        if(Uri.TryCreate(request.Url,UriKind.Absolute,out var target) &&
           target.Scheme is not("https" or "http" or "about"))
            return true;
        return false;
    }
}

internal sealed class ClientGamePermissionHandler : CefSharp.Handler.PermissionHandler
{
    protected override bool OnShowPermissionPrompt(IWebBrowser chromiumWebBrowser, IBrowser browser,
        ulong promptId, string requestingOrigin, PermissionRequestType requestedPermissions,
        IPermissionPromptCallback callback)
    {
        // PermissionRequestType is flags. Accept ONLY a single PointerLock request;
        // accepting a combined flags prompt would approve unrelated permissions.
        // Some CEF builds handle raw pointer lock without a permission prompt.
        Program.Log("CEF permission prompt type: "+requestedPermissions);
        if (ClientForm.Trust(requestingOrigin, gameOnly:true) &&
            requestedPermissions == PermissionRequestType.PointerLock)
        {
            using(callback) callback.Continue(PermissionRequestResult.Accept);
            Program.Log("CEF trusted Kirka.io pointer lock permission granted");
            return true;
        }
        return false;
    }
}
