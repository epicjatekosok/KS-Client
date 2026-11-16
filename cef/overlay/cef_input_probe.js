/* KS CEF 1.1.17 input diagnosis, installed early only in the CEF engine.
   A transparent pass-through requestPointerLock observer. This never supplies
   fake user activation or hides/captures the Windows cursor. */
(() => {
  'use strict';
  if (location.protocol !== 'https:' || !['kirka.io','www.kirka.io'].includes(location.hostname)) return;
  if (window.__KS_CEF_INPUT__) return;
  const proto=Element.prototype;
  const original=proto.requestPointerLock;
  let attempts=0,errors=0,lastRequestMs=0,lastError='';
  if (typeof original !== 'function') return;
  function passThrough(...args) {
    attempts++;
    lastRequestMs=performance.now();
    try {
      const pending=Reflect.apply(original,this,args);
      // Observe promises without replacing their identity or resolution.
      if(pending && typeof pending.catch==='function'){
        pending.catch(error=>{
          errors++;
          lastError=String(error?.name||'DOMException').slice(0,60);
        });
      }
      return pending;
    }catch(error){
      errors++;
      lastError=String(error?.name||'Exception').slice(0,60);
      throw error;
    }
  }
  let installed=false;
  try {proto.requestPointerLock=passThrough;installed=proto.requestPointerLock===passThrough}
  catch (_) {}
  window.__KS_CEF_INPUT__=Object.freeze({
    getStatus:()=>({installed,attempts,errors,lastRequestMs,lastError,
      pointerLocked:!!document.pointerLockElement,hasFocus:document.hasFocus()}),
    restore:()=>{if(proto.requestPointerLock===passThrough)proto.requestPointerLock=original;}
  });
})();