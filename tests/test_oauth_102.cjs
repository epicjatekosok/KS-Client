'use strict';
// Beta 1.0.2: simulate the final browser-side OAuth handoff without credentials.
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
context.win={webContents:gameContent};
const popupEvents={},popup={webContents:{
  getURL:()=> 'https://accounts.google.com/signin/v2/identifier',
  setWindowOpenHandler(fn){this.handler=fn;},
  on(name,fn){popupEvents[name]=fn;}
},setMenu(){}};
configure(popup,1);
assert.equal(typeof popup.webContents.handler,'function');
assert.equal(typeof popupEvents['did-create-window'],'function');
const options=popup.webContents.handler({
  url:'https://gsi.google.com/select?client_id=secret',
  referrer:{url:'https://accounts.google.com/'}
});
assert.equal(options.action,'allow');
assert.equal(options.overrideBrowserWindowOptions.webPreferences.sandbox,true);
assert.equal(options.overrideBrowserWindowOptions.webPreferences.nodeIntegration,false);
assert.equal(options.overrideBrowserWindowOptions.webPreferences.webSecurity,true);
assert.equal(options.overrideBrowserWindowOptions.webPreferences.partition,undefined,
  'OAuth must use the same cookie session as Kirka');
assert.equal(popup.webContents.handler({url:'https://accounts.google.com.evil.org/'}).action,'deny');
assert.equal(popup.webContents.handler({url:'javascript:alert(1)'}).action,'deny');
assert.equal(popup.webContents.handler({url:'file:///C:/private.txt'}).action,'deny');
assert.equal(popup.webContents.handler({url:'about:blank'}).action,'allow');
const nestedEvents={},nested={webContents:{
  getURL:()=> 'https://gsi.google.com/select',
  setWindowOpenHandler(fn){this.handler=fn;},
  on(name,fn){nestedEvents[name]=fn;}
},setMenu(){}};
popupEvents['did-create-window'](nested);
assert.equal(nested.webContents.handler({
  url:'https://project-name.firebaseapp.com/__/auth/handler?state=secret'
}).action,'allow');
let blocked=false;
nestedEvents['will-redirect']({preventDefault(){blocked=true;}},
 'https://project-name.firebaseapp.com/__/auth/handler?state=private-token');
assert(!blocked,'Firebase callback navigation should complete');
nestedEvents['will-navigate']({preventDefault(){blocked=true;}},
 'https://kirka.io/');
assert(!blocked,'OAuth must be able to return to Kirka');
nestedEvents['will-redirect']({preventDefault(){blocked=true;}},
 'http://unsafe.example.test/credentials');
assert(blocked,'insecure redirect must remain blocked');
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
console.log('PASS: Beta 1.0.2 Google account choice, nested OAuth handoff, Firebase callback, scoped storage and safe logs');
