'use strict';
// Beta 1.0.8: simulate trusted in-client OAuth popup navigation without credentials.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'electron-app','main.cjs'),'utf8');
const cefAuth=fs.readFileSync(path.join(root,'cef','ClientAuthentication.cs'),'utf8');
const cefMain=fs.readFileSync(path.join(root,'cef','ClientForm.cs'),'utf8');
const cefPopup=fs.readFileSync(path.join(root,'cef','ClientCommunityLinks.cs'),'utf8');
const start=src.indexOf('const AUTH_HOSTS=');
const end=src.indexOf('function openKSDiscord(){',start);
assert(start>0 && end>start);
const reports=[];
const context={
  URL,Set,WeakSet,
  log:line=>reports.push(line),
  dialog:{showMessageBox:async()=>({response:1})},
  shell:{openExternal:async()=>{}},
  validURL:(raw,onlyGame=false)=>{
    try {
      const u=new URL(raw);
      return u.protocol==='https:'&&
        (onlyGame ? ['kirka.io','www.kirka.io'].includes(u.hostname) :
         ['kirka.io','www.kirka.io','kirka-stats.lovable.app'].includes(u.hostname));
    }catch{return false;}
  }
};
vm.runInNewContext(src.slice(start,end)+
  ';globalThis.authTest={check:validAuthURL,configure:configureAuthPopup,storage:allowOAuthStoragePermission,label:authLocationLabel};',context);
const {check,configure,storage,label}=context.authTest;
const gameContent={getURL:()=> 'https://kirka.io/'};
context.win={webContents:gameContent,isDestroyed:()=>false};
const popupEvents={},popup={on(){},webContents:{
  getURL:()=> 'https://accounts.google.com/signin/v2/identifier',
  setWindowOpenHandler(fn){this.handler=fn;},
  on(name,fn){popupEvents[name]=fn;}
},setMenu(){}};
configure(popup,1);
assert.equal(typeof popup.webContents.handler,'function');
assert.equal(typeof popupEvents['did-create-window'],'function');
const googleOption=popup.webContents.handler({
  url:'https://gsi.google.com/select?client_id=secret',
  referrer:{url:'https://accounts.google.com/'}
});
assert.equal(googleOption.action,'allow','Trusted Google provider popup remains in-client; Google policy may still reject it');
const options=popup.webContents.handler({
  url:'https://www.facebook.com/dialog/oauth',
  referrer:{url:'https://kirka.io/'}
});
assert.equal(options.action,'allow','Non-Google provider native opener should survive');
assert.equal(options.overrideBrowserWindowOptions.webPreferences.sandbox,true);
assert.equal(options.overrideBrowserWindowOptions.webPreferences.nodeIntegration,false);
assert.equal(options.overrideBrowserWindowOptions.webPreferences.webSecurity,true);
assert.equal(options.overrideBrowserWindowOptions.webPreferences.partition,undefined,
  'OAuth must use the same cookie session as Kirka');
assert.equal(popup.webContents.handler({url:'https://accounts.google.com.evil.org/'}).action,'deny');
assert.equal(popup.webContents.handler({url:'javascript:alert(1)'}).action,'deny');
assert.equal(popup.webContents.handler({url:'file:///C:/private.txt'}).action,'deny');
assert.equal(popup.webContents.handler({url:'about:blank'}).action,'allow');
const nestedEvents={},nested={on(){},webContents:{
  getURL:()=> 'https://gsi.google.com/select',
  setWindowOpenHandler(fn){this.handler=fn;},
  on(name,fn){nestedEvents[name]=fn;}
},setMenu(){}};
popupEvents['did-create-window'](nested);
assert.equal(nested.webContents.handler({
  url:'https://project-name.firebaseapp.com/__/auth/handler?state=secret'
}).action,'allow');
assert.equal(nested.webContents.handler({
  url:'https://accounts.google.com/o/oauth2/v2/auth'
}).action,'allow','Trusted late Google redirect should preserve the popup opener');
let blocked=false;
nestedEvents['will-redirect']({preventDefault(){blocked=true;}},
 'https://project-name.firebaseapp.com/__/auth/handler?state=private-token');
assert(!blocked,'Firebase callback navigation should complete');
nestedEvents['will-navigate']({preventDefault(){blocked=true;}},
 'https://kirka.io/');
assert(!blocked,'OAuth must be able to return to Kirka');
nestedEvents['will-navigate']({preventDefault(){blocked=true;}},'about:blank');
assert(!blocked,'Trusted non-Google OAuth popups may use about:blank transitions');
nestedEvents['will-redirect']({preventDefault(){blocked=true;}},
 'http://unsafe.example.test/credentials');
assert(blocked,'insecure redirect must remain blocked');
blocked=false;
const closePopup={closed:false,on(){},isDestroyed(){return this.closed;},close(){this.closed=true;}};
const lateEvents={};
closePopup.webContents={getURL:()=> 'about:blank',
  setWindowOpenHandler(){},on(name,fn){lateEvents[name]=fn;}};
closePopup.setMenu=()=>{};
configure(closePopup,2);
lateEvents['will-redirect']({preventDefault(){blocked=true;}},
 'https://accounts.google.com/o/oauth2/v2/auth?state=secret');
assert(!blocked && !closePopup.closed,'Safe Google redirect remains in native popup; no Chrome handoff');
assert(!label('https://accounts.google.com/signin?email=private@example.com&state=secret').includes('private@example.com'));
assert(!reports.join(' ').includes('private-token'), 'Never log OAuth secret parameters');
// Chromium Storage Access API is requested independently of permissionRequest.
assert(storage(popup.webContents,'storage-access','https://accounts.google.com/'));
assert(storage(popup.webContents,'storage-access','https://some-app.firebaseapp.com/__/auth/handler'));
assert(storage(gameContent,'top-level-storage-access','https://kirka.io/'));
assert(!storage(gameContent,'storage-access','https://evil.com/'));
assert(!storage(popup.webContents,'geolocation','https://accounts.google.com/'));
assert(!storage({getURL:()=> 'https://example.org/'},'storage-access','https://accounts.google.com/'));
assert(check('https://gsi.google.com/select'));
assert(check('https://accounts.youtube.com/'));
assert(check('https://login.kirka.io/__/auth/handler'));
assert(check('https://some-app.web.app/__/auth/handler'));
assert(!check('https://notkirka.io/'));
assert(!check('https://some-app.web.app:8443/'));
for(const file of [cefAuth,cefMain,cefPopup]){
  assert(file.includes('ClientAuthentication')||file.includes('OAuth'), 'CEF OAuth integration missing');
}
assert(cefMain.includes('ClientAuthentication.IsAllowed(request.Url,allowBlank:true)'));
assert(cefAuth.includes('gsi.google.com')&&cefAuth.includes('.web.app'));
assert(cefPopup.includes('noJavascriptAccess=false'));
assert(src.includes('session.defaultSession.setPermissionRequestHandler'));
assert(src.includes('session.defaultSession.setPermissionCheckHandler'));
console.log('PASS: Beta 1.0.8 native OAuth popups, Firebase callback, scoped storage, no external game and sanitized logs');
