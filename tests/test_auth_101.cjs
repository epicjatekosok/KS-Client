'use strict';
// Offline test: validate OAuth popup targets without launching an IdP or browser.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const electron=fs.readFileSync(path.join(root,'electron-app/main.cjs'),'utf8');
const cefPopup=fs.readFileSync(path.join(root,'cef/ClientCommunityLinks.cs'),'utf8');
const cefNavigation=fs.readFileSync(path.join(root,'cef/ClientForm.cs'),'utf8');
const cefAuth=fs.readFileSync(path.join(root,'cef/ClientAuthentication.cs'),'utf8');
const start=electron.indexOf('const AUTH_HOSTS=');
const end=electron.indexOf('function openKSDiscord(){',start);
assert(start>0 && end>start);
const context={URL,Set,log:()=>{},validURL:raw=>/^https:\/\/(www\.)?kirka\.io\//.test(raw)};
vm.runInNewContext(electron.slice(start,end)+';globalThis.check=validAuthURL;',context);
const check=context.check;
for(const url of [
 'https://kirka.io/login','https://accounts.google.com/o/oauth2/v2/auth',
 'https://www.facebook.com/dialog/oauth','https://appleid.apple.com/auth/authorize',
 'https://my-game.firebaseapp.com/__/auth/handler','https://tenant.auth0.com/authorize',
 'https://github.com/login/oauth/authorize'
])assert(check(url),url);
assert(check('about:blank',true));
for(const url of ['about:blank','javascript:alert(1)','file:///C:/secrets',
  'http://accounts.google.com/login','https://accounts.google.com.evil.test/',
  'https://example.org/','https://facebook.com:444/'])assert(!check(url),url);
assert(electron.includes("win.webContents.on('did-create-window',child=>configureAuthPopup(child))"));
assert(electron.includes("win.webContents.on('will-navigate',guardMainNavigation)"));
assert(electron.includes("content.on('will-redirect',validate)"));
assert(electron.includes("webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true"));
assert(cefPopup.includes('noJavascriptAccess=false'));
assert(cefPopup.includes('ClientAuthentication.IsAllowed(targetUrl,allowBlank:userGesture)'));
assert(cefNavigation.includes('if(browser.IsPopup)') && cefNavigation.includes('ClientAuthentication.IsAllowed(request.Url,allowBlank:true)'));
assert(electron.includes('allowOAuthStoragePermission') && electron.includes('authContents=new WeakSet()'));
assert(electron.includes('content.on(\'did-create-window\',nested=>configureAuthPopup(nested,depth+1))'));
assert(cefAuth.includes('uri.Port!=443') && cefAuth.includes('uri.UserInfo.Length!=0'));
console.log('PASS: OAuth allowlist includes common providers; untrusted/unsafe URLs and navigation remain blocked');
