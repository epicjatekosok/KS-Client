/* KS Client 1.1.16 - single visible-game-state runtime (CEF and Electron).
   Observable DOM and render diagnostics only. No authenticated requests, packets,
   hidden player state, input automation or changes to server/game outcomes. */
(() => {
  'use strict';
  if(location.protocol!=='https:' || !['kirka.io','www.kirka.io'].includes(location.hostname) || window.__KS_GAME_RUNTIME__)return;
  const listeners=new Map(), last=new Map(), observerRoots=new Map(), observedFeed=new WeakSet();
  const statsSelectors=Object.freeze({
    kills:'.ui-cell.kill .cell-value,.kill-death .kill .cell-value',
    deaths:'.ui-cell.death .cell-value,.kill-death .death .cell-value',
    assists:'.ui-cell.assists .cell-value',
    headshotPercent:'.ui-cell.hsp .cell-value,.hs-percentage'
  });
  const ui=Object.freeze({
    lobby:['.interface','#app'],
    match:['.desktop-game-interface','.game-interface canvas#game','canvas#game'],
    friends:['.friends .list'],
    profile:['.profile-cont','.card-profile','.profile-page'],
    inventory:['.inventory .item-card','.inventory-item','.inventory'],
    servers:['.servers .list','.server-item'],
    market:['.market','.marketplace'],
    join:['#join-btn','#join-modal-modal']
  });
  const safe=s=>String(s??'').replace(/\s+/g,' ').trim().slice(0,160);
  const pick=arr=>{for(const selector of arr){try{const el=document.querySelector(selector);if(el)return el}catch(_){}}return null};
  const current=()=>{const url=location.pathname;return /^\/(?:games\/|hub\/ranked)/.test(url)?'match':
    pick(['.desktop-game-interface','.game-interface canvas#game'])?'match':
    pick(['.create-modal','.create-room','.create-game'])?'room-creation':
    pick(ui.friends)?'friends':pick(ui.profile)?'profile':
    pick(ui.inventory)?'inventory':pick(ui.market)?'market':
    pick(ui.servers)?'servers':pick(ui.lobby)?'lobby':'loading'};
  const number=s=>{const el=document.querySelector(s);if(!el)return null;const n=Number(safe(el.textContent).replace('%',''));return Number.isFinite(n)&&n>=0?n:null};
  const stats=()=>Object.fromEntries(Object.entries(statsSelectors).map(([key,selector])=>[key,number(selector)]));
  const emit=(name,detail)=>{
    const event=Object.freeze({type:name,at:Date.now(),detail});
    for(const fn of listeners.get(name)||[])try{fn(event)}catch(_){failures++}
    for(const fn of listeners.get('*')||[])try{fn(event)}catch(_){failures++}
  };
  const on=(event,fn)=>{
    if(typeof fn!=='function'||typeof event!=='string'||event.length>60)return()=>{};
    if(!listeners.has(event))listeners.set(event,new Set());
    listeners.get(event).add(fn);return()=>listeners.get(event)?.delete(fn);
  };
  let scene='loading',path='',timer=null,observer=null,failures=0,checks=0,changes=0,started=false;
  let compatibility={signature:'unavailable',supported:{},missing:[],diagnostics:[]};
  let snapshot={scene:'loading',stats:{kills:null,deaths:null,assists:null,headshotPercent:null},source:'visible DOM only'};
  function capabilities(target){
    const supported={};
    for(const [key,selectors] of Object.entries(ui))supported[key]=Boolean(pick(selectors));
    supported.webgl=Boolean(window.__KS_RENDER_OBSERVER__?.getStatus()?.trackedContexts);
    supported.pointerLockAPI=Boolean(pick(['canvas#game'])?.requestPointerLock);
    const missing=[];
    if(target==='match'&&!supported.match)missing.push('game canvas/interface markers');
    if(target==='lobby'&&!supported.lobby)missing.push('lobby root');
    if(target==='inventory'&&!supported.inventory)missing.push('inventory root');
    if(target==='profile'&&!supported.profile)missing.push('profile root');
    if(target==='friends'&&!supported.friends)missing.push('friends list');
    const signature=Object.entries(supported).map(([key,val])=>key+':'+(val?'1':'0')).join('|');
    return {signature,supported,missing,diagnostics:missing.map(x=>'Kirka UI selector absent: '+x)};
  }
  function update(){
    if(!document.body)return;
    checks++;
    const next=current(),nextPath=location.pathname;
    if(nextPath!==path){
      const from=path;path=nextPath;last.clear();
      if(from)emit('route',{from,to:path});
    }
    if(next!==scene){const from=scene;scene=next;changes++;last.clear();emit('scene',{from,to:scene});}
    const nextCompat=capabilities(scene);
    if(nextCompat.signature!==compatibility.signature){
      compatibility=nextCompat;emit('compatibility',{...compatibility});
    }
    const values=scene==='match'?stats():{kills:null,deaths:null,assists:null,headshotPercent:null};
    if(JSON.stringify(values)!==JSON.stringify(snapshot.stats)&&scene==='match')emit('stats',{...values,source:'visible Kirka HUD'});
    snapshot={scene,stats:values,source:'visible DOM only',route:path};
    if(scene==='match')attachFeeds();else detachFeeds();
  }
  function feed(node,kind){
    const prev=observerRoots.get(kind);
    if(prev?.el===node)return;
    if(prev)prev.observer.disconnect();
    observerRoots.delete(kind);
    if(!node)return;
    const o=new MutationObserver(records=>{
      for(const mutation of records)for(const child of mutation.addedNodes){
        if(!(child instanceof Element))continue;
        const items=child.matches('.kill-bar-item,.ach-item,.achievement')?[child]:
          Array.from(child.querySelectorAll('.kill-bar-item,.ach-item,.achievement')).slice(0,20);
        for(const item of items){
          if(observedFeed.has(item))continue;
          observedFeed.add(item);
          const title=safe(item.textContent);
          if(title)emit(kind,{text:title,source:'visible DOM',kind});
        }
      }
    });
    o.observe(node,{childList:true,subtree:true});
    observerRoots.set(kind,{el:node,observer:o});
  }
  function attachFeeds(){feed(pick(['.kill-bar-cont']),'killfeed');feed(pick(['.ach-cont']),'achievement');}
  function detachFeeds(){for(const {observer:o} of observerRoots.values())o.disconnect();observerRoots.clear();}
  function start(){
    if(started||!document.body)return;started=true;
    observer=new MutationObserver(()=>{
      // top-level only; HUD is observed only at targeted feed roots
      if(!queued){queued=true;queueMicrotask(()=>{queued=false;update()});}
    });
    observer.observe(document.body,{childList:true,subtree:false});
    window.addEventListener('popstate',update);
    window.addEventListener('hashchange',update);
    window.addEventListener('ks-render-observer-ready',update);
    document.addEventListener('pointerlockchange',inputChange);
    document.addEventListener('pointerlockerror',inputError);
    timer=setInterval(update,1100);update();
  }
  let queued=false;
  function inputChange(){emit('input',{locked:!!document.pointerLockElement,source:'native DOM pointerlockchange'});}
  function inputError(){emit('input-error',{locked:false,source:'native DOM pointerlockerror'});}
  function stop(){
    clearInterval(timer);timer=null;observer?.disconnect();observer=null;detachFeeds();
    window.removeEventListener('popstate',update);window.removeEventListener('hashchange',update);
    window.removeEventListener('ks-render-observer-ready',update);
    document.removeEventListener('pointerlockchange',inputChange);
    document.removeEventListener('pointerlockerror',inputError);
    started=false;
  }
  window.__KS_GAME_RUNTIME__=Object.freeze({
    on,refresh:update,stop,
    getSnapshot:()=>({...snapshot,stats:{...snapshot.stats},compatibility:{...compatibility,supported:{...compatibility.supported},missing:[...compatibility.missing]}}),
    getStatus:()=>({started,scene,route:path,checks,changes,failures,feedWatchers:observerRoots.size,
      listeners:[...listeners].map(([key,v])=>({name:key,count:v.size})),
      compatibility:{...compatibility,supported:{...compatibility.supported},missing:[...compatibility.missing]}})
  });
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();