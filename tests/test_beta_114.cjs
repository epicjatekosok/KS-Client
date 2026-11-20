'use strict';
// KS Beta 1.0.19 regression: independent FPS controls, external status
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
assert(ui.includes("const CLIENT_VERSION='1.0.19'"));
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
for(const file of ['electron-app/main.cjs','cef/Program.cs']){
  const source=read(file);
  for(const flag of ['disable-renderer-backgrounding','disable-background-timer-throttling','disable-backgrounding-occluded-windows'])
    assert(!source.includes(flag),file+' disables native background scheduling');
}
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
console.log('PASS Beta 1.0.19: fixed FPS caps, Settings GPU work, CEF fullscreen, Discord timer and 8 additional Settings languages');

// Simulate a 180 Hz browser clock, including timeout wakeups, cancellation and menu transitions.
let now=0,next=0;
const raf=new Map(),timers=new Map();
const win={requestAnimationFrame:fn=>(raf.set(++next,fn),next),cancelAnimationFrame:id=>raf.delete(id)};
vm.runInNewContext(pacer,{window:win,location:{hostname:'kirka.io',protocol:'https:'},
 document:{hidden:false,addEventListener(){}},localStorage:{getItem:()=>null},performance:{now:()=>now},
 setTimeout:(fn,ms)=>(timers.set(++next,{fn,due:now+ms}),next),clearTimeout:id=>timers.delete(id)});
const p=win.__KS_FRAME_PACER__;
function advance(ticks,hz=180){
 for(let i=0;i<ticks;i++){
   const vsync=now+1000/hz;
   for(;;){
     const first=[...timers].sort((a,b)=>a[1].due-b[1].due)[0];
     if(!first||first[1].due>vsync)break;
     timers.delete(first[0]);now=first[1].due;first[1].fn();
   }
   now=vsync;
   const batch=[...raf.values()];raf.clear();for(const fn of batch)fn(now);
 }
}
let deliveries=0,pending;
function game(){deliveries++;pending=win.requestAnimationFrame(game);}
pending=win.requestAnimationFrame(game);
for(const [cap,expected] of [[60,60],[144,144],[180,180],[240,240],[0,180]]){
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

p.setLimit(180);
pending=win.requestAnimationFrame(game);
const initialWakes=p.getStats().nativeWakes;
deliveries=0;
advance(25000,2500);
const wakes=p.getStats().nativeWakes-initialWakes;
assert(Math.abs(deliveries/10-180)<1);
assert.equal(wakes,0,'fixed mode requested native unlocked frames');
p.setLimit(180);deliveries=0;advance(1440,144);
assert(Math.abs(deliveries/10-180)<1,'180 game frames on a simulated 144 Hz display');
console.log('Simulated 2500 Hz, 180 cap: %d callbacks, %d native rAF wakes in 10 s',deliveries,wakes);
for(const [activity,menu,expected] of [[60,false,60],[60,true,30],[30,false,30],[0,false,180]]){
  p.setActivityLimit(activity);p.setMenuLimited(menu);
  deliveries=0;advance(1800);
  assert(Math.abs(deliveries/10-expected)<1);
  assert.equal(p.getStats().target,180);
}
win.cancelAnimationFrame(pending);
