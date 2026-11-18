'use strict';
// Beta 1.0.5: Google forbids embedded OAuth; use only explicit OS-browser
// recovery and keep non-Google provider popups and secure opener semantics.
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
const release=fs.readFileSync(path.join(root,'RELEASE_BETA_105_EN.md'),'utf8');
const start=electron.indexOf('const AUTH_HOSTS=');
const end=electron.indexOf('function openKSDiscord(){',start);
assert(start>=0&&end>start);
function harness(response=1){
  const opened=[],reports=[],prompts=[];
  const context={
    URL,Set,WeakSet,Date,GAME:'https://kirka.io/',
    win:{isDestroyed:()=>false,webContents:{getURL:()=> 'https://kirka.io/'}},
    log:v=>reports.push(v),
    dialog:{showMessageBox:async(_win,options)=>{prompts.push(options);return {response};}},
    shell:{openExternal:async url=>{opened.push(url);}},
    validURL:(raw,onlyGame=false)=>{
      try{
        const u=new URL(raw);
        return u.protocol==='https:'&&(onlyGame?
          ['kirka.io','www.kirka.io'].includes(u.hostname):
          ['kirka.io','www.kirka.io','kirka-stats.lovable.app'].includes(u.hostname));
      }catch{return false;}
    }
  };
  vm.runInNewContext(electron.slice(start,end)+
    ';globalThis.auth={checkGoogle:isGoogleSignInURL,offer:offerSystemBrowserSignIn,configure:configureAuthPopup};',context);
  return {context,opened,reports,prompts};
}
async function run(){
  const x=harness(1);
  for(const h of ['accounts.google.com','gsi.google.com','consent.google.com','accounts.youtube.com']){
    assert(x.context.auth.checkGoogle('https://'+h+'/signin?secret=token'));
  }
  for(const url of ['https://accounts.google.com.evil.example/','http://accounts.google.com/',
     'https://accounts.google.com:8443/','https://facebook.com/login','javascript:alert(1)']){
    assert(!x.context.auth.checkGoogle(url),url);
  }
  const events={};
  const popup={setMenu(){},on(){},webContents:{
    getURL:()=> 'https://www.facebook.com/dialog/oauth',
    setWindowOpenHandler(fn){this.handler=fn;},
    on:(name,fn)=>{events[name]=fn;}
  }};
  x.context.auth.configure(popup,1);
  assert.equal(popup.webContents.handler({url:'https://accounts.google.com/o/oauth2/v2/auth?code=SECRET'}).action,'deny');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(x.prompts.length,1,'User must get a clear Google login message');
  assert.equal(x.opened.length,0,'No external browser without user consent');
  assert(x.prompts[0].detail.includes('session token'));
  assert.equal(popup.webContents.handler({url:'https://www.facebook.com/dialog/oauth'}).action,'allow');
  assert.equal(popup.webContents.handler({url:'https://example.org/'}).action,'deny');
  assert(!x.reports.join(' ').includes('SECRET'),'Do not log provider tokens');
  const events2={};
  const late={closed:false,setMenu(){},on(){},isDestroyed(){return this.closed;},close(){this.closed=true;}};
  late.webContents={getURL:()=> 'about:blank',
    setWindowOpenHandler(){},on:(name,fn)=>{events2[name]=fn;}};
  x.context.auth.configure(late,2);
  let prevented=false;
  events2['will-redirect']({preventDefault(){prevented=true;}},
    'https://accounts.google.com/signin?state=PRIVATE');
  assert(prevented&&late.closed,'A late Google popup navigation must not expose an embedded login');
  const y=harness(0);
  await y.context.auth.offer();
  assert.deepEqual(y.opened,['https://kirka.io/'],
    'Only hard-coded game site may open in system browser, not Google auth URLs');
  assert(!y.reports.join(' ').includes('PRIVATE'));
  assert(electron.includes("if(isGoogleSignInURL(url))"));
  assert(electron.includes("case 'auth-open-browser'"));
  assert(cefAuth.includes('internal static bool IsGoogleSignIn'));
  assert(cefPopup.includes('ClientAuthentication.IsGoogleSignIn(targetUrl)'));
  assert(cefPopup.includes('FileName=Game,UseShellExecute=true'));
  assert(cefPopup.includes('internal const string Game = "https://kirka.io/"'));
  assert(cefForm.includes('requestGoogleHelp()')&&cefForm.includes('OfferSystemBrowserSignIn()'));
  assert(cefForm.includes('case "auth-open-browser"'));
  assert(cefForm.includes('MessageBoxButtons.YesNo'));
  assert(overlay.includes('data-action="auth-open-browser"'));
  assert(overlay.includes("v:'Beta 1.0.5'"));
  assert.equal(overlay,cefOverlay);
  assert(release.includes('does NOT automatically sign you into KS Client'));
  console.log('PASS: Beta 1.0.5 Google native-browser recovery with consent, separate sessions, other provider popup continuity, safe host validation');
}
run().catch(e=>{console.error(e);process.exitCode=1});
