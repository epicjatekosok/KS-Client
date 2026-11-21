'use strict';
// Beta 1.0.20: verify dynamic labels, non-racing CEF JS replies, native link
// commands, and the stable Electron authentication/browser path.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ui=read('electron-app/overlay/overlay.js');
const cefUI=read('cef/overlay/overlay.js');
const cef=read('cef/ClientForm.cs');
const links=read('cef/ClientCommunityLinks.cs');
const electron=read('electron-app/main.cjs');
assert.equal(ui,cefUI,'CEF/Electron settings stay identical');
assert(ui.includes("const CLIENT_VERSION='1.0.20'"));
assert(ui.includes("const CLIENT_LABEL='Beta '+CLIENT_VERSION"));
assert(ui.includes("KS Client '+esc(CLIENT_LABEL)"),'Installed version derives from build');
assert(ui.includes('KS CLIENT <span>${esc(CLIENT_LABEL.toUpperCase())}</span>'),
 'Sidebar version derives from the same build');
assert(!ui.includes('KS CLIENT <span>BETA 1.0.9</span>'));
assert(!ui.includes('<div class="ks-desc">KS Client Beta 1.0.5</div>'));
assert(ui.includes('CEF · Higher FPS (experimental)'));
assert(ui.includes('Electron · Stable'));
assert(ui.includes('Actual FPS depends on your PC and game settings'));
assert(ui.includes('ks-workshop-experimental'),'Keep Workshop');
assert(ui.includes("v:'Beta 1.0.13'") && ui.includes("v:'Beta 1.0.12'"),'Do not erase historical release notes');

const a=ui.indexOf('  function openTrustedExternal(kind) {');
const b=ui.indexOf('  // Beta 1.0.6:',a);
assert(a>0&&b>a);
const cases=[
  {native:false,kind:'discord',url:'https://kirka.io/__ksclient_internal_open_discord__'},
  {native:false,kind:'releases',url:'https://kirka.io/__ksclient_internal_open_releases__'}
];
for(const item of cases){
 const calls=[],notices=[];
 const context={isGamePage:true,window:{CefSharp:{PostMessage(){}}},location:{assign:u=>calls.push(u)},notify:type=>{notices.push(type);return true}};
 vm.runInNewContext(ui.slice(a,b)+';globalThis.openTest=openTrustedExternal;',context);
 assert.equal(context.openTest(item.kind),true);
 assert.deepEqual(calls,[item.url],'CEF action uses one fixed intercepted URL');
 assert.deepEqual(notices,[],'CEF must not depend on PostMessage for external action');
}
const sent=[];
const electronCtx={isGamePage:true,window:{__KS_NATIVE__:{post(){}},CefSharp:{}},
 location:{assign(){throw Error('Electron must not navigate away from game')}},
 notify:type=>{sent.push(type);return true}};
vm.runInNewContext(ui.slice(a,b)+';globalThis.openTest=openTrustedExternal;',electronCtx);
assert.equal(electronCtx.openTest('discord'),true);
assert.equal(electronCtx.openTest('releases'),true);
assert.deepEqual(sent,['discord-community','update-open-release'],
 'Electron existing native browser IPC is unchanged');
assert(ui.includes("if (a === 'update-open-release') openTrustedExternal('releases');"));
assert(ui.includes("if(!openTrustedExternal('discord'))"));

assert(cef.includes('if(IsDisposed || Disposing || !browser.IsBrowserInitialized || browser.IsDisposed)'));
assert(cef.includes('var native=browser.GetBrowser();'));
assert(cef.includes('if(native is null || native.IsDisposed)return;'));
assert(cef.includes('var frame=native.MainFrame;'));
assert(cef.includes('if(frame is null || !frame.IsValid)return;'));
assert(cef.includes('catch(ObjectDisposedException)')&&cef.includes('catch(InvalidOperationException ex)'));
assert(cef.includes('frame.ExecuteJavaScriptAsync(code);'));
assert(!cef.includes('if(Trust(browser.Address))browser.ExecuteScriptAsync(code);'),
 'Unsafe CefSharp wrapper that throws IBrowser null must be removed');
for(const suffix of ['open_discord','open_releases']){
 assert(cef.includes('__ksclient_internal_'+suffix+'__'),'Native CEF handler missing '+suffix);
}
assert(cef.includes('if(trusted)_=Task.Run(()=>ClientCommunityLinks.OpenPublicReleases());'));
assert(cef.includes('if(trusted)_=Task.Run(()=>ClientCommunityLinks.OpenInvite());'));
assert(cef.includes('return true;'),'Native commands intercepted and never sent to Kirka');
assert(links.includes('UseShellExecute=true'));
assert(links.includes('OpenFixedHttps(') && links.includes('OpenPublicReleases()'));
assert(links.includes('https://github.com/epicjatekosok/KS-Client-Updates/releases'));
assert(links.includes('https://discord.gg/cxP386yGjk'));
assert(electron.includes('sandbox:true')&&electron.includes('webSecurity:true'));
assert(!electron.includes('validAuthURL')&&!electron.includes('guardMainNavigation'),
 'Do not reintroduce old Google/OAuth restrictions');
assert(electron.includes("case 'update-open-release':void shell.openExternal("),
 'Electron working URL opener unchanged');
console.log('PASS Beta 1.0.20: current version UI, CEF IBrowser lifecycle, native Discord/release links and Electron unchanged');
