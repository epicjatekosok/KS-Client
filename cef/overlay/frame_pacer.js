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
  let synced=false, nativePeriod=0, previousPaint=null, probe=[], extraId=null;
  let taskController=null;
  let extraCredit=0, retryAt=0, epoch=0, firstFrame=null, intervalCount=0;
  const queued=new Map();
  const intervals=new Float64Array(240);
  let sampling=false, count=0, cursor=0;

  function effectiveLimit(){
    const limit=Math.min(target||Infinity,activityLimit||Infinity,menuLimited?30:Infinity);
    return Number.isFinite(limit)?limit:0;
  }
  function cancelWake(){
    generation++;
    clearTimeout(extraId);extraId=null;
    if(wake?.kind==='native')nativeCancelRAF(wake.id);
    if(wake?.kind==='timer')clearTimeout(wake.id);
    if(wake?.kind==='task'){taskController.abort();taskController=null;}
    wake=null;
  }
  function forgetDisplay(){
    previousPaint=null;nativePeriod=extraCredit=retryAt=0;probe=[];
  }
  // Probe only when the game asks for frames. Recheck after a monitor change
  // or when several consecutive repaint intervals no longer fit the estimate.
  function onPaint(ts,cap,token){
    if(token!==generation)return;
    wake=null;nativeWakes++;
    clearTimeout(extraId);extraId=null;
    if(previousPaint!==null){
      const dt=ts-previousPaint;
      if(!nativePeriod || Math.abs(dt-nativePeriod)>nativePeriod*.12){
        if(dt>0)probe.push(dt);
        if(probe.length>=7){
          probe.sort((a,b)=>a-b);nativePeriod=probe[3];probe=[];extraCredit=0;
          if(nativePeriod<1.8 || nativePeriod>45 || cap*nativePeriod>2005){
            retryAt=performance.now()+5000;
          }
        }
      }else probe.length=0;
    }
    previousPaint=ts;
    const period=1000/cap;
    if(deadline===null)deadline=ts;
    // Choose the nearest repaint for sub-refresh caps. Keep the phase after a
    // late wake without replaying missed frames.
    const tolerance=Math.min(period*.49,(nativePeriod||0)*.49);
    const eachPaint=nativePeriod && period<=nativePeriod*1.003;
    if((eachPaint || ts+tolerance>=deadline) && (lastTime===null || ts>lastTime)){
      deadline+=Math.max(1,Math.floor((ts+tolerance-deadline)/period)+1)*period;
      deliver(ts);
    }else schedule();
    if(!eachPaint || !queued.size || token!==generation || retryAt || document.hidden)return;
    // E.g. 180 on 144 Hz: draw before each repaint, with one extra game
    // step every four refreshes. A late optional step yields to the repaint.
    extraCredit+=Math.max(0,nativePeriod/period-1);
    if(extraCredit<.9999)return;
    extraCredit-=1;
    const nextPaint=ts+nativePeriod;
    extraId=setTimeout(()=>{
      extraId=null;
      const now=performance.now();
      if(token===generation && queued.size && now<nextPaint-nativePeriod*.18){
        deliver(now,true);
      }
    },Math.max(0,Math.round(ts+nativePeriod/2-performance.now())));
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
    if(synced && !menuLimited && !activityLimit){
      if(retryAt && performance.now()>=retryAt)forgetDisplay();
      if(!retryAt){
        wake={kind:'native',id:nativeRAF(ts=>onPaint(ts,cap,token))};
        return;
      }
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
      deadline=Math.max(ts+period*.75,
        deadline+Math.max(1,Math.floor((ts-deadline)/period)+1)*period);
      timerWakes++;deliver(ts);
    };
    if(window.scheduler?.postTask && !menuLimited && !activityLimit){
      taskController??=new AbortController();
      wake={kind:'task'};
      window.scheduler.postTask(run,{delay,priority:'user-blocking',signal:taskController.signal}).catch(error=>{
        if(error.name!=='AbortError')setTimeout(()=>{throw error},0);
      });
    }else wake={kind:'timer',id:setTimeout(run,delay)};
  }
  function deliver(ts,betweenPaints=false){
    if(!betweenPaints)wake=null;
    delivering=true;
    if(lastTime!==null && ts-lastTime>1500)clearSamples();
    if(firstFrame===null)firstFrame=ts;
    else intervalCount++;
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
    const lastId=nextId-1;
    for(const [id,fn] of queued){
      if(id>lastId)break;
      queued.delete(id);
      try{fn.call(window,ts)}catch(error){setTimeout(()=>{throw error},0);}
    }
    delivering=false;
    if(!queued.size){cancelWake();deadline=null;previousPaint=null;extraCredit=0;}
    else schedule();
  }
  function clearSamples(){
    epoch++;firstFrame=lastTime=sampleStart=null;
    count=cursor=intervalCount=sampleCount=callbackFPS=frameMs=0;
  }
  function resetTiming(){
    cancelWake();forgetDisplay();deadline=null;clearSamples();schedule();
  }
  window.addEventListener?.('resize',resetTiming);
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
    setDisplaySync(enabled){
      if(synced!==enabled){synced=enabled;resetTiming();}
    },
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
        epoch,
        averageCallbackFPS:recent && lastTime-firstFrame>=1000
          ? Math.round(intervalCount*1000/(lastTime-firstFrame)) : 0,
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
