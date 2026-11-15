'use strict';
// Sandboxed renderer bridge: no Node.js APIs are passed to the Kirka.io page.
const {contextBridge,ipcRenderer,webFrame}=require('electron');
const ALLOWED=new Set(['kirka.io','www.kirka.io','kirka-stats.lovable.app','kirka-clan-tracker-notpro9.lovable.app']);
if(location.protocol==='https:' && ALLOWED.has(location.hostname)){
  // Read-only engine identity is available synchronously, even if the IPC request
  // sent by the overlay races with the native host.
  contextBridge.exposeInMainWorld('__KS_RUNTIME__',Object.freeze({engine:'Electron',clientVersion:'alpha 1.1.13'}));
  contextBridge.exposeInMainWorld('__KS_NATIVE__',Object.freeze({post:(message)=>{
    if(message && typeof message==='object' && !Array.isArray(message))ipcRenderer.send('ks:message',message);
  }}));
  // Preload happens before normal website scripts. Ask the main process for the
  // bundled frame-pacing JS and inject into the page world (never expose FS).
  // The main window's DOM-ready handler still installs the full visual overlay.
  try{
    const src=ipcRenderer.sendSync('ks:early-pacer');
    if(typeof src==='string' && src.length<25000)webFrame.executeJavaScript(src).catch(()=>{});
  }catch(_){}
  // Install passive render observation before the game's DOM-ready UI layers.
  // This does not grant Node.js access or modify 3D drawing operations.
  try{
    const src=ipcRenderer.sendSync('ks:early-integration');
    if(typeof src==='string' && src.length<12000)webFrame.executeJavaScript(src).catch(()=>{});
  }catch(_){}
}
