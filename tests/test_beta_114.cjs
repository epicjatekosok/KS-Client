'use strict';
// KS Beta 1.0.15 regression: finite FPS reverts browser uncap, external status
// always clears, CEF fullscreen native command exists and Settings translations.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ui=read('electron-app/overlay/overlay.js');
const cefUI=read('cef/overlay/overlay.js');
const pacer=read('electron-app/overlay/frame_pacer.js');
const cef=read('cef/ClientForm.cs');
const workflow=read('.github/workflows/windows-build.yml');
assert.equal(ui,cefUI);
assert(ui.includes("const CLIENT_VERSION='1.0.15'"));
for(const cap of [200,240,300,360]){
  assert(ui.includes("{ value: "+cap+", label: '"+cap+" FPS' }"),'missing option '+cap);
  assert(pacer.includes(cap),'missing pacer cap '+cap);
}
assert(ui.includes('canvas.width!==Math.round(width*dpr)'));
assert(ui.includes('style.backdropFilter=\'none\''));
assert(ui.includes('if(measurementHandle===null)queueMeasurement()'));
assert(cef.includes('__ksclient_internal_toggle_fullscreen__'));
assert(cef.includes('ClientFullscreenKeyboardHandler'));
assert(cef.includes('Keys.F11'));
assert(cef.includes('oldTopMost=TopMost'));
assert(cef.includes('TopMost=oldTopMost'));
assert(ui.includes('communityNoticeTimer'));
assert(ui.includes('setCommunityStatus: status => {showCommunityNotice(status,5500);}'));
assert(ui.includes('showCommunityNotice(state.language'));
const start=ui.indexOf('  function disableChromiumUncapForCap() {');
const end=ui.indexOf('  function setSetting(k, value)',start);
assert(start>0&&end>start);
const sent=[];
const context={
 state:{fpsLimit:180},browserPrefsLoaded:true,
 browserPrefs:{gpu:'enabled',angle:'default',uncapFps:true},
 browserActive:{uncapFps:true},browserPendingRestart:false,browserStatus:'',
 notify:(type,payload)=>sent.push({type,payload})
};
vm.runInNewContext(ui.slice(start,end)+';disableChromiumUncapForCap();',context);
assert.equal(context.browserPrefs.uncapFps,false);
assert.equal(context.browserPendingRestart,true);
assert.equal(sent[0].type,'browser-save');
assert.equal(sent[0].payload.browser.uncapFps,false);
const localeMatch=ui.match(/const extraLocales=(\{[^;]+\});/);
assert(localeMatch,'localized Settings table missing');
const locales=JSON.parse(localeMatch[1]);
for(const locale of ['de','fr','es','pt','it','ru','zh','ja'])
  for(const label of ['Settings','Performance','FPS Limiter','Updates','Language'])
    assert(locales[locale]?.[label],locale+':'+label);
assert(ui.includes('Object.entries(languageNames).map'));
assert(!read('installer/main_windows.go').includes('extraLocales'));
assert(!read('uninstaller/main_windows.go').includes('extraLocales'));
assert(workflow.includes('node tests/test_beta_114.cjs'));
console.log('PASS Beta 1.0.15: fixed FPS caps, Settings GPU work, CEF fullscreen, Discord timer and 8 additional Settings languages');

// Simulate a 180 Hz browser clock, including timeout wakeups, cancellation and menu transitions.
let now=0,next=0;
const raf=new Map(),timers=new Map();
const win={requestAnimationFrame:fn=>(raf.set(++next,fn),next),cancelAnimationFrame:id=>raf.delete(id)};
vm.runInNewContext(pacer,{window:win,location:{hostname:'kirka.io',protocol:'https:'},
 localStorage:{getItem:()=>null},performance:{now:()=>now},
 setTimeout:(fn,ms)=>(timers.set(++next,{fn,due:now+ms}),next),clearTimeout:id=>timers.delete(id)});
const p=win.__KS_FRAME_PACER__;
function advance(ticks){
 for(let i=0;i<ticks;i++){
   now+=1000/180;
   for(const [id,timer] of [...timers])if(timer.due<=now){timers.delete(id);timer.fn();}
   const batch=[...raf.values()];raf.clear();for(const fn of batch)fn(now);
 }
}
let deliveries=0,pending;
function game(){deliveries++;pending=win.requestAnimationFrame(game);}
pending=win.requestAnimationFrame(game);
for(const [cap,expected] of [[60,60],[144,144],[180,180],[240,180],[0,180]]){
 p.setLimit(cap);deliveries=0;advance(1800);
 assert(Math.abs(deliveries/10-expected)<1,JSON.stringify({cap,deliveries}));
}
p.setLimit(144);p.setMenuLimited(true);deliveries=0;advance(1800);
assert(Math.abs(deliveries/10-30)<1);
assert.equal(p.getStats().target,144);
p.setMenuLimited(false);deliveries=0;advance(1800);
assert(Math.abs(deliveries/10-144)<1);
win.cancelAnimationFrame(pending);
let second;
win.requestAnimationFrame(()=>win.cancelAnimationFrame(second));
second=win.requestAnimationFrame(()=>assert.fail('cancelled callback delivered'));
advance(360);
assert.equal(raf.size+timers.size,0);
assert.equal(p.getStats().estimatedCallbackFPS,0);

// An unknown public handle must not cancel the pacer's underlying native wake.
p.setLimit(0);
let stillRuns=false;
const publicId=win.requestAnimationFrame(()=>{stillRuns=true;});
const nativeId=[...raf.keys()][0];
assert(Number.isInteger(nativeId) && nativeId!==publicId);
win.cancelAnimationFrame(nativeId);
advance(10);
assert(stillRuns);
