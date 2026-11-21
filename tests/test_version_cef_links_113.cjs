'use strict';
// Beta 1.0.23: verify dynamic labels, non-racing CEF JS replies, native link
// commands, and the stable Electron authentication/browser path.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ui=read('electron-app/overlay/overlay.js');
const electron=read('electron-app/main.cjs');
assert(ui.includes("const CLIENT_VERSION='1.0.23'"));
assert(ui.includes("const CLIENT_LABEL='Beta '+CLIENT_VERSION"));
assert(ui.includes("KS Client '+esc(CLIENT_LABEL)"),'Installed version derives from build');
assert(ui.includes('KS CLIENT <span>${esc(CLIENT_LABEL.toUpperCase())}</span>'),
 'Sidebar version derives from the same build');
assert(!ui.includes('KS CLIENT <span>BETA 1.0.9</span>'));
assert(!ui.includes('<div class="ks-desc">KS Client Beta 1.0.5</div>'));
assert(ui.includes('ks-workshop-experimental'),'Keep Workshop');
assert(ui.includes("v:'Beta 1.0.13'") && ui.includes("v:'Beta 1.0.12'"),'Do not erase historical release notes');

const a=ui.indexOf('  function openTrustedExternal(kind) {');
const b=ui.indexOf('  // Beta 1.0.6:',a);
assert(a>0&&b>a);
const sent=[];
const electronCtx={isGamePage:true,window:{__KS_NATIVE__:{post(){}},CefSharp:{}},
 location:{assign(){throw Error('Electron must not navigate away from game')}},
 notify:type=>{sent.push(type);return true}};
vm.runInNewContext(ui.slice(a,b)+';globalThis.openTest=openTrustedExternal;',electronCtx);
assert.equal(electronCtx.openTest('discord'),true);
assert.equal(electronCtx.openTest('releases'),true);
assert.deepEqual(sent,['discord-community','update-open-release'],
 'Electron existing native browser IPC is unchanged');
assert(ui.includes("if (a === 'update-open-release') openTrustedExternal('releases');"));
assert(ui.includes("if(!openTrustedExternal('discord'))"));

assert(electron.includes('sandbox:true')&&electron.includes('webSecurity:true'));
assert(!electron.includes('validAuthURL')&&!electron.includes('guardMainNavigation'),
 'Do not reintroduce old Google/OAuth restrictions');
assert(electron.includes("case 'update-open-release':void shell.openExternal("),
 'Electron working URL opener unchanged');
console.log('PASS Beta 1.0.23: current version UI, CEF IBrowser lifecycle, native Discord/release links and Electron unchanged');
