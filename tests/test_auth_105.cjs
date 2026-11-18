'use strict';
// Current regressions for the original Beta 1.0.5 login flow and the
// Beta 1.0.8 correction: never force Kirka sign-in to open a second game
// in Chrome. Login popups remain scoped to HTTPS allowlisted providers.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const electron=fs.readFileSync(path.join(root,'electron-app/main.cjs'),'utf8');
const cefAuth=fs.readFileSync(path.join(root,'cef/ClientAuthentication.cs'),'utf8');
const cefForm=fs.readFileSync(path.join(root,'cef/ClientForm.cs'),'utf8');
const cefPopup=fs.readFileSync(path.join(root,'cef/ClientCommunityLinks.cs'),'utf8');
const overlay=fs.readFileSync(path.join(root,'electron-app/overlay/overlay.js'),'utf8');
const cefOverlay=fs.readFileSync(path.join(root,'cef/overlay/overlay.js'),'utf8');
const release=fs.readFileSync(path.join(root,'RELEASE_BETA_108_EN.md'),'utf8');
const start=electron.indexOf('const AUTH_HOSTS=');
const end=electron.indexOf('function openKSDiscord(){',start);
assert(start>=0&&end>start);
const reports=[];
const context={
 URL,Set,WeakSet,
 log:v=>reports.push(v),
 validURL:(raw,onlyGame=false)=>{
   try{const u=new URL(raw);return u.protocol==='https:'&&
    (onlyGame?['kirka.io','www.kirka.io'].includes(u.hostname):
    ['kirka.io','www.kirka.io','kirka-stats.lovable.app'].includes(u.hostname));}
   catch{return false;}
 }
};
vm.runInNewContext(electron.slice(start,end)+
 ';globalThis.auth={checkGoogle:isGoogleSignInURL,configure:configureAuthPopup};',context);
for(const h of ['accounts.google.com','gsi.google.com','consent.google.com','accounts.youtube.com'])
 assert(context.auth.checkGoogle('https://'+h+'/signin?secret=redacted'));
for(const target of ['https://accounts.google.com.evil.example/','http://accounts.google.com/',
 'https://accounts.google.com:8443/','https://facebook.com/login','javascript:alert(1)'])
 assert(!context.auth.checkGoogle(target),target);
const events={};
const popup={setMenu(){},on(){},webContents:{
 getURL:()=> 'https://kirka.io/',
 setWindowOpenHandler(fn){this.handler=fn;},on:(name,fn)=>{events[name]=fn;}
}};
context.auth.configure(popup,1);
assert.equal(popup.webContents.handler({
 url:'https://accounts.google.com/o/oauth2/v2/auth?state=SECRET'
}).action,'allow','An allowlisted provider popup stays inside the native Kirka host');
assert.equal(popup.webContents.handler({
 url:'https://www.facebook.com/dialog/oauth'
}).action,'allow','Other native login popups must remain');
assert.equal(popup.webContents.handler({url:'https://example.org/'}).action,'deny');
assert.equal(popup.webContents.handler({url:'file:///C:/secret.txt'}).action,'deny');
assert.equal(popup.webContents.handler({url:'javascript:alert(1)'}).action,'deny');
let prevented=false;
events['will-redirect']({preventDefault(){prevented=true;}},
 'https://accounts.google.com/signin?state=SECRET');
assert(!prevented,'A safe provider redirect must not be discarded');
events['will-redirect']({preventDefault(){prevented=true;}},
 'http://example.org/insecure');
assert(prevented,'HTTP redirect must remain blocked');
assert(!reports.join(' ').includes('SECRET'),'Never log authorization codes/params');
assert(!electron.includes('offerSystemBrowserSignIn'));
assert(!electron.includes('shell.openExternal(GAME)'));
assert(!cefForm.includes('OfferSystemBrowserSignIn'));
assert(!cefPopup.includes('OpenGameSignIn'));
assert(!cefPopup.includes('requestGoogleHelp'));
assert(cefPopup.includes('ClientAuthentication.IsAllowed(targetUrl,allowBlank:userGesture)'));
assert(cefPopup.includes('noJavascriptAccess=false'));
assert(cefForm.includes('ClientAuthentication.IsAllowed(request.Url,allowBlank:true)'));
assert(cefForm.includes('case "auth-help"'));
assert(cefAuth.includes('internal static bool IsGoogleSignIn'));
assert(overlay.includes('openAccountHelp:'));
assert(!overlay.includes('data-action="auth-open-browser"'));
assert(overlay.includes('data-action="auth-import-session"'));
assert(overlay===cefOverlay,'Identical native-account settings in CEF and Electron');
assert(release.includes('Google OAuth')&&release.includes('not spoof'));
console.log('PASS: Beta 1.0.8 in-client popup redirects, blocked unsafe navigation, preserved manual account tools and no Chrome game handoff');
