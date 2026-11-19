'use strict';
// v1.0.12: Kirka owns login provider routing; default Chromium owns popups.
// Do not regress into silently dropping Google/email/Discord account clicks.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const electron=read('electron-app/main.cjs');
const cef=read('cef/ClientForm.cs');
const links=read('cef/ClientCommunityLinks.cs');
const overlay=read('electron-app/overlay/overlay.js');
assert.equal(overlay,read('cef/overlay/overlay.js'),'Both engines must retain the same settings/HUD');
assert(!fs.existsSync(path.join(root,'cef/ClientAuthentication.cs')),
 'Obsolete CEF OAuth/domain allowlist must be removed');
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
assert(!gameSetup.includes('did-create-window'),'Do not attach native OAuth popup wrappers');
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
assert(!cef.includes('browser.LifeSpanHandler ='), 'CEF must use native popup lifecycle');
assert(!cef.includes('ClientCommunityPopupHandler'),'No custom CEF OAuth popup management');
assert(!cef.includes('ClientAuthentication'),'No provider domain filtering in CEF');
assert(!cef.includes('authMainFrameNavigation'),'No CEF provider navigation chain');
const req=cef.slice(cef.indexOf('internal sealed class ClientRequestHandler'),
  cef.indexOf('internal sealed class ClientGamePermissionHandler'));
assert(req.includes('return false;'),'Native Chromium HTTPS navigation must proceed');
assert(req.includes('KSResourceSwap.Match('),'Preserve the resource swapper');
assert(req.includes('__ksclient_internal_switch_electron__'),'Preserve engine switch');
assert(req.includes('ClientCommunityLinks.IsDiscordTarget(request.Url)'),
  'Preserve explicit community-invite routing');
assert(!req.includes('accounts.google.com') && !req.includes('.firebaseapp.com'),
 'No provider hostname rules in CEF');
assert(!links.includes('OnBeforePopup') && !links.includes('noJavascriptAccess'),
 'Remove custom CEF popup opener configuration');
assert(overlay.includes('ks-workshop-experimental'),'Keep Workshop Experimental');
assert(overlay.includes("openAccountHelp: showAccountHelpDialog"),
 'Leave optional manual local-session recovery accessible, but not on provider click');
console.log('PASS Beta 1.0.12: Redline-like native Electron/CEF sign-in, no KS OAuth/window handlers, safety and existing game features retained');
