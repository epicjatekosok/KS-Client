'use strict';
// KS Client Beta 1.0.2: real Electron host. No WebView2 dependency.
const { app, BrowserWindow, ipcMain, screen, dialog, session, shell } = require('electron');
const {spawn,execFile}=require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const APP_VERSION = 'Beta 1.0.2';
const GAME = 'https://kirka.io/';
const STATS = 'https://kirka-stats.lovable.app/';
const CLANS = 'https://kirka-clan-tracker-notpro9.lovable.app/';
const ALLOWED = new Set(['kirka.io','www.kirka.io','kirka-stats.lovable.app','kirka-clan-tracker-notpro9.lovable.app']);
const GAME_HOSTS = new Set(['kirka.io','www.kirka.io']);
const ROOT = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local'), 'KSClient');
const PROFILE = path.join(ROOT,'ElectronProfile');
const PREFS_FILE = path.join(ROOT, 'browser-settings.json');
const LOG_FILE = path.join(ROOT, 'electron-1.0.2.log');
fs.mkdirSync(ROOT,{recursive:true});
fs.mkdirSync(PROFILE,{recursive:true});
app.setPath('userData', PROFILE);
const overlayJS = fs.readFileSync(path.join(__dirname,'overlay','overlay.js'),'utf8');
const frameJS = fs.readFileSync(path.join(__dirname,'overlay','frame_pacer.js'),'utf8');
const extrasJS = fs.readFileSync(path.join(__dirname,'overlay','game_extras.js'),'utf8');
const workshopJS=fs.readFileSync(path.join(__dirname,'overlay','workshop.js'),'utf8');
const integrationBootJS=fs.readFileSync(path.join(__dirname,'overlay','integration_bootstrap.js'),'utf8');
const integrationCoreJS=fs.readFileSync(path.join(__dirname,'overlay','integration_core.js'),'utf8');
const gameRuntimeJS=fs.readFileSync(path.join(__dirname,'overlay','game_runtime.js'),'utf8');
const drawTelemetryJS=fs.readFileSync(path.join(__dirname,'overlay','render_telemetry.js'),'utf8');
const graphicsJS=fs.readFileSync(path.join(__dirname,'overlay','webgl_cosmetics.js'),'utf8');
const advancedJS=fs.readFileSync(path.join(__dirname,'overlay','advanced_integration.js'),'utf8');
const freezeJS=fs.readFileSync(path.join(__dirname,'overlay','freeze_guard.js'),'utf8');
// One atomic main-world evaluation, in dependency order, before Kirka page scripts.
const earlyGameJS=[frameJS,integrationBootJS,drawTelemetryJS,graphicsJS,freezeJS,gameRuntimeJS].join('\n;\n');
const SWAPPER=require('./swapper.cjs');
SWAPPER.registerSchemes();
const DEFAULT_PREFS = Object.freeze({gpu:'enabled',angle:'default',devTools:false,contextMenu:false,uncapFps:false});
function validURL(value, gameOnly=false) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && (gameOnly ? GAME_HOSTS : ALLOWED).has(u.hostname);
  } catch (_) { return false; }
}
// One module-scoped helper shared by the native IPC handler and the Electron
// navigation/popup callbacks. Keeping it inside createWindow caused a
// ReferenceError in receiveMessage and an unhandled main-process error dialog.
function isGameDiscordTarget(raw) {
  try {
    const u=new URL(raw);
    return u.protocol==='https:' &&
      ['discord.gg','discord.com','www.discord.com','discordapp.com'].includes(u.hostname);
  }catch(_){return false;}
}
// Kirka's account login uses real cross-origin OAuth popup windows.
// Keep these windows in Electron's persistent session, with the opener
// relationship intact. No blanket popups, Node.js, or file:// navigation.
const AUTH_HOSTS=new Set([
  'accounts.google.com','consent.google.com','myaccount.google.com',
  'gsi.google.com','oauth2.googleapis.com','accounts.youtube.com',
  'facebook.com','www.facebook.com','m.facebook.com','web.facebook.com',
  'appleid.apple.com','idmsa.apple.com',
  'login.microsoftonline.com','login.live.com','account.live.com',
  'github.com','www.github.com','discord.com','www.discord.com',
  'twitter.com','www.twitter.com','x.com','www.x.com','api.twitter.com',
  'id.twitch.tv','www.twitch.tv','steamcommunity.com','store.steampowered.com',
  'auth.kirka.io','accounts.kirka.io'
]);
const AUTH_SUFFIXES=['.firebaseapp.com','.web.app','.auth0.com','.supabase.co','.web3auth.io','.kirka.io'];
function validAuthURL(raw,allowBlank=false){
  if(allowBlank && (raw==='' || raw==='about:blank'))return true;
  try{
    const u=new URL(raw);
    return u.protocol==='https:' && !u.username && !u.password && (u.port===''||u.port==='443') &&
      (validURL(raw,true) || AUTH_HOSTS.has(u.hostname) ||
       AUTH_SUFFIXES.some(suffix=>u.hostname.endsWith(suffix)));
  }catch(_){return false;}
}
// Track only browser windows created by the game or its trusted OAuth flow.
// Never expose the OAuth result or provider cookies to the native process.
const authContents=new WeakSet();
function authLocationLabel(raw){
  try {
    const u=new URL(raw);
    // A provider may place one-time tokens in URL paths as well as queries.
    // Log a hostname only; never store an OAuth code, state, or identity.
    return u.protocol==='https:' ? u.hostname : 'non-HTTPS';
  }catch(_){return 'unparseable';}
}
function authPopupOptions(parent){
  // Inherit the SAME defaultSession as the game. Different partitions would
  // allow Google login but strand the final Kirka account callback.
  return {title:'KS Client - Account sign-in',width:540,height:720,minWidth:420,minHeight:520,
    parent,autoHideMenuBar:true,backgroundColor:'#0d1015',
    webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true}};
}
function configureAuthPopup(child,depth=1){
  const content=child.webContents;
  authContents.add(content);
  child.setMenu(null);
  // Some identity providers open a second named popup after account selection.
  // Beta 1.0.2 blocked these indiscriminately; keep native opener references
  // while allowing only game / known HTTPS identity-provider destinations.
  content.setWindowOpenHandler(({url,referrer})=>{
    const source=content.getURL();
    const initiator=referrer?.url||'';
    if(depth>=3 || !validAuthURL(source,true) || !validAuthURL(url,true) ||
       (initiator && !validAuthURL(initiator,true))){
      log('OAuth nested popup blocked: '+authLocationLabel(url));
      return {action:'deny'};
    }
    log('OAuth nested popup allowed: '+authLocationLabel(url));
    return {action:'allow',overrideBrowserWindowOptions:authPopupOptions(child)};
  });
  content.on('did-create-window',nested=>configureAuthPopup(nested,depth+1));
  const validate=(event,url)=>{
    if(!validAuthURL(url)) {
      event.preventDefault();
      log('OAuth navigation blocked: '+authLocationLabel(url));
    }else{
      log('OAuth navigation allowed: '+authLocationLabel(url));
    }
  };
  content.on('will-navigate',validate);
  content.on('will-redirect',validate);
  content.on('did-fail-load',(_event,code,description,url,isMainFrame)=>{
    if(isMainFrame && code!==-3)
      log('OAuth load failed '+authLocationLabel(url)+': '+code+' '+String(description).slice(0,60));
  });
  content.on('render-process-gone',(_event,details)=>{
    log('OAuth renderer exited: '+String(details.reason).slice(0,70));
  });
}
function allowOAuthStoragePermission(contents,permission,requestingUrl){
  if(permission!=='storage-access' && permission!=='top-level-storage-access')return false;
  const isKirka=Boolean(win && contents===win.webContents &&
    validURL(win.webContents.getURL(),true));
  const isAuthPopup=Boolean(contents && authContents.has(contents));
  if(!isKirka && !isAuthPopup)return false;
  // Do not grant unrelated camera, microphone, geolocation or device access.
  if(permission==='storage-access')
    return validAuthURL(requestingUrl) && !validURL(requestingUrl,true);
  return (isKirka && validURL(requestingUrl,true)) ||
    (isAuthPopup && validAuthURL(requestingUrl));
}
function openKSDiscord(){
  // Constant URL: Kirka JavaScript is never permitted to pass its own URL
  // into the OS shell, preventing arbitrary external link execution.
  try{
    Promise.resolve(shell.openExternal('https://discord.gg/cxP386yGjk'))
      .then(()=>jsCall('setCommunityStatus','KS Discord invite handed to the Windows default browser.'))
      .catch(error=>{
        log('KS Discord external browser: '+String(error?.message||error));
        jsCall('setCommunityStatus','Cannot open default browser: '+String(error?.message||error).slice(0,160));
      });
  }catch(error){
    log('KS Discord external browser: '+String(error?.message||error));
    jsCall('setCommunityStatus','Windows could not open the Discord link.');
  }
}
function normPrefs(o) {
  if (!o || typeof o !== 'object') o={};
  return {gpu:o.gpu==='disabled'?'disabled':'enabled',angle:['d3d11','opengl'].includes(o.angle)?o.angle:'default',
    devTools:o.devTools===true,contextMenu:o.contextMenu===true,uncapFps:o.uncapFps===true};
}
function loadPrefs(){ try{return normPrefs(JSON.parse(fs.readFileSync(PREFS_FILE,'utf8')))}catch(_){return {...DEFAULT_PREFS}} }
function savePrefs(p){
  fs.mkdirSync(ROOT,{recursive:true});
  const temp=PREFS_FILE+'.tmp-'+process.pid;
  fs.writeFileSync(temp,JSON.stringify(p,null,2),'utf8');
  fs.renameSync(temp,PREFS_FILE);
}
function log(message) {try{fs.appendFileSync(LOG_FILE,new Date().toISOString()+' '+String(message).slice(0,400)+'\n')}catch(_){}}
const selfTest = process.argv.includes('--ks-self-test');
const safeMode = process.argv.includes('--ks-browser-safe-mode');
const tokenArg = process.argv.find(a=>a.startsWith('--ks-switch-token='));
const tokenValue = tokenArg ? tokenArg.slice('--ks-switch-token='.length) : '';
const switchToken = /^[a-f0-9]{32}$/i.test(tokenValue) ? tokenValue : '';
const switchProbe = process.argv.includes('--ks-switch-probe') && Boolean(switchToken);
let lastAutoUpdateCheck=0;
let updateCheckInProgress=false;
function updaterPath(){
  return path.resolve(__dirname,'..','..','..','..','KS-Client.exe');
}
function emitUpdateStatus(payload){
  if(payload && typeof payload==='object' && !Array.isArray(payload))
    jsCall('setUpdateStatus',{state:String(payload.state||'error').slice(0,40),
      current:String(payload.current||'1.0.2').slice(0,40),
      version:String(payload.version||'').slice(0,40),
      channel:String(payload.channel||'beta').slice(0,12),
      message:String(payload.message||'').slice(0,380),
      notes:String(payload.notes||'').slice(0,1800),
      cached:payload.cached===true,
      bytes:Number(payload.bytes)||0});
}
function execUpdater(args,callback){
  const file=updaterPath();
  if(!fs.existsSync(file)){callback(new Error('KS Client launcher is missing'),null);return;}
  execFile(file,args,{cwd:path.dirname(file),windowsHide:true,timeout:20000,maxBuffer:65536},(error,stdout)=>{
    if(error){callback(error,null);return;}
    try{const value=JSON.parse(stdout);callback(null,value)}
    catch(e){callback(new Error('Updater returned invalid JSON: '+e.message),null)}
  });
}
function checkKSUpdate(channel,automatic,autoDownload){
  if(updateCheckInProgress){emitUpdateStatus({state:'checking',message:'A GitHub release check is already in progress…'});return;}
  if(automatic && Date.now()-lastAutoUpdateCheck<24*60*60*1000)return;
  if(automatic)lastAutoUpdateCheck=Date.now();
  updateCheckInProgress=true;
  emitUpdateStatus({state:'checking',message:'Checking GitHub for updates…'});
  execUpdater(['--ks-update-check','--channel='+channel],(err,result)=>{
    updateCheckInProgress=false;
    if(err){emitUpdateStatus({state:'error',message:err.message});return;}
    emitUpdateStatus(result);
    if(automatic&&autoDownload&&result.state==='available')
      execUpdater(['--ks-update-prefetch','--channel='+channel],(ignored,response)=>{
        if(!ignored&&response?.state==='started')emitUpdateStatus({...result,message:'Update download started in background.'});
      });
  });
}
async function installKSUpdate(channel){
  if(!win)return;
  const decision=await dialog.showMessageBox(win,{type:'question',title:'KS Client Update',
    message:'Download and install a verified KS Client update?',
    detail:'The current game will close. Your settings, browser profiles and Workshop data are preserved.',
    buttons:['Install & Close Game','Cancel'],defaultId:1,cancelId:1,noLink:true});
  if(decision.response!==0)return;
  emitUpdateStatus({state:'downloading',message:'Starting verified update worker…'});
  execUpdater(['--ks-update-install','--channel='+channel],(error,result)=>{
    if(error||result?.state!=='started'){emitUpdateStatus({state:'error',message:error?.message||result?.message||'Could not start update'});return;}
    app.quit();
  });
}
let switchInProgress = false;
let switchProbeTimer = null;
function signalSwitchReady(){
  // Independent of Kirka.io network and renderer timing. Native window exists.
  if(!switchToken || !win || win.isDestroyed() || !win.isVisible()) return;
  try{
    fs.writeFileSync(path.join(ROOT,'engine-switch-'+switchToken+'.ready'),'electron','utf8');
    log('Native Electron window ready; launcher confirmation pending');
  }catch(e){log('Switch ready marker failed: '+e.message);}
  if(switchProbe && !switchProbeTimer){
    let checks=0;
    switchProbeTimer=setInterval(()=>{
      if(fs.existsSync(path.join(ROOT,'engine-switch-'+switchToken+'.ok'))){
        clearInterval(switchProbeTimer);
        app.exit(0);
      }else if(++checks>240){
        clearInterval(switchProbeTimer);
        app.exit(3);
      }
    },250);
  }
}
const active=safeMode?{...DEFAULT_PREFS}:loadPrefs();
let desired={...active};
if(safeMode)savePrefs(active);
// Chromium flags MUST be set before app.whenReady. Experimental; not guaranteed to unlock game FPS.
if(active.gpu==='disabled')app.disableHardwareAcceleration();
if(active.angle==='d3d11')app.commandLine.appendSwitch('use-angle','d3d11');
if(active.angle==='opengl')app.commandLine.appendSwitch('use-angle','gl');
if(active.uncapFps){
  // Experimental Chromium startup hints: these do NOT override the game engine,
  // GPU driver, compositor, or physical monitor refresh limits.
  for(const flag of ['disable-frame-rate-limit','disable-gpu-vsync','disable-renderer-backgrounding',
    'disable-background-timer-throttling','disable-backgrounding-occluded-windows']){
    app.commandLine.appendSwitch(flag);
  }
  log('Experimental FPS unlock requested on Electron startup');
}
let win=null;
let splash=null;
let splashTimeout=null;
function closeSplash(){
  if(splashTimeout){clearTimeout(splashTimeout);splashTimeout=null}
  if(splash&&!splash.isDestroyed())splash.close();
  splash=null;
}
function startSplash(){
  if(switchProbe||!win||win.isDestroyed())return;
  splash=new BrowserWindow({
    title:'KS Client — Betöltés',width:460,height:302,frame:false,resizable:false,
    autoHideMenuBar:true,skipTaskbar:true,show:false,parent:win,modal:false,
    backgroundColor:'#0d1015',
    webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true}
  });
  splash.setMenu(null);
  splash.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  splash.loadFile(path.join(__dirname,'assets','loading.html')).catch(e=>log('Splash asset: '+e.message));
  const positionSplash=()=>{
    if(!splash||splash.isDestroyed()||!win||win.isDestroyed())return;
    const bounds=win.getBounds(),s=splash.getBounds();
    splash.setPosition(Math.round(bounds.x+(bounds.width-s.width)/2),Math.round(bounds.y+(bounds.height-s.height)/2));
  };
  win.on('move',positionSplash);win.on('resize',positionSplash);
  win.on('closed',closeSplash);
  positionSplash();
  splash.showInactive();
  // Never block login/retry forever on a slow/offline Kirka.io page.
  splashTimeout=setTimeout(()=>{log('Startup splash timeout; game remains interactive');closeSplash()},18000);
}
let currentURL=GAME;
let menuResolution='native';
let gameResolution='native';
const RES={720:[1280,720],1080:[1920,1080],1440:[2560,1440],2160:[3840,2160]};
function needsRestart(){return active.gpu!==desired.gpu||active.angle!==desired.angle||active.uncapFps!==desired.uncapFps}
function jsCall(name,...args){
  if(!win || win.isDestroyed() || !validURL(win.webContents.getURL()))return;
  const script=`window.__KS_CLIENT__?.${name}?.apply(window.__KS_CLIENT__, ${JSON.stringify(args)});`;
  win.webContents.executeJavaScript(script,true).catch(()=>{});
}
function browserConfig(status='') {jsCall('setBrowserConfig',desired,active,needsRestart(),status)}
function runJS(code){if(win && !win.isDestroyed() && validURL(win.webContents.getURL()))win.webContents.executeJavaScript(code,true).catch(()=>{});}
function navigate(url){if(!validURL(url))return;currentURL=url;win.loadURL(url).catch(e=>log(e.message));}
function setWindowSize(preset) {
  if(preset!=='native'&&!RES[preset])return;
  menuResolution=preset;
  if(!win || win.isFullScreen())return;
  const display=screen.getDisplayMatching(win.getBounds());
  const work=display.workArea;
  if(preset==='native'){win.setBounds(work);return;}
  const [width,height]=RES[preset];
  const w=Math.min(width,work.width),h=Math.min(height,work.height);
  win.setBounds({x:work.x+Math.floor((work.width-w)/2),y:work.y+Math.floor((work.height-h)/2),width:w,height:h});
}
function setGameResolution(preset){
  if(preset!=='native'&&!RES[preset])return;
  gameResolution=preset;
  // Electron has no equivalent of WebView2's rasterizationScale. Page zoom
  // is a real operation but changes the page layout; do not promise GPU supersampling.
  if(!win)return;
  const target=RES[preset];
  const zoom=target?Math.min(2,Math.max(.5,target[1]/Math.max(win.getContentBounds().height,240))):1;
  win.webContents.setZoomFactor(zoom);
}
function installShortcuts(){
  win.webContents.on('before-input-event',(event,input)=>{
    if(input.type!=='keyDown')return;
    if(input.key==='F11'){event.preventDefault();win.setFullScreen(!win.isFullScreen());}
    if(input.key==='F1'){event.preventDefault();runJS('window.__KS_CLIENT__?.toggle?.()')}
    if(input.key==='F10'){event.preventDefault();runJS('window.__KS_CLIENT__?.toggleHud?.()')}
    if(input.key==='F12' && desired.devTools){event.preventDefault();win.webContents.openDevTools({mode:'detach'})}
    if(input.control && input.alt && input.key.toLowerCase()==='c'){
      event.preventDefault();switchEngine('cef');return;
    }
    if(input.control && input.key.toLowerCase()==='r'){event.preventDefault();win.webContents.reload()}
  });
}
function createWindow(){
  win=new BrowserWindow({title:'KS Client '+APP_VERSION+' — Electron',width:1280,height:800,minWidth:800,minHeight:500,
    autoHideMenuBar:true, backgroundColor:'#0d1015', icon:path.join(__dirname,'assets','ks-logo.png'),
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,nodeIntegration:false,contextIsolation:true,
      webSecurity:true,devTools:true,backgroundThrottling:false,defaultFontFamily:{standard:'Segoe UI'}}});
  win.setMenu(null);
  // Only game-originated, known HTTPS identity providers can open native
  // OAuth windows. This preserves window.opener and Kirka's existing cookies.
  // Google may independently reject embedded user agents; never spoof it.
  win.webContents.setWindowOpenHandler(({url,referrer})=>{
    const source=win.webContents.getURL();
    if(!validURL(source,true))return {action:'deny'};
    if(isGameDiscordTarget(url)){openKSDiscord();return {action:'deny'};}
    const initiator=referrer?.url||'';
    if(initiator && !validURL(initiator,true) && !validAuthURL(initiator))
      return {action:'deny'};
    if(!validAuthURL(url,true)){
      log('Blocked non-authentication popup');
      return {action:'deny'};
    }
    log('Allowed Kirka OAuth popup');
    return {action:'allow',overrideBrowserWindowOptions:authPopupOptions(win)};
  });
  win.webContents.on('did-create-window',child=>configureAuthPopup(child));
  const guardMainNavigation=(event,target)=>{
    if(validURL(target))return;
    const source=win.webContents.getURL();
    if(validAuthURL(target) && (validURL(source,true)||validAuthURL(source)))return;
    event.preventDefault();
    if(validURL(source,true)&&isGameDiscordTarget(target))openKSDiscord();
    else log('Blocked navigation outside client/OAuth allowlist');
  };
  win.webContents.on('will-navigate',guardMainNavigation);
  win.webContents.on('will-redirect',guardMainNavigation);
  win.webContents.on('context-menu',(event)=>{if(!desired.contextMenu)event.preventDefault()});
  win.webContents.on('dom-ready',async()=>{
    if(switchProbe)return;
    if(!validURL(win.webContents.getURL()))return;
    // Frame pacer is also installed at document start by preload where possible.
    // The overlay runs after the page DOM exists, retaining its 1.0.21 settings UI.
    try{
      await win.webContents.executeJavaScript(frameJS,true);
      // Late fallback if early main-world evaluation was blocked or missed.
      await win.webContents.executeJavaScript(integrationBootJS,true);
      await win.webContents.executeJavaScript(drawTelemetryJS,true);
      await win.webContents.executeJavaScript(gameRuntimeJS,true);
      await win.webContents.executeJavaScript(overlayJS,true);
      await win.webContents.executeJavaScript(extrasJS,true);
      await win.webContents.executeJavaScript(workshopJS,true);
      await win.webContents.executeJavaScript(integrationCoreJS,true);
      await win.webContents.executeJavaScript(graphicsJS,true);
      await win.webContents.executeJavaScript(advancedJS,true);
      await win.webContents.executeJavaScript(freezeJS,true);
      jsCall('setEngineInfo','Electron');
      browserConfig();
    }catch(e){log('Overlay: '+e.message)}
    setGameResolution(gameResolution);
    closeSplash();
  });
  win.webContents.on('render-process-gone',(e,d)=>{log('Renderer gone: '+d.reason);closeSplash()});
  win.webContents.on('did-fail-load',(_e,code,text,validatedURL,isMainFrame)=>{
    if(isMainFrame){log('Game load failed: '+code+' '+String(text).slice(0,100));closeSplash()}
  });
  win.on('closed',()=>{win=null});
  installShortcuts();
  // The logo-based startup animation is a separate sandboxed local window.
  // It closes at DOM readiness and never overlays an active match.
  if(!switchProbe)startSplash();
  // A completed BrowserWindow creation is a native engine startup, even if
  // Kirka.io is offline. The old engine closes only after the launcher confirms.
  if(switchProbe){
    win.loadURL('data:text/html,<html><body>KS Client native Electron switch probe</body></html>').catch(e=>log(e.message));
  }else{
    navigate(GAME);
  }
  win.show();
  signalSwitchReady();
  log('Electron native window started; game load is checked separately');
}
// Preserve the old window until the new engine has actually loaded its UI.
// The launcher relays a one-time nonce; the new engine acknowledges from DOM-ready.
function switchEngine(target) {
  if(switchInProgress || !['electron','cef'].includes(target))return;
  const root=path.resolve(__dirname,'..','..','..','..');
  const launcher=path.join(root,'KS-Client.exe');
  const targetExe=target==='cef'?path.join(root,'runtime','CEF','KS.Cef.Client.exe'):path.join(root,'runtime','Electron','electron.exe');
  if(!fs.existsSync(launcher)||!fs.existsSync(targetExe)){
    jsCall('setEngineSwitchStatus','Engine or launcher missing. Repair the offline installation.');
    return;
  }
  const nonce=crypto.randomBytes(16).toString('hex');
  const ready=path.join(ROOT,'engine-switch-'+nonce+'.ok');
  const failed=path.join(ROOT,'engine-switch-'+nonce+'.error');
  let timer=null;
  function tidy(){
    if(timer){clearInterval(timer);timer=null;}
    for(const file of [ready,failed])try{fs.unlinkSync(file)}catch(_){}
    switchInProgress=false;
  }
  function fail(message){
    tidy();
    // The launcher owns the persisted engine preference and rolls back.
    jsCall('setEngineSwitchStatus',String(message).slice(0,280));
    log('Engine switch failed: '+message);
  }
  switchInProgress=true;
  jsCall('setEngineSwitchStatus','Starting '+target.toUpperCase()+'; waiting for the new window...');
  try{
    const child=spawn(launcher,['--engine',target,'--ks-switch-token='+nonce],
      {cwd:root,detached:true,stdio:'ignore',windowsHide:true});
    child.once('error',e=>fail('Could not start KS Client launcher: '+e.message));
    child.once('spawn',()=>{
      child.unref();
      let count=0;
      timer=setInterval(()=>{
        if(fs.existsSync(ready)){
          tidy();
          app.quit();
        }else if(fs.existsSync(failed)){
          let reason='Engine launcher failed';
          try{reason=fs.readFileSync(failed,'utf8').slice(0,260)}catch(_){}
          fail(reason);
        }else if(++count>=200){
          fail('No native startup confirmation from '+target.toUpperCase()+' within 50 seconds. The current engine remains open.');
        }
      },250);
    });
  }catch(e){fail('Failed to start '+target.toUpperCase()+': '+e.message);}
}
function receiveMessage(event, raw){
  if(!win || event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame)return;
  const source=event.senderFrame.url;
  if(!validURL(source) || !raw || typeof raw!=='object' || Array.isArray(raw))return;
  let data=''; try{data=JSON.stringify(raw)}catch(_){return}
  if(data.length>8192 || typeof raw.type!=='string')return;
  const basic=new Set(['stats','clan','game','fullscreen','crash-status','diagnostics-poll','update-check','update-install','update-open-release','discord-community']);
  if(!validURL(source,true)&&!basic.has(raw.type))return;
  switch(raw.type){
    case 'stats':navigate(STATS);break;
    case 'clan':navigate(CLANS);break;
    case 'game':navigate(GAME);break;
    case 'update-open-release':void shell.openExternal('https://github.com/epicjatekosok/KS-Client-Updates/releases').catch(e=>log('Public release page: '+e.message));break;
    case 'discord-community':openKSDiscord();break;
    case 'fullscreen':win.setFullScreen(!win.isFullScreen());break;
    case 'game-resolution':setGameResolution(String(raw.preset||'native'));break;
    case 'menu-resolution':setWindowSize(String(raw.preset||'native'));break;
    case 'engine-info':jsCall('setEngineInfo','Electron');break;
    case 'engine-switch':{
      if(raw.engine==='cef')switchEngine('cef');
      break;
    }
    case 'update-check':checkKSUpdate(['alpha','beta','stable'].includes(raw.channel)?raw.channel:'beta',raw.automatic===true,raw.autoDownload===true);break;
    case 'update-install':void installKSUpdate(['alpha','beta','stable'].includes(raw.channel)?raw.channel:'beta');break;
    case 'browser-config':browserConfig();break;
    case 'browser-save':{
      desired=normPrefs(raw.browser);
      try{savePrefs(desired);browserConfig(needsRestart()?'Saved. Restart to apply Chromium launch switches.':'Browser preferences saved.');}
      catch(e){browserConfig('Could not save: '+e.message)}
      break;
    }
    case 'browser-reset':{
      const section=String(raw.section||'');
      if(section==='graphics'){desired={...desired,gpu:'enabled',angle:'default',uncapFps:false}}
      else if(section==='controls'){desired={...desired,devTools:false,contextMenu:false}}
      else if(section==='all'){desired={...DEFAULT_PREFS}}
      else return;
      savePrefs(desired);browserConfig('Defaults saved. Restart if needed.');break;
    }
    case 'browser-restart':{
      if(win){app.relaunch({args:process.argv.slice(1).filter(a=>a!=='--ks-browser-safe-mode')});app.exit(0)}
      break;
    }
    case 'game-join':{
      const requested=String(raw.url||'');
      try{
        const u=new URL(requested);
        if(!validURL(u.toString(),true) || !/^\/(games\/|hub\/ranked|servers\/)/.test(u.pathname))throw Error('Invalid Kirka.io game link');
        navigate(u.toString());
      }catch(e){log('Quick join blocked: '+e.message);}
      break;
    }
    case 'game-screenshot':{
      const folder=path.join(os.homedir(),'Pictures','KSClient');
      fs.mkdirSync(folder,{recursive:true});
      const stamp=new Date().toISOString().replace(/[:.]/g,'-');
      const output=path.join(folder,'KSClient-'+stamp+'.png');
      win.webContents.capturePage().then(img=>{
        fs.writeFileSync(output,img.toPNG());
        log('Screenshot saved to '+output);
        jsCall('setGameExtraStatus','Screenshot saved: '+output);
      }).catch(e=>{log('Screenshot failed: '+e.message);jsCall('setGameExtraStatus','Screenshot failed: '+e.message)});
      break;
    }
    case 'resource-save':{
      const enabled=SWAPPER.setEnabled(raw.enabled===true);
      jsCall('setWorkshopStatus',enabled?'Resource swaps enabled. Reload the game to apply.':'Resource swaps disabled.');
      break;
    }
    case 'resource-folder':{
      const folder=SWAPPER.folder();
      shell.openPath(path.dirname(folder)).then(error=>{
        if(error)jsCall('setWorkshopStatus','Could not open swapper folder: '+error);
      });
      break;
    }
    case 'resource-scan':{
      const result=SWAPPER.scan();
      jsCall('setWorkshopStatus',result.count+' local files ('+Math.round(result.bytes/1024)+' KiB). Swapper '+(result.enabled?'enabled':'disabled')+'.');
      break;
    }
    case 'fps-diagnostics':{
      jsCall('setNativeFpsDiagnostics',{
        engine:'Electron',
        requested:desired.uncapFps,
        activeAtStartup:active.uncapFps,
        frameRateLimitSwitch:app.commandLine.hasSwitch('disable-frame-rate-limit'),
        gpuVsyncSwitch:app.commandLine.hasSwitch('disable-gpu-vsync'),
        gpuAccelerationRequested:active.gpu!=='disabled',
        note:'Native startup switches only; no claim of actual game/GPU FPS.'
      });
      break;
    }
    case 'diagnostics-poll':{
      // Electron's native API includes the host, renderers, GPU and utilities.
      // Never infer game FPS from these process diagnostics.
      let metrics=[];
      try {metrics=app.getAppMetrics();}catch(e){log('Electron metrics: '+e.message);}
      const children=metrics.filter(item=>item.pid!==process.pid);
      const cpu=item=>Number.isFinite(item?.cpu?.percentCPUUsage)?Math.max(0,item.cpu.percentCPUUsage):0;
      const ram=item=>Number.isFinite(item?.memory?.workingSetSize)?Math.max(0,item.memory.workingSetSize/1024):0;
      let hostCPU=0;
      try {hostCPU=Math.max(0,process.getCPUUsage().percentCPUUsage||0);}catch(_){}
      jsCall('setDiagnostics',{
        browserCPU:children.reduce((sum,item)=>sum+cpu(item),0),
        browserRAM:children.reduce((sum,item)=>sum+ram(item),0),
        browserProcesses:1+children.length,
        clientCPU:hostCPU,
        clientRAM:Math.round(process.memoryUsage().rss/1048576),
        engine:'Electron',
        sampling:'Native Electron process metrics (host and child Chromium processes). CPU is sampled since the previous call; the first sample can be zero.'
      });
      break;
    }
    case 'crash-status':jsCall('setCrashStatus','Electron log: '+LOG_FILE);break;
    case 'open-logs':require('electron').shell.openPath(ROOT);break;
    case 'game-input-diagnostics':{
      const detail=String(raw.message||'').slice(0,40);
      if(['locked','released','pointerlockerror'].includes(detail))log('Kirka pointer lock: '+detail);
      break;
    }
    case 'client-error':log('Overlay warning: '+String(raw.message||'').slice(0,240));break;
  }
}
// A malformed or racing page event must never crash Electron's main thread.
ipcMain.on('ks:message',(event,raw)=>{
  try{receiveMessage(event,raw);}
  catch(error){
    log('KS IPC handler error: '+String(error?.stack||error).slice(0,440));
    if(raw?.type==='discord-community')
      jsCall('setCommunityStatus','KS Discord could not be opened. Try again.');
  }
});
ipcMain.on('ks:early-bundle',(event)=>{
  const source=event.senderFrame?.url||event.sender?.getURL?.()||'';
  event.returnValue=(win&&event.sender===win.webContents&&validURL(source,true))?earlyGameJS:'';
});
// Retain individual channels for backward-compatible diagnostics and tools.
ipcMain.on('ks:early-freeze',(event)=>{
  const source=event.senderFrame?.url||'';
  event.returnValue=(win&&event.sender===win.webContents&&validURL(source,true))?freezeJS:'';
});
ipcMain.on('ks:early-graphics',(event)=>{
  const source=event.senderFrame?.url||'';
  event.returnValue=(win&&event.sender===win.webContents&&validURL(source,true))?graphicsJS:'';
});
ipcMain.on('ks:early-integration',(event)=>{
  const source=event.senderFrame?.url||'';
  event.returnValue=(win && event.sender===win.webContents && validURL(source,true))?integrationBootJS:'';
});
ipcMain.on('ks:early-pacer',(event)=>{
  const source=event.senderFrame?.url||'';
  event.returnValue=(win && event.sender===win.webContents && validURL(source,true))?frameJS:'';
});
app.whenReady().then(()=>{
  if(selfTest){
    log('Electron runtime self-test: PASS (app.ready)');
    app.exit(0);
    return;
  }
  // Use the browser permissions necessary for an FPS game, deny unrelated access.
  const allowGamePermission=(wc,permission,origin)=>{
    const isGame=validURL(origin||wc?.getURL?.()||'',true);
    return (isGame && (permission==='pointerLock'||permission==='fullscreen')) ||
      allowOAuthStoragePermission(wc,permission,origin);
  };
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>{
    const origin=details?.requestingUrl||contents?.getURL()||'';
    const allow=allowGamePermission(contents,permission,origin);
    if(permission==='pointerLock')log('PointerLock permission request '+(allow?'ALLOW':'DENY'));
    callback(allow); // Synchronous: do not hold a native permission callback.
  });
  // Chromium checks permissions before requesting them; both handlers are needed.
  session.defaultSession.setPermissionCheckHandler((contents,permission,origin,details)=>{
    const requestOrigin=details?.requestingUrl||origin||contents?.getURL()||'';
    return allowGamePermission(contents,permission,requestOrigin);
  });
  SWAPPER.install(log);
  log('FPS startup flags: '+JSON.stringify({
    requested:active.uncapFps,
    frameRateLimitSwitch:app.commandLine.hasSwitch('disable-frame-rate-limit'),
    gpuVsyncSwitch:app.commandLine.hasSwitch('disable-gpu-vsync')
  }));
  createWindow();
}).catch(e=>{log(e.stack||e);dialog.showErrorBox('KS Client Electron',String(e.message||e));app.exit(1)});
app.on('window-all-closed',()=>app.quit());
