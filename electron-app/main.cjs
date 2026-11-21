'use strict';
// KS Client Beta 1.0.25: real Electron host. No WebView2 dependency.
const { app, BrowserWindow, ipcMain, screen, dialog, session, shell } = require('electron');
const {execFile,spawn}=require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const APP_VERSION = 'Beta 1.0.25';
const GAME = 'https://kirka.io/';
const STATS = 'https://kirka-stats.lovable.app/';
const CLANS = 'https://kirka-clan-tracker-notpro9.lovable.app/';
const ALLOWED = new Set(['kirka.io','www.kirka.io','kirka-stats.lovable.app','kirka-clan-tracker-notpro9.lovable.app']);
const GAME_HOSTS = new Set(['kirka.io','www.kirka.io']);
const ROOT = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local'), 'KSClient');
const PROFILE = path.join(ROOT,'ElectronProfile');
const PREFS_FILE = path.join(ROOT, 'browser-settings.json');
const UPDATE_PREFS_FILE = path.join(ROOT, 'updater-preferences.json');
const LOG_FILE = path.join(ROOT, 'electron-1.0.25.log');
fs.mkdirSync(ROOT,{recursive:true});
fs.mkdirSync(PROFILE,{recursive:true});
app.setPath('userData', PROFILE);
const localeDirectory = path.join(__dirname,'locales');
const bundledLocales = Object.fromEntries(fs.readdirSync(localeDirectory)
  .filter(file=>/^[a-z]{2}\.json$/.test(file))
  .map(file=>[path.basename(file,'.json'),JSON.parse(fs.readFileSync(path.join(localeDirectory,file),'utf8'))]));
const workshopLocales=JSON.parse(fs.readFileSync(path.join(__dirname,'workshop-locales.json'),'utf8'));
for(const [code,messages] of Object.entries(workshopLocales))Object.assign(bundledLocales[code],messages);
const overlayJS = 'window.__KS_LOCALES__=' + JSON.stringify(bundledLocales) + ';\n' +
  fs.readFileSync(path.join(__dirname,'overlay','overlay.js'),'utf8');
const nativeLoginGateJS = fs.readFileSync(path.join(__dirname,'overlay','native_login_gate.js'),'utf8');
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
// Kirka owns its login and OAuth popups. Just like Redline, Electron's
// built-in navigation/window.open implementation retains the opener and
// persistent defaultSession. Do NOT register per-provider host allowlists,
// popup overrides, user-agent spoofing, or custom Google routing here.
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
function readUpdatePreferences(){
  try{
    const raw=JSON.parse(fs.readFileSync(UPDATE_PREFS_FILE,'utf8'));
    if(!raw || typeof raw!=='object')throw Error('Invalid updater preferences');
    return {automatic:raw.automatic!==false,autoDownload:raw.autoDownload!==false,
      channel:['alpha','beta','stable'].includes(raw.channel)?raw.channel:'beta'};
  }catch(_){return {automatic:true,autoDownload:true,channel:'beta'};}
}
let nativeUpdatePreferences=readUpdatePreferences();
function saveUpdatePreferences(raw){
  nativeUpdatePreferences={automatic:raw.automatic===true,autoDownload:raw.autoDownload===true,
    channel:['alpha','beta','stable'].includes(raw.channel)?raw.channel:'beta'};
  try{fs.writeFileSync(UPDATE_PREFS_FILE,JSON.stringify(nativeUpdatePreferences),{encoding:'utf8',mode:0o600});}
  catch(e){log('Updater preference save failed: '+String(e.message||e).slice(0,80))}
}
let lastNativeUpdateStatus=null;
let lastAutoUpdateCheck=0;
let updateCheckInProgress=false;
function updaterPath(){
  return path.resolve(__dirname,'..','..','..','..','KS-Client.exe');
}
function updateSplashStatus(status){
  if(!splash||splash.isDestroyed())return;
  const label=status.state==='checking'?'CHECKING UPDATES…':
    status.state==='available'?'UPDATE '+String(status.version||'')+' AVAILABLE':
    status.state==='current'?'CLIENT UP TO DATE':'LOADING KS CLIENT';
  splash.webContents.executeJavaScript(`document.getElementById('startup-update-status')?.replaceChildren(document.createTextNode(${JSON.stringify(label)}));`,true).catch(()=>{});
}
function emitUpdateStatus(payload){
  if(!payload || typeof payload!=='object'||Array.isArray(payload))return;
  const safe={state:String(payload.state||'error').slice(0,40),
      current:String(payload.current||'1.0.25').slice(0,40),
      version:String(payload.version||'').slice(0,40),
      channel:String(payload.channel||nativeUpdatePreferences.channel).slice(0,12),
      message:String(payload.message||'').slice(0,380),
      notes:String(payload.notes||'').slice(0,1800),
      cached:payload.cached===true,
      bytes:Number(payload.bytes)||0};
  lastNativeUpdateStatus=safe;
  updateSplashStatus(safe);
  jsCall('setUpdateStatus',safe);
}
function execUpdater(args,callback){
  const file=updaterPath();
  if(!fs.existsSync(file)){callback(new Error('KS Client launcher is missing'),null);return;}
  // A GitHub API timeout and a bounded retry may require up to 37 seconds.
  // The old 20s process deadline killed the updater before it could report
  // its own result, leaving Settings stuck on a generic timeout message.
  const lookup=args.includes('--ks-update-check');
  execFile(file,args,{cwd:path.dirname(file),windowsHide:true,
    timeout:lookup?48000:20000,maxBuffer:65536},(error,stdout)=>{
    if(error){
      if(error.killed || error.code==='ETIMEDOUT') {
        callback(new Error('GitHub update lookup took too long. Try again or use Open GitHub Releases.'),null);return;
      }
      callback(error,null);return;
    }
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
    if(automatic&&autoDownload&&nativeUpdatePreferences.automatic&&nativeUpdatePreferences.autoDownload&&result.state==='available')
      execUpdater(['--ks-update-prefetch','--channel='+channel],(ignored,response)=>{
        if(!ignored&&response?.state==='started')emitUpdateStatus({...result,message:'Update download started in background.'});
      });
  });
}
async function installKSUpdate(channel,language){
  if(!win)return;
  const catalog=typeof language==='string' && Object.hasOwn(bundledLocales,language)?bundledLocales[language]:null;
  const tr=message=>catalog?.[message]||message;
  const decision=await dialog.showMessageBox(win,{type:'question',title:tr('KS Client Update'),
    message:tr('Download and install a verified KS Client update?'),
    detail:tr('The current game will close. Your settings, browser profiles and Workshop data are preserved.'),
    buttons:[tr('Install & Close Game'),tr('Cancel')],defaultId:1,cancelId:1,noLink:true});
  if(decision.response!==0)return;
  emitUpdateStatus({state:'downloading',message:'Starting verified update worker…'});
  execUpdater(['--ks-update-install','--channel='+channel],(error,result)=>{
    if(error||result?.state!=='started'){emitUpdateStatus({state:'error',message:error?.message||result?.message||'Could not start update'});return;}
    app.quit();
  });
}
const crypto = require('node:crypto');
const installedEngines=Object.freeze({electron:['Electron','electron.exe']});
let switchInProgress=false;
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
const fixedMarker=path.join(ROOT,'electron-fixed-frame-target');
let fixedTarget=fs.existsSync(fixedMarker);
let desired=safeMode?{...DEFAULT_PREFS}:loadPrefs();
const active={...desired,uncapFps:desired.uncapFps&&!fixedTarget};
if(safeMode)savePrefs(desired);
// Chromium flags MUST be set before app.whenReady. Experimental; not guaranteed to unlock game FPS.
if(active.gpu==='disabled')app.disableHardwareAcceleration();
if(active.angle==='d3d11')app.commandLine.appendSwitch('use-angle','d3d11');
if(active.angle==='opengl')app.commandLine.appendSwitch('use-angle','gl');
if(active.uncapFps){
  // Experimental Chromium startup hints: these do NOT override the game engine,
  // GPU driver, compositor, or physical monitor refresh limits.
  for(const flag of ['disable-frame-rate-limit','disable-gpu-vsync']){
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
    title:'KS Client — Loading',width:490,height:390,minWidth:490,minHeight:390,frame:false,resizable:false,
    autoHideMenuBar:true,skipTaskbar:true,show:false,parent:win,modal:false,
    backgroundColor:'#0d1015',
    webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true}
  });
  splash.setMenu(null);
  splash.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  splash.loadFile(path.join(__dirname,'assets','loading.html')).catch(e=>log('Splash asset: '+e.message));
  splash.webContents.once('did-finish-load',()=>{if(lastNativeUpdateStatus)updateSplashStatus(lastNativeUpdateStatus);});
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
let gameDisplay;
const RES={720:[1280,720],1080:[1920,1080],1440:[2560,1440],2160:[3840,2160]};
function needsRestart(){return active.gpu!==desired.gpu||active.angle!==desired.angle||active.uncapFps!==(desired.uncapFps&&!fixedTarget)}
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
function installShortcuts(){
  win.webContents.on('before-input-event',(event,input)=>{
    if(input.type!=='keyDown')return;
    if(input.isAutoRepeat && ['F1','F10','F11'].includes(input.key)){event.preventDefault();return;}
    if(input.key==='F11'){event.preventDefault();win.setFullScreen(!win.isFullScreen());}
    if(input.key==='F1'){event.preventDefault();runJS('window.__KS_CLIENT__?.toggle?.()')}
    if(input.key==='F10'){event.preventDefault();runJS('window.__KS_CLIENT__?.toggleHud?.()')}
    if(input.key==='F12' && desired.devTools){event.preventDefault();win.webContents.openDevTools({mode:'detach'})}
    if(input.control && input.key.toLowerCase()==='r'){event.preventDefault();win.webContents.reload()}
  });
}
function createWindow(){
  win=new BrowserWindow({title:'KS Client '+APP_VERSION+' — Electron',width:1280,height:800,minWidth:800,minHeight:500,
    autoHideMenuBar:true, backgroundColor:'#0d1015', icon:path.join(__dirname,'assets','ks-logo.png'),
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,nodeIntegration:false,contextIsolation:true,
      webSecurity:true,devTools:true,backgroundThrottling:true,defaultFontFamily:{standard:'Segoe UI'}}});
  win.setMenu(null);
  gameDisplay=require('./game-resolution.cjs').createGameResolution(win,
    ()=>screen.getDisplayMatching(win.getBounds()).scaleFactor,()=>validURL(win.webContents.getURL(),true));
  win.on('resize',gameDisplay.apply);
  win.on('move',gameDisplay.apply);
  win.on('restore',gameDisplay.apply);
  win.webContents.on('did-start-navigation',(event,_url,inPlace,mainFrame)=>{
    if((event.isMainFrame ?? mainFrame) && !(event.isSameDocument ?? inPlace))gameDisplay.leave();
  });
  // No game setWindowOpenHandler, did-create-window OAuth wrapper,
  // will-navigate interceptor or will-redirect interceptor. Electron 45
  // handles Kirka's window.open and normal HTTPS navigation natively.
  // This matches Redline's simpler BrowserWindow approach.
  win.webContents.on('context-menu',(event)=>{if(!desired.contextMenu)event.preventDefault()});
  win.webContents.on('dom-ready',async()=>{
    if(switchProbe)return;
    if(!validURL(win.webContents.getURL()))return;
    // Frame pacer is also installed at document start by preload where possible.
    // The overlay runs after the page DOM exists, retaining its 1.0.25 settings UI.
    try{
      // Let Kirka's original email/password and OAuth buttons handle their
      // own events without any injected KS listeners or render hooks.
      // Dawn's native sign-in approach uses the site's own login UI.
      if(validURL(win.webContents.getURL(),true)){
        await win.webContents.executeJavaScript(nativeLoginGateJS,true);
        const authenticated=await win.webContents.executeJavaScript(
          "(()=>{try{return !!localStorage.getItem('token')}catch(_){return false}})()",true);
        if(!authenticated){
          log('Kirka sign-in: running original game login UI without KS injections');
          gameDisplay.select('native');
          closeSplash();
          return;
        }
      }
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
  if(!switchProbe){
    startSplash();
    // Start the native lookup now: do not wait for Kirka's page/overlay to load.
    // A slow/offline GitHub never blocks gameplay or the engine-switch handshake.
    if(nativeUpdatePreferences.automatic)
      checkKSUpdate(nativeUpdatePreferences.channel,true,nativeUpdatePreferences.autoDownload);
  }
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
  if(switchInProgress || target==='electron' || !Object.hasOwn(installedEngines,target))return;
  const root=path.resolve(__dirname,'..','..','..','..');
  const launcher=path.join(root,'KS-Client.exe');
  const targetExe=path.join(root,'runtime',...installedEngines[target]);
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
let packDialogOpen=false;
async function managePack(command,id){
  if(packDialogOpen)return;
  const owner=win;
  const reply=(message='')=>{
    if(win===owner&&!owner.isDestroyed()&&validURL(owner.webContents.getURL(),true))
      jsCall('setResourcePacks',{packs:SWAPPER.packs().list(),message});
  };
  packDialogOpen=true;
  try{
    const store=SWAPPER.packs();
    const filters=[{name:'KS resource pack',extensions:['json']}];
    if(command==='import'||command==='create'){
      const folder=command==='create';
      const chosen=await dialog.showOpenDialog(owner,{properties:[folder?'openDirectory':'openFile'],filters:folder?[]:filters});
      if(chosen.canceled)return;
      const file=chosen.filePaths[0];
      if(!folder&&(await fs.promises.stat(file)).size>17*1024*1024)throw Error('Pack exceeds 17 MiB');
      store.import(folder?SWAPPER.fromFolder(file,path.basename(file)):JSON.parse(await fs.promises.readFile(file,'utf8')));
    }else if(command==='export'){
      const doc=store.export(id);
      const target=await dialog.showSaveDialog(owner,{defaultPath:'KS-resource-pack.json',filters});
      if(target.canceled)return;
      await fs.promises.writeFile(target.filePath,JSON.stringify(doc));
    }else if(['first','toggle','remove'].includes(command))store.change(id,command);
    else if(command!=='list')return;
    reply();
  }catch(error){try{reply(String(error.message).slice(0,180));}catch{jsCall('setWorkshopStatus','Cannot read resource pack index');}}
  finally{packDialogOpen=false;}
}
function receiveMessage(event, raw){
  if(!win || event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame)return;
  const source=event.senderFrame.url;
  if(!validURL(source) || !raw || typeof raw!=='object' || Array.isArray(raw))return;
  let data=''; try{data=JSON.stringify(raw)}catch(_){return}
  if(data.length>8192 || typeof raw.type!=='string')return;
  const basic=new Set(['stats','clan','game','fullscreen','crash-status','diagnostics-poll','update-check','update-install','update-open-release','discord-community','auth-help']);
  if(!validURL(source,true)&&!basic.has(raw.type))return;
  switch(raw.type){
    case 'stats':navigate(STATS);break;
    case 'clan':navigate(CLANS);break;
    case 'game':navigate(GAME);break;
    case 'update-open-release':void shell.openExternal('https://github.com/epicjatekosok/KS-Client-Updates/releases').catch(e=>log('Public release page: '+e.message));break;
    case 'discord-community':openKSDiscord();break;
    case 'auth-help':jsCall('openAccountHelp');break;
    case 'fullscreen':win.setFullScreen(!win.isFullScreen());break;
    case 'game-buffer-ready':gameDisplay.bufferReady();break;
    case 'game-resolution':gameDisplay.select(String(raw.preset||'native'));break;
    case 'menu-resolution':setWindowSize(String(raw.preset||'native'));break;
    case 'engine-switch':switchEngine(raw.engine);break;
    case 'engine-info':jsCall('setEngineInfo','Electron');break;
    case 'update-config': {
      saveUpdatePreferences(raw);
      if(lastNativeUpdateStatus)emitUpdateStatus(lastNativeUpdateStatus);
      else if(!updateCheckInProgress && nativeUpdatePreferences.automatic && lastAutoUpdateCheck===0)
        checkKSUpdate(nativeUpdatePreferences.channel,true,nativeUpdatePreferences.autoDownload);
      break;
    }
    case 'update-check':checkKSUpdate(['alpha','beta','stable'].includes(raw.channel)?raw.channel:'beta',raw.automatic===true,raw.autoDownload===true);break;
    case 'update-install':void installKSUpdate(['alpha','beta','stable'].includes(raw.channel)?raw.channel:'beta',raw.language);break;
    case 'frame-policy':{
      if(typeof raw.enabled!=='boolean'||raw.enabled===fixedTarget)break;
      try{
        if(raw.enabled){fs.mkdirSync(ROOT,{recursive:true});fs.writeFileSync(fixedMarker,'1');}
        else fs.rmSync(fixedMarker,{force:true});
        fixedTarget=raw.enabled;browserConfig();
      }catch(e){browserConfig('Could not save frame policy: '+e.message);}
      break;
    }
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
        if(u.port||u.username||u.password||!validURL(u.toString(),true) || !/^\/(games\/|hub\/ranked|servers\/)/.test(u.pathname))throw Error('Invalid Kirka.io game link');
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
    case 'resource-packs':void managePack(raw.command,raw.id);break;
    case 'resource-save':{
      try{
        const enabled=SWAPPER.setEnabled(raw.enabled===true);
        jsCall('setWorkshopStatus',enabled?'Resource swaps enabled. Reload the game to apply.':'Resource swaps disabled.',raw.requestId);
      }catch{jsCall('setWorkshopStatus','Cannot save swapper configuration.',raw.requestId);}
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
      try{jsCall('setWorkshopStatus',SWAPPER.scan(),raw.requestId);}
      catch{jsCall('setWorkshopStatus','Swapper scan failed.',raw.requestId);}
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
  event.returnValue=(win&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&validURL(source,true))?earlyGameJS:'';
});
// Retain individual channels for backward-compatible diagnostics and tools.
ipcMain.on('ks:early-freeze',(event)=>{
  const source=event.senderFrame?.url||'';
  event.returnValue=(win&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&validURL(source,true))?freezeJS:'';
});
ipcMain.on('ks:early-graphics',(event)=>{
  const source=event.senderFrame?.url||'';
  event.returnValue=(win&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&validURL(source,true))?graphicsJS:'';
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
    if(isGame && (permission==='pointerLock'||permission==='fullscreen'))return true;
    // Grant Chromium's generic HTTPS storage-access permission without
    // assuming which third-party identity provider Kirka currently uses.
    // No domain list, password access, token relay or Google-specific rule.
    if(permission==='storage-access'||permission==='top-level-storage-access'){
      try{
        const u=new URL(origin||wc?.getURL?.()||'');
        return u.protocol==='https:' && !u.username && !u.password;
      }catch(_){return false;}
    }
    return false; // Camera, mic and other game-irrelevant capabilities stay denied.
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
