'use strict';
// Regression for Beta 1.0.9 revision 2: no fake dialog on Kirka-initiated
// account-picker navigation. Never weaken the engine sandbox or URL allowlist.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'electron-app/main.cjs'),'utf8');
const cef=fs.readFileSync(path.join(root,'cef/ClientForm.cs'),'utf8');
const popup=fs.readFileSync(path.join(root,'cef/ClientCommunityLinks.cs'),'utf8');
const auth=fs.readFileSync(path.join(root,'cef/ClientAuthentication.cs'),'utf8');
const prefix=src.slice(src.indexOf('const AUTH_HOSTS='),src.indexOf('const authContents=new WeakSet();',src.indexOf('const AUTH_HOSTS=')));
const start=src.indexOf('  const guardMainNavigation=(event,target)=>{');
const end=src.indexOf("  win.webContents.on('will-navigate',guardMainNavigation);",start);
assert(start>=0&&end>start&&prefix.includes('function validAuthURL'));
const notices=[];
let current='https://kirka.io/';
const ctx={
 URL,Set,
 validURL:(raw,onlyGame=false)=>{
   try{const u=new URL(raw);return u.protocol==='https:'&&
     (onlyGame?['kirka.io','www.kirka.io'].includes(u.hostname):
     ['kirka.io','www.kirka.io','kirka-stats.lovable.app'].includes(u.hostname));}
   catch{return false;}
 },
 win:{webContents:{getURL:()=>current}},
 log:v=>notices.push(v),
 jsCall:()=>{throw new Error('Main-frame Google navigation must not open Settings or help')},
 isGameDiscordTarget:()=>false,
 openKSDiscord:()=>{}
};
vm.runInNewContext(prefix+'\n'+src.slice(start,end)+'\nglobalThis.checkNav=guardMainNavigation;',ctx);
function allows(to,from='https://kirka.io/'){
 current=from;let prevented=false;
 ctx.checkNav({preventDefault(){prevented=true;}},to);
 return !prevented;
}
assert(allows('https://accounts.google.com/o/oauth2/v2/auth?state=secret'),'Kirka Google account picker must open');
assert.equal(ctx.win.webContents.__ksKirkaAuthChain,true,'Track Kirka-started provider main navigation');
assert(allows('https://gsi.google.com/select'),'Google picker navigation should proceed');
assert(allows('https://kirka.io/','https://accounts.google.com/signin'),'Kirka callback must be possible');
assert.equal(ctx.win.webContents.__ksKirkaAuthChain,false,'Returning to Kirka clears the provider navigation trust');
assert(allows('https://some-game.firebaseapp.com/__/auth/handler','https://accounts.google.com/signin'),'Firebase callback must survive');
assert(allows('https://www.facebook.com/dialog/oauth'),'Other identity provider must stay usable');
assert(!allows('https://accounts.google.com.evil.example/'),'Reject lookalike domain');
assert(!allows('http://accounts.google.com/'),'Reject HTTP credential page');
assert(!allows('javascript:alert(1)'),'Reject javascript navigation');
assert(!allows('file:///C:/Users/Passwords.txt'),'Reject local file');
assert(!allows('https://accounts.google.com/','https://unsafe.example/'),'Reject untrusted origin');
assert(!notices.join(' ').includes('secret'),'Do not log OAuth code or state');
assert(!src.includes('Google main-frame navigation intercepted'),'No Google hijack in Electron');
assert(!cef.includes('Google main-frame login request would replace the game'));
assert(!cef.includes('requestGoogleHelp();\n           return true;'));
assert(cef.includes('ClientAuthentication.IsAllowed(request.Url)'),'CEF must allow trusted provider navigation');
assert(cef.includes('ClientForm.Trust(frame.Url,gameOnly:true)'),'CEF must require trusted game source');
assert(popup.includes('ClientAuthentication.IsAllowed(targetUrl,allowBlank:userGesture)'),'CEF popup allowlist retained');
assert(auth.includes('GoogleHosts'),'CEF exact Google allowlist remains');
assert(src.includes('webSecurity:true')&&src.includes('nodeIntegration:false')&&src.includes('sandbox:true'),'Keep Chromium security protections unlike Dawn');
assert(!src.includes('webSecurity:false'));
console.log('PASS Beta 1.0.9 hotfix: secure Kirka email/Google navigation, callback and popup continuity, no Settings hijack');
