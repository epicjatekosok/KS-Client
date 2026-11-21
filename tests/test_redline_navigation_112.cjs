'use strict';
// v1.0.12: Kirka owns login provider routing; default Chromium owns popups.
// Do not regress into silently dropping Google/email/Discord account clicks.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const electron=read('electron-app/main.cjs');
const overlay=read('electron-app/overlay/overlay.js');
for(const s of ['AUTH_HOSTS','AUTH_SUFFIXES','GOOGLE_ACCOUNT_HOSTS','validAuthURL',
  'configureAuthPopup','authPopupOptions','allowOAuthStoragePermission',
  'guardMainNavigation','__ksKirkaAuthChain','authContents=new WeakSet()'])
  assert(!electron.includes(s), 'Legacy Electron OAuth routing remains: '+s);
const gameStart=electron.indexOf('function createWindow(){');
const gameEnd=electron.indexOf("win.webContents.on('dom-ready',async()=>{",gameStart);
assert(gameStart>0 && gameEnd>gameStart);
const gameSetup=electron.slice(gameStart,gameEnd);
assert(!gameSetup.includes('setWindowOpenHandler('),'Kirka game popup must not have a KS handler');
assert(!gameSetup.includes("on('will-navigate'"),'No game navigation interception');
assert(!gameSetup.includes("on('will-redirect'"),'No provider redirect interception');
assert(!/webContents\.on\(['"]did-create-window/.test(gameSetup),'Do not attach native OAuth popup wrappers');
assert(gameSetup.includes('webSecurity:true')&&gameSetup.includes('sandbox:true')
  &&gameSetup.includes('nodeIntegration:false')&&gameSetup.includes('contextIsolation:true'),
  'Keep current safe Electron renderer options');
assert(electron.includes("splash.webContents.setWindowOpenHandler(()=>({action:'deny'}))"),
 'Offline startup HTML remains isolated from arbitrary popups');
assert(electron.includes('if(permission===\'storage-access\'||permission===\'top-level-storage-access\')'),
 'Generic HTTPS storage access is available without listing OAuth domains');
assert(electron.includes("permission==='pointerLock'"),'FPS game input must remain supported');
assert(electron.includes("case 'discord-community':openKSDiscord();break;"),
 'Native KS Discord shortcut remains functional');
assert(electron.includes('await win.webContents.executeJavaScript(nativeLoginGateJS,true)'),
 'Keep native Kirka login passthrough on unauthenticated pages');
assert(overlay.includes('ks-workshop-experimental'),'Keep Workshop Experimental');
assert(overlay.includes("openAccountHelp: showAccountHelpDialog"),
 'Leave optional manual local-session recovery accessible, but not on provider click');
console.log('PASS Beta 1.0.12: Redline-like native Electron/CEF sign-in, no KS OAuth/window handlers, safety and existing game features retained');
