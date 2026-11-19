'use strict';
// KS Beta 1.0.14 regression: finite FPS reverts browser uncap, external status
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
assert(ui.includes("const CLIENT_VERSION='1.0.14'"));
for(const cap of [200,240,300,360]){
  assert(ui.includes("{ value: "+cap+", label: '"+cap+" FPS' }"),'missing option '+cap);
  assert(pacer.includes(cap),'missing pacer cap '+cap);
}
assert(ui.includes('canvas.width!==Math.round(width*dpr)'));
assert(ui.includes('style.backdropFilter=\'none\''));
assert(ui.includes('setTimeout(()=>animationFrame(animate),180)'));
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
console.log('PASS Beta 1.0.14: fixed FPS caps, Settings GPU work, CEF fullscreen, Discord timer and 8 additional Settings languages');
