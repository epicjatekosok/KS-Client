'use strict';
// No real credentials are needed. Verify that Kirka owns its login buttons
// and the client waits for Kirka's ORIGINAL local session to exist.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const electronGate=read('electron-app/overlay/native_login_gate.js');
const cefGate=read('cef/overlay/native_login_gate.js');
assert.equal(electronGate,cefGate);
assert(!/preventDefault|stopPropagation|stopImmediatePropagation/.test(electronGate));
assert(!/fetch\(|XMLHttpRequest|clipboard|postMessage|location\.href/.test(electronGate));
assert(electronGate.includes("localStorage.getItem('token')"));

// Simulate the Kirka page before and after its own email/password or Google
// login stores a game session. KS never sees the token value.
function simulate(initialToken) {
  let token=initialToken,reloads=0,interval=null,cleared=false,events=0;
  const location={protocol:'https:',hostname:'kirka.io',reload(){reloads++}};
  const window={addEventListener(){events++}};
  const context={location,window,localStorage:{getItem(key){assert.equal(key,'token');return token;}},
    setInterval(fn,period){assert.equal(period,500);interval=fn;return 5;},
    clearInterval(id){assert.equal(id,5);cleared=true;}};
  vm.runInNewContext(electronGate,context);
  return {get interval(){return interval},get reloads(){return reloads},
    get cleared(){return cleared},get events(){return events},set token(v){token=v},context};
}
const waiting=simulate(null);
assert.equal(waiting.reloads,0);
assert.equal(waiting.events,1);
waiting.interval();
assert.equal(waiting.reloads,0,'No reload before Kirka authentication');
waiting.token='synthetic-not-a-real-credential';
waiting.interval();
assert.equal(waiting.reloads,1,'Reload once only after Kirka sets session');
waiting.interval();
assert.equal(waiting.reloads,1,'Do not loop/reload repeatedly');
assert(waiting.cleared);
const ready=simulate('synthetic-token');
assert.equal(ready.interval,null,'Existing session must load the full KS runtime immediately');

// Browser/native injection must leave an unauthenticated Kirka page alone.
const preload=read('electron-app/preload.cjs');
const host=read('electron-app/main.cjs');
const cef=read('cef/ClientForm.cs');
assert(preload.includes("gameSessionReady=!!localStorage.getItem('token')"));
assert(preload.includes('if(gameSessionReady)'));
const start=host.indexOf("win.webContents.on('dom-ready',async()=>{");
const runner=host.indexOf('await win.webContents.executeJavaScript(frameJS,true);',start);
const guard=host.indexOf('if(!authenticated){',start);
assert(start>=0&&guard>start&&runner>guard,
 'Authenticated gating must run before late game/overlay hooks');
assert(host.includes('await win.webContents.executeJavaScript(nativeLoginGateJS,true)'));
assert(cef.includes('private static string AfterKirkaLogin(string script)'));
assert(cef.includes('e.Frame.ExecuteJavaScriptAsync(nativeLoginGate)'));
for(const file of ['overlay','pacer','extras','workshop','advanced','freezeGuard'])
  assert(new RegExp('\\b'+file+'=AfterKirkaLogin\\(').test(cef),file+' CEF module is not login-gated');
assert(cef.includes('browser.LifeSpanHandler = new ClientCommunityPopupHandler()'));
assert(host.includes("win.webContents.on('will-navigate',guardMainNavigation)"));
// No broad Discord text interception: the user's own provider buttons are Kirka's.
const ui=read('electron-app/overlay/overlay.js');
assert.equal(ui,read('cef/overlay/overlay.js'));
const begin=ui.indexOf('  function isKirkaDiscordButton(element) {');
const end=ui.indexOf('  if(isGamePage)document.addEventListener',begin);
assert(begin>0&&end>begin);
const context={URL,location:{href:'https://kirka.io/'},host:{contains:()=>false}};
vm.runInNewContext(ui.slice(begin,end)+';globalThis.testButton=isKirkaDiscordButton;',context);
function button(label,href='',login=false){
  const obj={getAttribute(k){return k==='href'?href:'';},textContent:label,id:'',className:'',
    closest(selector){return selector.startsWith('#auth-modal')&&login?obj:null}};
  return {closest(selector){return selector.startsWith('a,button')?obj:null}};
}
assert(!context.testButton(button('Discord')),'Custom Discord login button must never be hijacked');
assert(!context.testButton(button('Discord', '',true)));
assert(!context.testButton(button('Google')),'Google login button must not be hijacked');
assert(!context.testButton(button('Sign in with email')));
assert(!context.testButton(button('Discord','https://discord.com/oauth2/authorize')));
assert(context.testButton(button('Join our Discord','https://discord.gg/cxP386yGjk')));
console.log('PASS Beta native-login: original Kirka buttons are untouched; session observer reloads once; all KS modules resume after login');
