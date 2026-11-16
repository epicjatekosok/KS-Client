'use strict';
// Sandboxed renderer bridge: no Node.js APIs are passed to the Kirka.io page.
const {contextBridge,ipcRenderer,webFrame}=require('electron');
const ALLOWED=new Set(['kirka.io','www.kirka.io','kirka-stats.lovable.app','kirka-clan-tracker-notpro9.lovable.app']);
if(location.protocol==='https:' && ALLOWED.has(location.hostname)){
  // Read-only engine identity is available synchronously, even if the IPC request
  // sent by the overlay races with the native host.
  contextBridge.exposeInMainWorld('__KS_RUNTIME__',Object.freeze({engine:'Electron',clientVersion:'alpha 1.1.17'}));
  contextBridge.exposeInMainWorld('__KS_NATIVE__',Object.freeze({post:(message)=>{
    if(message && typeof message==='object' && !Array.isArray(message))ipcRenderer.send('ks:message',message);
  }}));
  // One synchronous main-world evaluation of the vetted, bundled scripts.
  // Electron world 0 is the Kirka page world. Script order is deterministic:
  // frame pacing -> passive context registry -> optional cosmetics -> freeze guard.
  // No Node.js objects, native permissions or raw IPC are exposed to the site.
  try{
    const src=ipcRenderer.sendSync('ks:early-bundle');
    if(typeof src==='string'&&src.length>0&&src.length<50000){
      webFrame.executeJavaScriptInIsolatedWorld(0,[{code:src}],false).catch(()=>{});
    }
  }catch(_){}
}
