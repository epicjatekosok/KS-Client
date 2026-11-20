'use strict';
// Sandboxed renderer bridge: no Node.js APIs are passed to the Kirka.io page.
const {contextBridge,ipcRenderer,webFrame}=require('electron');
const ALLOWED=new Set(['kirka.io','www.kirka.io','kirka-stats.lovable.app','kirka-clan-tracker-notpro9.lovable.app']);
if(location.protocol==='https:' && ALLOWED.has(location.hostname)){
  // Read-only engine identity is available synchronously, even if the IPC request
  // sent by the overlay races with the native host.
  contextBridge.exposeInMainWorld('__KS_RUNTIME__',Object.freeze({engine:'Electron',clientVersion:'Beta 1.0.16'}));
  contextBridge.exposeInMainWorld('__KS_NATIVE__',Object.freeze({post:(message)=>{
    if(message && typeof message==='object' && !Array.isArray(message))ipcRenderer.send('ks:message',message);
  }}));
  // Dawn leaves Kirka's unauthenticated page alone. Run KS's document-start
  // WebGL/game hooks only AFTER the game's own session already exists.
  // The token is inspected as a boolean entirely inside this renderer; no
  // credential, authorization code, cookie or token is sent over IPC.
  let gameSessionReady=true;
  if(['kirka.io','www.kirka.io'].includes(location.hostname)){
    try{gameSessionReady=!!localStorage.getItem('token');}
    catch(_){gameSessionReady=false;}
  }
  if(gameSessionReady) {
    // Authenticated games keep every existing early browser/game feature.
    try{
      const src=ipcRenderer.sendSync('ks:early-bundle');
      if(typeof src==='string'&&src.length>0&&src.length<50000){
        webFrame.executeJavaScriptInIsolatedWorld(0,[{code:src}],false).catch(()=>{});
      }
    }catch(_){}
  }
}
