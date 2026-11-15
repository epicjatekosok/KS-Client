'use strict';
// KS Client alpha 1.1.10: real Electron host. No WebView2 dependency.
const { app, BrowserWindow, ipcMain, screen, dialog, session } = require('electron');
const {spawn}=require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const APP_VERSION = 'alpha 1.1.10';
const GAME = 'https://kirka.io/';
const STATS = 'https://kirka-stats.lovable.app/';
const CLANS = 'https://kirka-clan-tracker-notpro9.lovable.app/';
const ALLOWED = new Set(['kirka.io','www.kirka.io','kirka-stats.lovable.app','kirka-clan-tracker-notpro9.lovable.app']);
const GAME_HOSTS = new Set(['kirka.io','www.kirka.io']);
const ROOT = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local'), 'KSClient');
const PROFILE = path.join(ROOT,'ElectronProfile');
const PREFS_FILE = path.join(ROOT, 'browser-settings.json');
const LOG_FILE = path.join(ROOT, 'electron-1.1.10.log');
fs.mkdirSync(ROOT,{recursive:true});
fs.mkdirSync(PROFILE,{recursive:true});
app.setPath('userData', PROFILE);
const overlayJS = fs.readFileSync(path.join(__dirname,'overlay','overlay.js'),'utf8');
const frameJS = fs.readFileSync(path.join(__dirname,'overlay','frame_pacer.js'),'utf8');
const DEFAULT_PREFS = Object.freeze({gpu:'enabled',angle:'default',devTools:false,contextMenu:false,uncapFps:false});
function validURL(value, gameOnly=false) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && (gameOnly ? GAME_HOSTS : ALLOWED).has(u.hostname);
  } catch (_) { return false; }
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
  // Safety: game content has no Node.js access. No arbitrary file:// or custom URLs.
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,target)=>{if(!validURL(target)){event.preventDefault();log('Blocked navigation outside client allowlist')}});
  win.webContents.on('context-menu',(event)=>{if(!desired.contextMenu)event.preventDefault()});
  win.webContents.on('dom-ready',async()=>{
    if(switchProbe)return;
    if(!validURL(win.webContents.getURL()))return;
    // Frame pacer is also installed at document start by preload where possible.
    // The overlay runs after the page DOM exists, retaining its 1.0.11 settings UI.
    try{
      await win.webContents.executeJavaScript(frameJS,true);
      await win.webContents.executeJavaScript(overlayJS,true);
      jsCall('setEngineInfo','Electron');
      browserConfig();
    }catch(e){log('Overlay: '+e.message)}
    setGameResolution(gameResolution);
  });
  win.webContents.on('render-process-gone',(e,d)=>log('Renderer gone: '+d.reason));
  win.on('closed',()=>{win=null});
  installShortcuts();
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
  const basic=new Set(['stats','clan','game','fullscreen','crash-status','diagnostics-poll']);
  if(!validURL(source,true)&&!basic.has(raw.type))return;
  switch(raw.type){
    case 'stats':navigate(STATS);break;
    case 'clan':navigate(CLANS);break;
    case 'game':navigate(GAME);break;
    case 'fullscreen':win.setFullScreen(!win.isFullScreen());break;
    case 'game-resolution':setGameResolution(String(raw.preset||'native'));break;
    case 'menu-resolution':setWindowSize(String(raw.preset||'native'));break;
    case 'engine-info':jsCall('setEngineInfo','Electron');break;
    case 'engine-switch':{
      if(raw.engine==='cef')switchEngine('cef');
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
      const bytes=process.memoryUsage().rss;
      jsCall('setDiagnostics',{browserRAM:Math.round(bytes/1048576),note:'Electron host process RAM only',gpuAcceleration:active.gpu,engine:'Electron',platform:'Windows'});
      break;
    }
    case 'crash-status':jsCall('setCrashStatus','Electron log: '+LOG_FILE);break;
    case 'open-logs':require('electron').shell.openPath(ROOT);break;
    case 'client-error':log('Overlay warning: '+String(raw.message||'').slice(0,240));break;
  }
}
ipcMain.on('ks:message',receiveMessage);
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
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>{
    const origin=contents.getURL();
    callback(validURL(origin,true) && (permission==='pointerLock'||permission==='fullscreen'));
  });
  log('FPS startup flags: '+JSON.stringify({
    requested:active.uncapFps,
    frameRateLimitSwitch:app.commandLine.hasSwitch('disable-frame-rate-limit'),
    gpuVsyncSwitch:app.commandLine.hasSwitch('disable-gpu-vsync')
  }));
  createWindow();
}).catch(e=>{log(e.stack||e);dialog.showErrorBox('KS Client Electron',String(e.message||e));app.exit(1)});
app.on('window-all-closed',()=>app.quit());
