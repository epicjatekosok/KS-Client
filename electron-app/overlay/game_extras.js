/* KS Client alpha 1.1.11 - optional, game-page-only integrations.
   All modules are visual/read-only and require no Node.js or page privileges.
   Features should never steal game input or consume pointer events.
*/
(() => {
  'use strict';
  if(window.__KS_GAME_EXTRAS__)return;
  if(location.protocol!=='https:' || !['kirka.io','www.kirka.io'].includes(location.hostname))return;
  const KEY='ksclient.settings.alpha';
  const match=()=>/^\/(games\/|hub\/ranked)/.test(location.pathname);
  function settings(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return {}}}
  let state=settings();
  const root=document.createElement('div');
  root.id='ks-game-extras';
  root.style.cssText='position:fixed;inset:0;z-index:2147483640;pointer-events:none;contain:layout style;';
  const shadow=root.attachShadow({mode:'closed'});
  shadow.innerHTML='<style>:host{pointer-events:none}#keys{position:absolute;bottom:86px;left:18px;display:none;gap:5px;align-items:center;color:#f7f7f7;font:700 12px Segoe UI,Arial,sans-serif;pointer-events:none;} .key{display:grid;place-items:center;width:35px;height:33px;background:#111b;border:1px solid #f0aa3566;border-radius:6px} .key.down{color:#131313;background:#f0aa35;border-color:#f0aa35}#stats{position:absolute;bottom:130px;left:18px;display:none;color:#f0aa35;background:#0a0a0ac9;padding:7px 11px;border:1px solid #f0aa3566;border-radius:7px;font:700 11px Segoe UI,sans-serif;white-space:nowrap}</style><div id="keys"><span class="key" data-code="KeyW">W</span><span class="key" data-code="KeyA">A</span><span class="key" data-code="KeyS">S</span><span class="key" data-code="KeyD">D</span><span class="key" data-code="Space">⎵</span><span class="key" data-code="ShiftLeft">⇧</span></div><div id="stats">Game stats: waiting for HUD</div>';
  let domReady=false;
  function install(){if(domReady||!document.body)return;domReady=true;document.body.appendChild(root);refresh();}
  const pressed=new Set();
  const keys=shadow.getElementById('keys'),stats=shadow.getElementById('stats');
  const nativeCursor=()=>Boolean(document.pointerLockElement);
  function inGame(){return match() && !document.querySelector('#ks-client-root')?.shadowRoot?.querySelector('#ks-dimmer.visible');}
  function refresh(){
    state=settings();
    if(!domReady)return;
    keys.style.display=state.gameKeystrokes && inGame()?'flex':'none';
    stats.style.display=state.gameStats && inGame()?'block':'none';
    const color=/^#[0-9a-f]{6}$/i.test(state.gameHitmarkerColor||'')?state.gameHitmarkerColor:'#ffb42d';
    const size=Math.max(12,Math.min(48,Number(state.gameHitmarkerSize)||24));
    const old=document.getElementById('ks-hitmarker-css');
    if(!state.gameHitmarker||!match()){old?.remove();}
    else {
      const css=old||Object.assign(document.createElement('style'),{id:'ks-hitmarker-css'});
      // Only HTML-based hitmarkers; never read or patch internal WebGL state.
      css.textContent='.hitmark,.hitmarker{filter:drop-shadow(0 0 2px '+color+')!important;max-width:'+size+'px!important;max-height:'+size+'px!important}';
      if(!css.isConnected)document.head.appendChild(css);
    }
  }
  function updateKeys(){
    for(const el of keys.querySelectorAll('[data-code]'))el.classList.toggle('down',pressed.has(el.dataset.code));
  }
  document.addEventListener('keydown',e=>{if(!e.repeat)pressed.add(e.code);updateKeys();},true);
  document.addEventListener('keyup',e=>{pressed.delete(e.code);updateKeys();},true);
  window.addEventListener('blur',()=>{pressed.clear();updateKeys();},true);
  document.addEventListener('pointerlockchange',()=>{refresh();},true);
  document.addEventListener('pointerlockerror',()=>{console.warn('[KS Client] Game mouse capture denied by browser or game');},true);
  // A click on the actual game canvas is a real user gesture. No synthetic mouse
  // events or forced pointer lock from timers; the game owns the movement loop.
  document.addEventListener('pointerdown',event=>{
    if(event.button!==0 || !event.isTrusted || !match() || !state.gameAutoMouseCapture || !inGame() || nativeCursor())return;
    const canvas=event.target;
    if(!(canvas instanceof HTMLCanvasElement))return;
    if(canvas.clientWidth<160 || canvas.clientHeight<100)return;
    if(typeof canvas.requestPointerLock==='function') {
      try {
        const pending=canvas.requestPointerLock();
        if(pending && typeof pending.catch==='function')pending.catch(()=>{});
      } catch(_){}
    }
  },true);
  function firstText(selectors){
    for(const selector of selectors){
      const el=document.querySelector(selector);
      if(!el)continue;
      const content=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(content && content.length<48)return content;
    }
    return '';
  }
  let lastStats=0;
  function updateStats(){
    if(!domReady || !state.gameStats || !inGame())return;
    const kills=firstText(['.ui-cell.kill .cell-value','.kill-death .kill .cell-value']);
    const deaths=firstText(['.ui-cell.death .cell-value','.kill-death .death .cell-value']);
    const assists=firstText(['.ui-cell.assists .cell-value']);
    const hs=firstText(['.ui-cell.hsp .cell-value','.hs-percentage']);
    const shown=[];
    if(kills)shown.push('Kills: '+kills);
    if(deaths)shown.push('Deaths: '+deaths);
    if(assists)shown.push('Assists: '+assists);
    if(hs)shown.push('HS: '+hs);
    stats.textContent=shown.length?shown.join(' · '):'Kirka HUD data not exposed as HTML';
  }
  function loop(ts){
    if(ts-lastStats>1200){lastStats=ts;updateStats();refresh();}
    requestAnimationFrame(loop);
  }
  window.__KS_GAME_EXTRAS__=Object.freeze({refresh,getStatus:()=>({
    pointerLocked:nativeCursor(),game:match(),keystrokes:!!state.gameKeystrokes,
    stats:!!state.gameStats,hitmarker:!!state.gameHitmarker
  })});
  if(document.body)install();else document.addEventListener('DOMContentLoaded',install,{once:true});
  requestAnimationFrame(loop);
})();
