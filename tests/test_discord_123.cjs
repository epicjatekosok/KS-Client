'use strict';
// Test the genuine Electron main-world Discord opener without requiring a
// Windows GUI. This catches the exact ReferenceError reported in alpha 1.1.22.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const full=fs.readFileSync(path.join(__dirname,'..','electron-app','main.cjs'),'utf8');
const from=full.indexOf('function openKSDiscord(){');
const until=full.indexOf('function normPrefs(',from);
assert(from>0 && until>from && from<full.indexOf('function createWindow(){'));
assert.equal(full.split('function openKSDiscord(){').length-1,1);
assert(full.includes("case 'discord-community':openKSDiscord();break;"));
let opened=[],statuses=[],messages=[];
let mock={Promise,shell:{openExternal:url=>{opened.push(url);return Promise.resolve();}},
  jsCall:(name,msg)=>statuses.push({name,msg}),log:msg=>messages.push(msg)};
vm.runInNewContext(full.slice(from,until)+';globalThis.openKSDiscord=openKSDiscord;',mock);
(async()=>{
 mock.openKSDiscord();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(opened,['https://discord.gg/cxP386yGjk']);
 assert.equal(statuses.length,1);
 assert.match(statuses[0].msg,/Windows default browser/);
 assert.equal(messages.length,0);
 mock.shell.openExternal=()=>Promise.reject(new Error('No default browser'));
 mock.openKSDiscord();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(messages.length,1);
 assert.match(statuses.at(-1).msg,/Cannot open default browser/);
 // A synchronous host exception must also be caught.
 mock.shell.openExternal=()=>{throw new Error('shell API failure');};
 mock.openKSDiscord();
 assert.equal(messages.length,2);
 assert.match(statuses.at(-1).msg,/Windows could not open/);
 console.log('PASS: Electron main Discord direct IPC target opens fixed invite without ReferenceError; failures handled');
})().catch(e=>{console.error(e);process.exitCode=1;});
