/* KS Client Beta 1.0.0 - optional, game-page-only integrations.
   All modules are visual/read-only and require no Node.js or page privileges.
   Features should never steal game input or consume pointer events.
*/
(() => {
  'use strict';
  // Additional HUD helpers only observe Kirka.io's existing DOM; no hidden
  // game state, WebGL geometry, network packets or automated inputs are read.
  if(window.__KS_GAME_EXTRAS__)return;
  if(location.protocol!=='https:' || !['kirka.io','www.kirka.io'].includes(location.hostname))return;
  const KEY='ksclient.settings.alpha';
  const match=()=>window.__KS_GAME_RUNTIME__ ? window.__KS_GAME_RUNTIME__.scene==='match' : /^\/(games\/|hub\/ranked)/.test(location.pathname);
  let cachedText, cachedSettings = {};
  function settings(){
    try {
      const text = localStorage.getItem(KEY);
      if(text!==cachedText){cachedSettings=JSON.parse(text||'{}');cachedText=text;}
      return cachedSettings;
    } catch { return {}; }
  }
  let state=settings();
  const root=document.createElement('div');
  root.id='ks-game-extras';
  root.style.cssText='position:fixed;inset:0;z-index:2147483640;pointer-events:none;contain:layout style;';
  const shadow=root.attachShadow({mode:'closed'});
  shadow.innerHTML='<style>:host{pointer-events:none} #keys{position:absolute;bottom:86px;left:18px;display:none;gap:6px;align-items:center;color:#f8f8fa;font:760 12px "Segoe UI",Arial,sans-serif;pointer-events:none;filter:drop-shadow(0 6px 25px rgba(0,0,0,.38));} .key{display:grid;place-items:center;min-width:36px;height:36px;padding:0 6px;color:#fff;background:rgba(14,13,13,.92);border:1px solid rgba(255,157,24,.60);border-radius:10px;font:760 12px/1 "Segoe UI",Arial,sans-serif;box-sizing:border-box;transition:background .12s ease,border-color .12s ease,color .12s ease,transform .12s ease;} .key.down{color:#17100a;background:linear-gradient(105deg,#ff7900,#ffad00);border-color:#ffc146;transform:translateY(-1px);} #stats{position:absolute;bottom:130px;left:18px;display:none;max-width:calc(100vw - 36px);color:#fff;background:rgba(14,13,13,.92);padding:10px 13px;border:1px solid rgba(255,157,24,.60);border-left:3px solid #ff9200;border-radius:10px;font:760 12px/1.45 "Segoe UI",Arial,sans-serif;white-space:nowrap;box-shadow:0 6px 25px rgba(0,0,0,.38);font-variant-numeric:tabular-nums;} @media(prefers-reduced-motion:reduce){.key{transition:none!important;}}</style><div id="keys"><span class="key" data-code="KeyW">W</span><span class="key" data-code="KeyA">A</span><span class="key" data-code="KeyS">S</span><span class="key" data-code="KeyD">D</span><span class="key" data-code="Space">⎵</span><span class="key" data-code="ShiftLeft">⇧</span></div><div id="stats"></div>';
  let domReady=false;
  function install(){if(domReady||!document.body)return;domReady=true;document.body.appendChild(root);refresh();}
  let assistsCount=0,headshotCount=0,observedAchievements=null,observedKills=null;
  const handledKills=new WeakSet(),handledAchievements=new WeakSet();
  let observerA=null,observerK=null,lastLocation=location.pathname;
  function updateObservers(){
    if(!match())return;
    const ach=document.querySelector('.ach-cont');
    if(ach!==observedAchievements){
      observerA?.disconnect();observedAchievements=ach;
      if(ach){
        observerA=new MutationObserver(changes=>{
          for(const change of changes){
            for(const node of change.addedNodes){
              if(!(node instanceof Element)||handledAchievements.has(node))continue;
              handledAchievements.add(node);
              const line=String(node.textContent||'').toUpperCase().slice(0,120);
              if(/\bASSIST\b/.test(line))assistsCount++;
            }
          }
        });
        observerA.observe(ach,{childList:true,subtree:true});
      }
    }
    const list=document.querySelector('.kill-bar-cont');
    if(list!==observedKills){
      observerK?.disconnect();observedKills=list;
      if(list){
        observerK=new MutationObserver(changes=>{
          for(const change of changes){
            for(const node of change.addedNodes){
              if(!(node instanceof Element)||handledKills.has(node))continue;
              handledKills.add(node);
              const me=String(document.querySelector('.team-section .nickname,.auth-user .username')?.textContent||'').trim();
              const killer=String(node.querySelector('.killer-name')?.textContent||'').trim();
              if(me && killer && me===killer && node.querySelector('.skull,.svg-icon--__skull__'))headshotCount++;
            }
          }
        });
        observerK.observe(list,{childList:true,subtree:true});
      }
    }
  }
  const pressed=new Set();
  const keys=shadow.getElementById('keys'),stats=shadow.getElementById('stats');
  const nativeCursor=()=>Boolean(document.pointerLockElement);
  let lockErrors=0,relativeMoves=0;
  // The KS shadow tree is closed; direct shadowRoot inspection always fails.
  // Read the public, read-only settings state instead of capturing clicks under
  // a visible menu.
  function inGame(){return match() && window.__KS_CLIENT__?.isSettingsOpen?.()!==true;}
  function refresh(){
    state=settings();
    if(!domReady)return;
    if(document.body && root.parentNode!==document.body)document.body.appendChild(root);
    keys.style.display=state.gameKeystrokes && inGame()?'flex':'none';
    const pos=['bottom-left','bottom-right','top-left','top-right'].includes(state.gameKeysPosition)?state.gameKeysPosition:'bottom-left';
    const scale=Math.max(70,Math.min(170,Number(state.gameKeysScale)||100))/100;
    keys.style.left=pos.endsWith('left')?'18px':'auto';
    keys.style.right=pos.endsWith('right')?'18px':'auto';
    keys.style.bottom=pos.startsWith('bottom')?'86px':'auto';
    keys.style.top=pos.startsWith('top')?'95px':'auto';
    keys.style.transform='scale('+scale+')';
    keys.style.transformOrigin=pos.replace('-',' ');

    stats.style.display=state.gameStats && inGame() && !!stats.textContent?'block':'none';
  }
  function updateKeys(){
    if(!state.gameKeystrokes)return;
    for(const el of keys.querySelectorAll('[data-code]'))el.classList.toggle('down',pressed.has(el.dataset.code));
  }
  document.addEventListener('keydown',e=>{if(!e.repeat){pressed.add(e.code);updateKeys();}},true);
  document.addEventListener('keyup',e=>{pressed.delete(e.code);updateKeys();},true);
  window.addEventListener('blur',()=>{pressed.clear();updateKeys();},true);
  document.addEventListener('pointerlockchange',()=>{
    refresh();

    if(nativeCursor()){
      relativeMoves=0;
      document.addEventListener('mousemove',countMove,{capture:true,passive:true});
    }else document.removeEventListener('mousemove',countMove,true);
  },true);
  document.addEventListener('pointerlockerror',()=>{
    lockErrors++;

    console.warn('[KS Client] Pointer lock failed: inspect native focus and permissions');
  },true);
  function countMove(event){
    if(!event.isTrusted)return;
    if(event.movementX===0&&event.movementY===0)return;
    relativeMoves++;
  }
  if(nativeCursor())document.addEventListener('mousemove',countMove,{capture:true,passive:true});
  function firstText(selectors){
    for(const selector of selectors){
      const el=document.querySelector(selector);
      if(!el)continue;
      const content=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(content && content.length<48)return content;
    }
    return '';
  }
  function updateStats(){
    if(!domReady || !state.gameStats || !inGame()){stats.textContent='';stats.style.display='none';return;}
    const shared=window.__KS_GAME_RUNTIME__?.getSnapshot().stats;
    const kills=shared?(shared.kills==null?'':String(shared.kills)):firstText(['.ui-cell.kill .cell-value','.kill-death .kill .cell-value']);
    const deaths=shared?(shared.deaths==null?'':String(shared.deaths)):firstText(['.ui-cell.death .cell-value','.kill-death .death .cell-value']);
    const assists=shared?(shared.assists==null?'':String(shared.assists)):firstText(['.ui-cell.assists .cell-value']);
    const hs=shared?(shared.headshotPercent==null?'':shared.headshotPercent+'%'):firstText(['.ui-cell.hsp .cell-value','.hs-percentage']);
    const shown=[];
    const tr=label=>window.__KS_CLIENT__?.translate(label) ?? label;
    if(kills)shown.push(tr('Kills:')+' '+kills);
    if(deaths)shown.push(tr('Deaths:')+' '+deaths);
    if(assists)shown.push(tr('Assists:')+' '+assists);
    if(hs)shown.push(tr('HS:')+' '+hs);
    if(assistsCount && !assists)shown.push(tr('Assists:')+' '+assistsCount);
    if(headshotCount)shown.push(tr('HS:')+' '+headshotCount+(kills&&Number(kills)>0?' ('+Math.round(100*headshotCount/Number(kills))+'%)':''));
    const text=shown.join(' · ');
    if(stats.textContent!==text)stats.textContent=text;
    stats.style.display=shown.length?'block':'none';
  }
  function tick(){
    if(document.hidden)return;
    if(lastLocation!==location.pathname){lastLocation=location.pathname;assistsCount=0;headshotCount=0;}
    refresh();
    if(!window.__KS_GAME_RUNTIME__ && match())updateObservers();
    else {
      observerA?.disconnect();observerK?.disconnect();
      observedAchievements=null;observedKills=null;
    }
    updateStats();
  }
  window.__KS_GAME_EXTRAS__=Object.freeze({refresh,getStatus:()=>({
    pointerLocked:nativeCursor(),game:match(),lockErrors,relativeMoves,
    keystrokes:!!state.gameKeystrokes,
    stats:!!state.gameStats
  })});
  if(document.body)install();else document.addEventListener('DOMContentLoaded',install,{once:true});
  if(window.__KS_GAME_RUNTIME__){
    const runtime=window.__KS_GAME_RUNTIME__;
    runtime.on('refresh',tick);
    runtime.on('stats',updateStats);
    runtime.on('route',()=>{assistsCount=headshotCount=0;lastLocation=location.pathname;});
    runtime.on('match-view-leave',()=>{assistsCount=headshotCount=0;});
    runtime.on('killfeed',e=>{if(e.detail.localHeadshot){headshotCount++;updateStats();}});
    runtime.on('achievement',e=>{if(/\bassist\b/i.test(e.detail.text)){assistsCount++;updateStats();}});
  }
  else setInterval(tick,1200);
})();
