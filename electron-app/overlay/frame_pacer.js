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
  // Common presets include 200, 240, 300 and 360. A custom integer uses the same scheduler.
  const validLimit=n=>Number.isInteger(n) && n>=0 && n<=1000;
  const settingsKey = 'ksclient.settings.alpha';
  let target = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    const n = Number(saved.fpsLimit);
    if (validLimit(n)) target = n;
  } catch (_) {}
  let menuLimited=false, activityLimit=0, wake=null, deadline=null, generation=0;
  let completedFrames=0, nativeWakes=0, timerWakes=0, nextId=1, delivering=false;
  let lastTime=null, frameMs=0, sampleStart=null, sampleCount=0, callbackFPS=0;
  const queued=new Map();
  const intervals=new Float64Array(240);
  let sampling=false, count=0, cursor=0;

  function effectiveLimit(){
    const limit=Math.min(target||Infinity,activityLimit||Infinity,menuLimited?30:Infinity);
    return Number.isFinite(limit)?limit:0;
  }
  function cancelWake(){
    generation++;
    if(wake?.kind==='native')nativeCancelRAF(wake.id);
    if(wake?.kind==='timer')clearTimeout(wake.id);
    if(wake?.kind==='task')wake.controller.abort();
    wake=null;
  }
  function schedule(){
    if(wake||delivering||!queued.size)return;
    const cap=effectiveLimit(), token=generation;
    if(!cap||document.hidden){
      wake={kind:'native',id:nativeRAF(ts=>{
        if(token!==generation)return;
        nativeWakes++;deliver(ts);
      })};
      return;
    }
    // Only a game request arms this clock. A fixed deadline does not subscribe
    // Chromium's compositor to a perpetual stream of unlocked begin-frames.
    const now=performance.now(), period=1000/cap;
    if(deadline===null)deadline=now+period;
    const delay=Math.max(0,Math.ceil(deadline-now));
    const run=()=>{
      if(token!==generation)return;
      const ts=performance.now();
      // Skip missed deadlines after a stall. Never replay frames to catch up.
      deadline+=Math.max(1,Math.floor((ts-deadline)/period)+1)*period;
      timerWakes++;deliver(ts);
    };
    if(period<4 && window.scheduler?.postTask){
      const controller=new AbortController();
      wake={kind:'task',controller};
      window.scheduler.postTask(run,{delay,signal:controller.signal}).catch(error=>{
        if(error.name!=='AbortError')setTimeout(()=>{throw error},0);
      });
    }else wake={kind:'timer',id:setTimeout(run,delay)};
  }
  function deliver(ts){
    wake=null;delivering=true;
    if(lastTime!==null){
      frameMs=ts-lastTime;
      if(sampling&&frameMs>0){intervals[cursor]=frameMs;cursor=(cursor+1)%intervals.length;count=Math.min(count+1,intervals.length);}
    }
    lastTime=ts;completedFrames++;
    if(sampleStart===null){sampleStart=ts;sampleCount=0;}
    else sampleCount++;
    if(ts-sampleStart>=1000){
      callbackFPS=Math.round(sampleCount*1000/(ts-sampleStart));sampleCount=0;sampleStart=ts;
    }
    // Requests created inside this batch belong to a later frame. Cancelled
    // siblings are checked immediately before invocation.
    for(const id of Array.from(queued.keys())){
      const fn=queued.get(id);if(!fn)continue;
      queued.delete(id);
      try{fn.call(window,ts)}catch(error){setTimeout(()=>{throw error},0);}
    }
    delivering=false;schedule();
  }
  function resetTiming(){
    cancelWake();deadline=lastTime=sampleStart=null;
    count=cursor=sampleCount=callbackFPS=frameMs=0;schedule();
  }
  document.addEventListener('visibilitychange',resetTiming);
  function frameRequest(callback){
    if(typeof callback!=='function')throw new TypeError('callback must be a function');
    const id=nextId++;queued.set(id,callback);schedule();return id;
  }
  function frameCancel(id){
    if(queued.delete(id)&&!queued.size&&!delivering){cancelWake();deadline=null;}
  }
  Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, writable: true, value: frameRequest });
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, writable: true, value: frameCancel });
  Object.defineProperty(window, '__KS_FRAME_PACER__', { configurable: false, value: Object.freeze({
    setLimit(n) {
      n = Number(n);
      if (!validLimit(n)) return false;
      if(target!==n){target=n;resetTiming();}
      return true;
    },
    setActivityLimit(limit){
      if(![0,30,60].includes(limit) || limit===activityLimit)return;
      activityLimit=limit;
      resetTiming();
    },
    setMenuLimited(enabled){
      if(menuLimited!==Boolean(enabled)){menuLimited=Boolean(enabled);resetTiming();}
    },
    setSampling(enabled){
      if(sampling!==enabled){sampling=enabled;count=cursor=0;}
    },
    getIntervals(){
      return Array.from({length:count},(_,i)=>intervals[(cursor-count+i+intervals.length)%intervals.length]);
    },
    getStats() {
      const recent=lastTime!==null&&performance.now()-lastTime<1500;
      return {
        target,effectiveLimit:effectiveLimit(),menuLimited,activityLimit,nativeWakes,timerWakes,
        estimatedCallbackFPS: recent?callbackFPS:0,
        estimatedCallbackFrameMs: recent?frameMs:0,
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
