/* KS Client 1.1.14 – shared game integration modules.
   Supports visible UI only; does not read private state, game packets or tokens.
   No automatic gameplay actions. Errors are isolated to individual modules. */
(() => {
  'use strict';
  if (location.protocol !== 'https:' || !['kirka.io','www.kirka.io'].includes(location.hostname)) return;
  if (window.__KS_INTEGRATION__) return;

  const KEY='ksclient.settings.alpha';
  const modules=new Map(), events=new Map(), status={started:false,scene:'unknown',healthy:[],errors:{},checks:0,lastChange:0};
  let settings={};
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return {}}};
  const isMatch=()=>/^\/(games\/|hub\/ranked)/.test(location.pathname);
  const safeRoom=value=>{
    try{const u=new URL(String(value).trim());return u.protocol==='https:'&&
      ['kirka.io','www.kirka.io'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&
      /^\/(games\/|hub\/ranked|servers\/)/.test(u.pathname)?u.href:null}catch(_){return null}
  };
  const emit=(name,data)=>{for(const fn of events.get(name)||[]){try{fn(data)}catch(_){}}};
  const on=(name,fn)=>{
    if(typeof fn!=='function')return ()=>{};
    if(!events.has(name))events.set(name,new Set());
    events.get(name).add(fn);
    return ()=>events.get(name)?.delete(fn);
  };
  function register(name,detect,start){
    modules.set(name,{detect,start,dispose:null,active:false});
  }
  function scene(){
    const shared=window.__KS_GAME_RUNTIME__?.getStatus?.()?.scene;
    if(shared && shared!=='unknown')return shared;
    if(isMatch() || document.querySelector('.desktop-game-interface,.game-interface canvas#game'))return 'match';
    if(document.querySelector('.create-modal,.create-room,.create-game'))return 'room-creation';
    if(document.querySelector('.friends .list'))return 'friends';
    if(document.querySelector('.profile-cont,.card-profile'))return 'profile';
    if(document.querySelector('.inventory .item-card,.inventory-item'))return 'inventory';
    if(document.querySelector('.servers .list'))return 'servers';
    return document.querySelector('.interface,#app')?'lobby':'loading';
  }
  function attach(name,module){
    if(module.active)return;
    try{
      const cleanup=module.start();
      // If the relevant Kirka DOM is not ready, retry on the next scan.
      if(typeof cleanup!=='function')return;
      module.dispose=cleanup;
      module.active=true;
      delete status.errors[name];
    }catch(e){
      module.active=false;
      status.errors[name]=String(e?.message||e).slice(0,180);
    }
  }
  function detach(name,module){
    if(!module.active)return;
    try{module.dispose?.()}catch(e){status.errors[name]=String(e?.message||e).slice(0,180)}
    module.dispose=null;module.active=false;
  }
  function refresh(){
    settings=read();status.checks++;
    const next=scene();
    if(status.scene!==next){const before=status.scene;status.scene=next;status.lastChange=Date.now();emit('scene-change',{before,scene:next});}
    for(const [name,m] of modules){
      let wanted=false;
      try{wanted=Boolean(m.detect(next))}catch(e){status.errors[name]=String(e?.message||e).slice(0,180)}
      if(wanted)attach(name,m);else detach(name,m);
    }
    status.healthy=[...modules].filter(([,m])=>m.active).map(([name])=>name);
  }
  function observeText(selector,callback){
    let previous=null;
    const scan=()=>{
      const el=document.querySelector(selector);
      if(!el)return;
      const value=String(el.textContent||'').trim().slice(0,180);
      if(value!==previous){previous=value;callback(value,el);}
    };
    const observer=new MutationObserver(scan);
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    scan();
    return ()=>observer.disconnect();
  }

  // Game HUD: augment the game's visible stats, do not spoof scores.
  register('hud-stats',s=>s==='match',()=>{
    const bar=document.querySelector('.script-ui .ui-row,.kill-death');
    if(!bar)return;
    let root=bar.querySelector('[data-ks-integration="stats"]');
    if(root)return;
    root=document.createElement('span');
    root.dataset.ksIntegration='stats';
    root.style.cssText='display:inline-flex;gap:8px;align-items:center;font:600 11px Segoe UI,Arial;color:#f0aa35;pointer-events:none;';
    const kills=document.createElement('span');
    const headshots=document.createElement('span');
    root.append(kills,headshots);
    bar.appendChild(root);
    let killsCount=0,headshotCount=0;
    const seen=new WeakSet();
    const update=()=>{
      const killText=document.querySelector('.ui-cell.kill .cell-value,.kill-death .kill .cell-value')?.textContent?.trim();
      const n=Number(killText);
      if(Number.isFinite(n)&&n>=0)killsCount=n;
      kills.textContent='KS K: '+killsCount;
      headshots.textContent='HS: '+(killsCount?Math.round(100*headshotCount/killsCount):0)+'%';
      emit('stats',{kills:killsCount,headshots:headshotCount});
    };
    const feed=document.querySelector('.kill-bar-cont');
    const observer=feed?new MutationObserver(changes=>{
      for(const change of changes)for(const node of change.addedNodes){
        if(!(node instanceof Element)||seen.has(node))continue;seen.add(node);
        const mine=String(document.querySelector('.team-section .nickname,.auth-user .username')?.textContent||'').trim();
        if(mine&&String(node.querySelector('.killer-name')?.textContent||'').trim()===mine&&node.querySelector('.skull,.svg-icon--__skull__'))headshotCount++;
      }
      update();
    }):null;
    if(feed)observer.observe(feed,{childList:true,subtree:true});
    update();
    return ()=>{observer?.disconnect();root.remove()};
  });

  // Room links can be dropped into the existing visible lobby.
  register('room-link-drop',s=>s==='lobby'||s==='servers',()=>{
    const target=document.querySelector('.interface,.servers');
    if(!target)return;
    function drag(event){if(event.dataTransfer?.types?.includes('text/plain'))event.preventDefault();}
    function drop(event){
      if(!event.isTrusted||!event.dataTransfer?.types?.includes('text/plain'))return;
      const url=safeRoom(event.dataTransfer.getData('text/plain'));
      if(!url)return;
      // Existing client navigation already validates the URL on the native side.
      event.preventDefault();event.stopPropagation();
      if(window.__KS_DEEP__?.join)window.__KS_DEEP__.join(url,false);
      else if(window.__KS_NATIVE__?.post)window.__KS_NATIVE__.post({type:'game-join',url});
      else if(window.CefSharp?.PostMessage)window.CefSharp.PostMessage(JSON.stringify({type:'game-join',url}));
      emit('quick-join',{url});
    }
    target.addEventListener('dragover',drag);
    target.addEventListener('drop',drop);
    return ()=>{target.removeEventListener('dragover',drag);target.removeEventListener('drop',drop)};
  });

  // Only show a spectate shortcut when the existing friend UI exposes a valid
  // game link. No inferred/private links, no account API or auto-join.
  register('friend-spectate',s=>s==='friends',()=>{
    const list=document.querySelector('.friends .list');
    if(!list)return;
    const tracked=new Set();
    function scan(){
      for(const card of list.querySelectorAll('.friend')){
        if(card.querySelector('[data-ks-spectate]'))continue;
        const online=card.querySelector('.online');
        if(!card.classList.contains('is-online')||!online||!/in game/i.test(online.textContent||''))continue;
        const link=online.querySelector('a[href]')?.href ||
          (online.textContent||'').match(/https:\/\/(?:www\.)?kirka\.io\/(?:games\/|hub\/ranked|servers\/)[^\s)]+/)?.[0];
        const url=safeRoom(link);
        if(!url)continue;
        const button=document.createElement('button');
        button.type='button';button.dataset.ksSpectate='1';button.textContent='Spectate';
        button.style.cssText='margin-left:8px;font:600 11px Segoe UI;color:#f0aa35;background:#141a25;border:1px solid #f0aa35;border-radius:4px;padding:4px 6px;cursor:pointer;';
        button.addEventListener('click',e=>{
          if(!e.isTrusted)return;
          e.stopPropagation();
          // Spectate must use Kirka's actual spectator action, never plain Join.
          if(window.__KS_DEEP__?.join)window.__KS_DEEP__.join(url,true);
        });
        online.insertAdjacentElement('afterend',button);tracked.add(button);
      }
    }
    const observer=new MutationObserver(scan);
    observer.observe(list,{childList:true,subtree:true});
    scan();
    return ()=>{observer.disconnect();for(const el of tracked)el.remove()};
  });

  register('pointer-lock-diagnostics',s=>s==='match',()=>{
    let last=Boolean(document.pointerLockElement);
    const report=message=>{
      const payload={type:'game-input-diagnostics',message};
      try{
        if(window.__KS_NATIVE__?.post)window.__KS_NATIVE__.post(payload);
        else if(window.CefSharp?.PostMessage)window.CefSharp.PostMessage(JSON.stringify(payload));
      }catch(_){}
    };
    const changed=()=>{
      last=Boolean(document.pointerLockElement);
      report(last?'locked':'released');
      emit('pointer-lock',{locked:last});
    };
    const failed=()=>{status.errors.pointerLock='Native browser or game rejected pointer lock';report('pointerlockerror');emit('pointer-lock',{locked:false,error:true})};
    document.addEventListener('pointerlockchange',changed);
    document.addEventListener('pointerlockerror',failed);
    return ()=>{document.removeEventListener('pointerlockchange',changed);document.removeEventListener('pointerlockerror',failed)};
  });

  let observer=null, timer=null, queued=false, unsubscribeRuntime=null;
  function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;if(document.body)refresh()},120)}
  function start(){
    if(status.started||!document.body)return;
    status.started=true;
    observer=new MutationObserver(schedule);
    // Only watch top-level page children. A deep body observer fires on
    // nearly every gameplay HUD update and can harm FPS.
    observer.observe(document.body,{subtree:false,childList:true});
    window.addEventListener('popstate',schedule);
    window.addEventListener('hashchange',schedule);
    unsubscribeRuntime=window.__KS_GAME_RUNTIME__?.on?.('scene',schedule)||null;
    timer=setInterval(refresh,1200);
    refresh();
  }
  function stop(){
    observer?.disconnect();clearInterval(timer);unsubscribeRuntime?.();unsubscribeRuntime=null;
    window.removeEventListener('popstate',schedule);
    window.removeEventListener('hashchange',schedule);
    for(const [name,m] of modules)detach(name,m);
    status.started=false;
  }
  window.__KS_INTEGRATION__=Object.freeze({
    getStatus:()=>({scene:status.scene,active:[...status.healthy],errors:{...status.errors},
      checks:status.checks,started:status.started,render:window.__KS_RENDER_OBSERVER__?.getStatus?.()||null,
      gameRuntime:window.__KS_GAME_RUNTIME__?.getStatus?.()||null,
      drawTelemetry:window.__KS_RENDER_TELEMETRY__?.getStatus?.()||null}),
    on, refresh, stop, safeRoom
  });
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();