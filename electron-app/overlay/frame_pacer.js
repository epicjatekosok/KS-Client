/* KS Client ALPHA: best-effort game requestAnimationFrame pacing.
 * Electron injects this at document start when supported; CEF injects after navigation. It does not control GPU
 * vsync, all game engine render loops, worker rendering, or network latency.
 */
(() => {
  'use strict';
  if (location.protocol !== 'https:' || !['kirka.io', 'www.kirka.io'].includes(location.hostname)) return;
  if (window.__KS_FRAME_PACER__) return;
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCancelRAF = window.cancelAnimationFrame.bind(window);
  const allowed = new Set([0, 60, 120, 144, 165, 180, 200, 240, 300, 360]);
  const settingsKey = 'ksclient.settings.alpha';
  let target = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    const n = Number(saved.fpsLimit);
    if (allowed.has(n)) target = n;
  } catch (_) {}
  let menuLimited=false,wakeTimer=null,frameHandle=null;
  const effectiveLimit=()=>menuLimited?Math.min(target||30,30):target;
  let nextId = 1;
  const queued = new Map();
  let lastFrameTimestamp = -1;
  let permittedThisFrame = false;
  let nextDueTimestamp = -Infinity;
  let completedFrames = 0;
  let completedAt = 0;
  let lastCompletedAt = 0;
  let callbackFPS = 0;
  let callbackFrameMs = 0;
  let lastSampleAt = 0;
  let periodCount = 0;

  function updateFrameMetrics(ts) {
    if (completedAt === ts) return;
    if (lastCompletedAt > 0) callbackFrameMs = ts - lastCompletedAt;
    lastCompletedAt = ts;
    completedAt = ts;
    completedFrames++;
    periodCount++;
    if (lastSampleAt === 0) lastSampleAt = ts;
    if (ts - lastSampleAt >= 1000) {
      callbackFPS = Math.round(periodCount * 1000 / (ts - lastSampleAt));
      periodCount = 0;
      lastSampleAt = ts;
    }
  }

  function shouldRun(ts) {
    if (lastFrameTimestamp !== ts) {
      lastFrameTimestamp = ts;
      const cap=effectiveLimit();
      if (!cap) permittedThisFrame = true;
      else {
        const period = 1000 / cap;
        // Accumulate fractional timing so 144 on 180 Hz is ~144, not 90.
        if (!Number.isFinite(nextDueTimestamp) || ts - nextDueTimestamp > period * 3) {
          nextDueTimestamp = ts;
        }
        permittedThisFrame = ts + 0.45 >= nextDueTimestamp;
        if (permittedThisFrame) nextDueTimestamp += period;
      }
    }
    return permittedThisFrame;
  }

  function cancelWake(){
    if(wakeTimer!==null)clearTimeout(wakeTimer);
    if(frameHandle!==null)nativeCancelRAF(frameHandle);
    wakeTimer=frameHandle=null;
  }
  function schedule(){
    if(!queued.size||wakeTimer!==null||frameHandle!==null)return;
    const request=()=>{wakeTimer=null;frameHandle=nativeRAF(deliver);};
    const delay=effectiveLimit()?nextDueTimestamp-performance.now()-9:0;
    if(delay>4)wakeTimer=setTimeout(request,delay);
    else request();
  }
  function deliver(ts){
    frameHandle=null;
    if(shouldRun(ts)){
      // New requests run on a later tick. Earlier callbacks may cancel later ones.
      const batch=Array.from(queued.keys());
      updateFrameMetrics(ts);
      for(const id of batch){
        const fn=queued.get(id);
        if(!fn)continue;
        queued.delete(id);
        try{fn.call(window,ts);}catch(error){setTimeout(()=>{throw error},0);}
      }
    }
    schedule();
  }
  function resetTiming(){
    cancelWake();nextDueTimestamp=-Infinity;lastFrameTimestamp=-1;
    lastSampleAt=lastCompletedAt=periodCount=callbackFPS=callbackFrameMs=0;
    schedule();
  }
  function frameRequest(callback){
    if(typeof callback!=='function')throw new TypeError('callback must be a function');
    const id=nextId++;queued.set(id,callback);schedule();return id;
  }
  function frameCancel(id){
    if(!queued.delete(id)){nativeCancelRAF(id);return;}
    if(!queued.size)cancelWake();
  }
  Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, writable: true, value: frameRequest });
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, writable: true, value: frameCancel });
  Object.defineProperty(window, '__KS_FRAME_PACER__', { configurable: false, value: Object.freeze({
    setLimit(n) {
      n = Number(n);
      if (!allowed.has(n)) return false;
      if(target!==n){target=n;resetTiming();}
      return true;
    },
    setMenuLimited(enabled){
      if(menuLimited!==Boolean(enabled)){menuLimited=Boolean(enabled);resetTiming();}
    },
    getStats() {
      const recent=lastCompletedAt>0&&performance.now()-lastCompletedAt<1500;
      return {
        target,effectiveLimit:effectiveLimit(),menuLimited,
        estimatedCallbackFPS: recent?callbackFPS:0,
        estimatedCallbackFrameMs: recent?callbackFrameMs:0,
        completedFrames,
        requestCount: queued.size,
        note: 'Best-effort requestAnimationFrame callback rate; not verified GPU FPS'
      };
    },
    nativeCancelAnimationFrame:nativeCancelRAF,
    nativeRequestAnimationFrame: nativeRAF
  }) });

  // WebGL observation now lives in integration_bootstrap.js, the single
  // shared early game context registry. No competing getContext wrappers.

})();
