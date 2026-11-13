'use strict';
// Sandboxed renderer bridge: no Node.js APIs are passed to the Kirka.io page.
const {contextBridge,ipcRenderer,webFrame}=require('electron');
const ALLOWED=new Set(['kirka.io','www.kirka.io','kirka-stats.lovable.app','kirka-clan-tracker-notpro9.lovable.app']);
if(location.protocol==='https:' && ALLOWED.has(location.hostname)){
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
}
