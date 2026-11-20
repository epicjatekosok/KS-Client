/* KS Client 1.1.16 - single visible-game-state runtime (CEF and Electron).
   Observable DOM and render diagnostics only. No authenticated requests, packets,
   hidden player state, input automation or changes to server/game outcomes. */
(() => {
  'use strict';
  if(location.protocol!=='https:' || !['kirka.io','www.kirka.io'].includes(location.hostname) || window.__KS_GAME_RUNTIME__)return;
  const listeners=new Map(), observerRoots=new Map(), observedFeed=new WeakSet();
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
  function visible(selectors){
    for(const selector of selectors)for(const el of document.querySelectorAll(selector)){
      if(el.getClientRects().length && getComputedStyle(el).visibility==='visible')return el;
    }
    return null;
  }
  function resultDialog(){
    for(const panel of document.querySelectorAll('dialog[open],[role="dialog"]')){
      if(!panel.getClientRects().length || panel.closest('#ks-client-root'))continue;
      const heading=panel.querySelector('h1,h2,h3,[role="heading"]');
      if(heading?.getClientRects().length && /^(match results|match complete|game over|mérkőzés eredménye|vége a játéknak)$/i.test(safe(heading.textContent)))return true;
    }
    return false;
  }
  function current(){
    if(/^\/(?:games\/|hub\/ranked)/.test(location.pathname) && resultDialog())return 'results';
    for(const [name,selectors] of [
      ['room-creation',['.create-modal','.create-room','.create-game']],
      ['friends',ui.friends],['profile',ui.profile],['inventory',ui.inventory],
      ['market',ui.market],['servers',ui.servers],
      ['match',['.desktop-game-interface','.game-interface canvas#game']]
    ])if(visible(selectors))return name;
    if(document.pointerLockElement?.id==='game')return 'match';
    if(/^\/(?:games\/|hub\/ranked)/.test(location.pathname))return visible(['canvas#game'])?'match':'loading';
    return visible(ui.lobby)?'lobby':'loading';
  }
  const number=selector=>{
    const el=visible([selector]);
    const value=el?safe(el.textContent).replace(/%$/,'').trim():'';
    return /^\d+(?:\.\d+)?$/.test(value)?Number(value):null;
  };
  const stats=()=>Object.fromEntries(Object.entries(statsSelectors).map(([key,selector])=>[key,number(selector)]));
  let hudTargets=[],hudObserver=null,hudTimer=null;
  function observeStats(){
    const targets=scene==='match'?Object.values(statsSelectors).map(s=>visible([s])).filter(Boolean):[];
    if(targets.length===hudTargets.length && targets.every((el,i)=>el===hudTargets[i]))return;
    hudObserver?.disconnect();hudTargets=targets;
    if(!targets.length)return;
    hudObserver??=new MutationObserver(()=>{
      if(hudTimer!==null||document.hidden)return;
      hudTimer=setTimeout(()=>{hudTimer=null;if(started&&!document.hidden)update()},50);
    });
    for(const target of targets)hudObserver.observe(target,{subtree:true,childList:true,characterData:true});
  }
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
    if(!document.body || document.hidden)return;
    checks++;
    const previous=snapshot, previousSignature=compatibility.signature;
    scene=current();path=location.pathname;
    const values=scene==='match'?stats():{kills:null,deaths:null,assists:null,headshotPercent:null};
    compatibility=capabilities(scene);
    snapshot={scene,stats:values,source:'visible DOM only',route:path};
    observeStats();
    if(scene==='match')attachFeeds();else detachFeeds();
    if(previous.route && path!==previous.route)emit('route',{from:previous.route,to:path});
    if(scene!==previous.scene){
      changes++;emit('scene',{from:previous.scene,to:scene});
      if(scene==='match'||previous.scene==='match')emit(scene==='match'?'match-view-enter':'match-view-leave',{route:path,source:'visible game interface'});
    }
    if(previousSignature!==compatibility.signature)emit('compatibility',{...compatibility});
    if(scene==='match' && JSON.stringify(values)!==JSON.stringify(previous.stats))
      emit('stats',{...values,source:'visible Kirka HUD'});
    emit('refresh',{scene});
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
        const selector='.kill-bar-item,.ach-item,.achievement,.slide-fade-enter-active';
        const closest=child.closest(selector);
        let items=closest?[closest]:Array.from(child.querySelectorAll(selector)).slice(0,20);
        if(!items.length&&child.parentElement===node)items=[child];
        for(const item of items){
          if(observedFeed.has(item)||!item.getClientRects().length)continue;
          const title=safe(item.textContent);
          if(!title)continue;
          observedFeed.add(item);
          const detail={text:title,source:'visible DOM',kind};
          if(kind==='killfeed'){
            const me=safe(document.querySelector('.team-section .nickname,.auth-user .username')?.textContent);
            detail.localHeadshot=!!me && safe(item.querySelector('.killer-name')?.textContent)===me &&
              !!item.querySelector('.skull,.svg-icon--__skull__');
          }
          emit(kind,detail);
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
      if(!queued){queued=true;queueMicrotask(()=>{queued=false;if(started&&!document.hidden)update()});}
    });
    window.addEventListener('popstate',update);
    window.addEventListener('hashchange',update);
    window.addEventListener('ks-render-observer-ready',update);
    document.addEventListener('pointerlockchange',inputChange);
    document.addEventListener('pointerlockerror',inputError);
    document.addEventListener('visibilitychange',onVisible);onVisible();
  }
  let queued=false;
  function onVisible(){
    clearInterval(timer);
    timer=null;
    if(document.hidden){
      detachFeeds();
      hudObserver?.disconnect();
      hudTargets=[];
      clearTimeout(hudTimer);
      hudTimer=null;
      observer?.disconnect();
      return;
    }
    observer?.observe(document.body,{childList:true,subtree:false});
    update();
    timer=setInterval(update,1100);
  }
  function inputChange(){emit('input',{locked:!!document.pointerLockElement,source:'native DOM pointerlockchange'});}
  function inputError(){emit('input-error',{locked:false,source:'native DOM pointerlockerror'});}
  function stop(){
    document.removeEventListener('visibilitychange',onVisible);
    clearInterval(timer);timer=null;observer?.disconnect();observer=null;detachFeeds();
    window.removeEventListener('popstate',update);window.removeEventListener('hashchange',update);
    window.removeEventListener('ks-render-observer-ready',update);
    document.removeEventListener('pointerlockchange',inputChange);
    document.removeEventListener('pointerlockerror',inputError);
    hudObserver?.disconnect();hudTargets=[];clearTimeout(hudTimer);hudTimer=null;
    started=false;
  }
  window.__KS_GAME_RUNTIME__=Object.freeze({
    get scene(){return scene;},on,refresh:update,stop,
    getSnapshot:()=>({...snapshot,stats:{...snapshot.stats},compatibility:{...compatibility,supported:{...compatibility.supported},missing:[...compatibility.missing]}}),
    getStatus:()=>({started,scene,route:path,checks,changes,failures,feedWatchers:observerRoots.size,
      listeners:[...listeners].map(([key,v])=>({name:key,count:v.size})),
      compatibility:{...compatibility,supported:{...compatibility.supported},missing:[...compatibility.missing]}})
  });
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();