'use strict';
// Regression: a KS Discord community invitation is not a Kirka Discord login.
// Neither engine should steal clicks on the game's auth dialog.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const electron=fs.readFileSync(path.join(root,'electron-app/main.cjs'),'utf8');
const cef=fs.readFileSync(path.join(root,'cef/ClientCommunityLinks.cs'),'utf8');
const js=fs.readFileSync(path.join(root,'electron-app/overlay/overlay.js'),'utf8');
const cefJS=fs.readFileSync(path.join(root,'cef/overlay/overlay.js'),'utf8');
assert.equal(js,cefJS,'CEF and Electron account UI must remain identical');
const from=electron.indexOf('function isGameDiscordTarget(raw) {');
const until=electron.indexOf("// Kirka's account login uses",from);
assert(from>0 && until>from);
const context={URL};
vm.runInNewContext(electron.slice(from,until)+';globalThis.isCommunity=isGameDiscordTarget;',context);
const community=context.isCommunity;
assert(community('https://discord.gg/cxP386yGjk'));
assert(community('https://discord.com/invite/cxP386yGjk'));
assert(community('https://discord.com/channels/123/456'));
for(const url of ['https://discord.com/oauth2/authorize?client_id=123',
 'https://discord.com/login','https://www.discord.com/api/oauth2/authorize',
 'https://discord.gg/','https://discord.com.evil.example/invite/test',
 'http://discord.gg/cxP386yGjk','javascript:alert(1)','file:///tmp/private']) {
 assert(!community(url),'A login or unsafe URL must never become a community invite: '+url);
}
assert(cef.includes('path.StartsWith("/invite/"') && cef.includes('path.StartsWith("/channels/"'));
assert(cef.includes('if(host=="discord.gg")'));
assert(cef.includes('ClientCommunityLinks.IsDiscordTarget(targetUrl)'));
const begin=js.indexOf('  function isKirkaDiscordButton(element) {');
const end=js.indexOf('  if(isGamePage)document.addEventListener',begin);
assert(begin>0 && end>begin);
const ctx={URL,location:{href:'https://kirka.io/'},host:{contains:()=>false}};
vm.runInNewContext(js.slice(begin,end)+';globalThis.checkButton=isKirkaDiscordButton;',ctx);
function element({href='',text='Discord',login=false}={}) {
 const control={
  getAttribute(name){return name==='href'?href:'';},
  id:'',className:'',textContent:text,
  closest(selector){
   if(selector.startsWith('#auth-modal-modal'))return login?control:null;
   return null;
  }
 };
 return {closest(selector){return selector.startsWith('a,button')?control:null;}};
}
assert(!ctx.checkButton(element({text:'DISCORD',login:true})),
 'Kirka account modal Discord button must not be intercepted');
assert(!ctx.checkButton(element({href:'https://discord.com/oauth2/authorize',login:true})));
assert(!ctx.checkButton(element({text:'Google',login:true})));
assert(ctx.checkButton(element({href:'https://discord.gg/cxP386yGjk'})),
 'The original KS community shortcut remains available');
assert(!ctx.checkButton(element({href:'https://discord.com/oauth2/authorize'})));
assert(electron.includes('webSecurity:true') && electron.includes('nodeIntegration:false') && electron.includes('sandbox:true'));
assert(!electron.includes('webSecurity:false'));
assert(js.includes("{v:'Beta 1.0.10'") && js.includes("{v:'Beta 1.0.9'"),
 'Beta 1.0.9 release history must not be lost');
assert(electron.includes("win.webContents.on('will-navigate',guardMainNavigation)"),
 'Game and trusted Google callback routing must stay in place');
// Reproduce a Kirka-initiated Google main-frame account chooser: the account
// page can request its OWN trusted secondary popup after the main-frame origin
// is no longer kirka.io. Uninitiated provider windows must remain denied.
const popupBegin=electron.indexOf("  win.webContents.setWindowOpenHandler(({url,referrer})=>{");
const popupEnd=electron.indexOf("  win.webContents.on('did-create-window'",popupBegin);
assert(popupBegin>0 && popupEnd>popupBegin);
let currentURL='https://accounts.google.com/signin';
const content={__ksKirkaAuthChain:false,getURL:()=>currentURL,
 setWindowOpenHandler(fn){this.popupHandler=fn;}};
const popupCtx={
 win:{webContents:content},URL,
 validURL:raw=>{try{return new URL(raw).hostname==='kirka.io';}catch{return false;}},
 validAuthURL:raw=>{try{return ['accounts.google.com','gsi.google.com'].includes(new URL(raw).hostname) && new URL(raw).protocol==='https:';}catch{return false;}},
 isGameDiscordTarget:community,isGoogleSignInURL:()=>false,
 openKSDiscord:()=>{},authPopupOptions:()=>({}),log:()=>{}
};
vm.runInNewContext(electron.slice(popupBegin,popupEnd),popupCtx);
assert.equal(content.popupHandler({url:'https://gsi.google.com/select'}).action,'deny',
 'Uninitiated Google popups must not be trusted');
content.__ksKirkaAuthChain=true;
assert.equal(content.popupHandler({url:'https://gsi.google.com/select'}).action,'allow',
 'Trusted Kirka-started Google account picker must be allowed to spawn its provider popup');
assert.equal(content.popupHandler({url:'https://evil.example/'}).action,'deny',
 'Trusted Google chain must not enable arbitrary popups');
currentURL='https://evil.example/';
assert.equal(content.popupHandler({url:'https://accounts.google.com/'}).action,'deny',
 'A forged unrelated provider source must remain denied');
const cefMain=fs.readFileSync(path.join(root,'cef/ClientForm.cs'),'utf8');
const cefAuth=fs.readFileSync(path.join(root,'cef/ClientAuthentication.cs'),'utf8');
assert(cefMain.includes('ClientAuthentication.SetMainFrameAuthChain(browser,true)'));
assert(cefMain.includes('ClientAuthentication.SetMainFrameAuthChain(browser,false)'));
assert(cefAuth.includes('ConcurrentDictionary<int, byte> MainFrameAuthChains'));
assert(cef.includes('ClientAuthentication.HasMainFrameAuthChain(browser)'),
 'CEF must permit provider popups only for a Kirka-started main-frame chain');

console.log('PASS Beta 1.0.10: Discord community shortcuts cannot hijack Kirka OAuth; existing browser protections and history preserved');
