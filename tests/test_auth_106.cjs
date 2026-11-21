'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'electron-app/overlay/overlay.js'),'utf8');
assert(source.includes('data-action="auth-import-session"'),'Missing account import control');
assert(source.includes('type="password" maxlength="8192"'),'Session input must be masked and bounded');
assert(source.includes("v:'Beta 1.0.5'"),'Preserve the previous release in change history');
assert(source.includes('ks-workshop-experimental'),'Do not remove Workshop');
const begin=source.indexOf('  function importKirkaSession() {');
const end=source.indexOf('\n  const host =',begin);
assert(begin>=0 && end>begin,'Missing in-page import helper');
function createContext({host='kirka.io',consent=true,allowOverwrite=true,old=null,token='KIRKA_SESSION_abcdef1234'}={}){
 const fields={
  'ks-account-session-token':{value:token},
  'ks-account-session-consent':{checked:consent},
  'ks-account-session-status':{textContent:''}
 };
 const data=new Map();
 if(old!==null)data.set('token',old);
 let reloads=0;
 const ctx={
  $,L:value=>value,
  isGamePage:true,
  location:{protocol:'https:',hostname:host,reload(){reloads++;}},
  localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>{data.set(key,value);}},
  confirm:()=>allowOverwrite
 };
 function $(id){return fields[id];}
 vm.runInNewContext(source.slice(begin,end)+';globalThis.importSession=importKirkaSession;',ctx);
 return {ctx,fields,data,get reloads(){return reloads;}};
}
const happy=createContext();
assert.equal(happy.ctx.importSession(),true);
assert.equal(happy.data.get('token'),'KIRKA_SESSION_abcdef1234');
assert.equal(happy.reloads,1);
assert.equal(happy.fields['ks-account-session-token'].value,'','Do not leave bearer token in the form');
// Beta 1.0.9: the Google-click helper reuses this SAME routine with its own
// inline dialog fields, instead of navigating to the full Settings menu.
const quick=createContext({token:'IGNORED_SETTINGS_TOKEN'});
const quickFields={input:{value:'KIRKA_QUICK_SESSION_123456789'},
  consent:{checked:true},status:{textContent:''}};
assert.equal(quick.ctx.importSession(quickFields),true);
assert.equal(quick.data.get('token'),'KIRKA_QUICK_SESSION_123456789');
assert.equal(quickFields.input.value,'','Quick dialog must immediately clear the bearer token');
assert.equal(quick.reloads,1,'Kirka page reloads after local import');
const quickNoConsent=createContext();
assert.equal(quickNoConsent.ctx.importSession({input:{value:'KIRKA_QUICK_1234'},
  consent:{checked:false},status:{textContent:''}}),false);
assert.equal(quickNoConsent.data.has('token'),false);
assert(source.includes('function showAccountHelpDialog()'));
assert(source.includes('openAccountHelp: showAccountHelpDialog'));
assert(source.includes("root.querySelector('[data-account-import]').addEventListener"));
const noConsent=createContext({consent:false});
assert.equal(noConsent.ctx.importSession(),false);
assert.equal(noConsent.data.has('token'),false);
const badHost=createContext({host:'evil.example'});
assert.equal(badHost.ctx.importSession(),false);
assert.equal(badHost.data.has('token'),false);
const badToken=createContext({token:'Bearer secret token'});
assert.equal(badToken.ctx.importSession(),false);
const denyOverwrite=createContext({old:'PREVIOUS_SESSION',allowOverwrite:false});
assert.equal(denyOverwrite.ctx.importSession(),false);
assert.equal(denyOverwrite.data.get('token'),'PREVIOUS_SESSION');
assert.equal(denyOverwrite.reloads,0);
assert(!source.includes("notify('auth-import-session'"),'Token must never cross native IPC');
const release=fs.readFileSync(path.join(root,'ci/Publish-Release.ps1'),'utf8');
assert(release.includes('gh release create $tag @publicPaths --repo $publicRepo'));
assert(!release.includes('gh release create $tag @paths --repo $publicRepo'));
console.log('PASS: Beta 1.0.6 local-only Kirka bearer-token handoff, consent, origin, overwrite, preservation and private source');
