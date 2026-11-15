/* KS Client 1.1.14 – visible-state event hub and native Kirka UI integration.
   Never reads hidden player coordinates, cookies, tokens or private endpoints. */
(() => {
'use strict';
if(location.protocol!=='https:'||!['kirka.io','www.kirka.io'].includes(location.hostname)||window.__KS_DEEP__)return;
const listeners=new Map(), tracked=new WeakSet(), observers=[], errors={};
const emit=(name,detail)=>{for(const fn of listeners.get(name)||[]){try{fn(detail)}catch(_){}}};
const on=(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return()=>listeners.get(name)?.delete(fn)};
const trim=(x,n=100)=>String(x??'').replace(/\s+/g,' ').trim().slice(0,n);
const safeRoom=v=>{
 try{const u=new URL(v);return u.protocol==='https:'&&['kirka.io','www.kirka.io'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&
 /^\/(?:games\/|hub\/ranked|servers\/)/.test(u.pathname)?u.href:'';}catch(_){return ''}
};
const nativePost=message=>{try{
 if(window.__KS_NATIVE__?.post)window.__KS_NATIVE__.post(message);
 else if(window.CefSharp?.PostMessage)window.CefSharp.PostMessage(JSON.stringify(message));
 }catch(_){}};
let lastError='',lastJoin='',joinMode='none',matchId='',stats={kills:null,deaths:null,assists:null,headshotPercent:null},seenKills=0,seenAssists=0,seenHS=0,viewState='';
function scene(){return window.__KS_INTEGRATION__?.getStatus()?.scene||'unknown';}
function number(sel){const el=document.querySelector(sel);if(!el)return null;const n=Number(trim(el.textContent,16).replace('%',''));return Number.isFinite(n)&&n>=0?n:null}
function readStats(){
 const prev=JSON.stringify(stats);
 stats={kills:number('.ui-cell.kill .cell-value,.kill-death .kill .cell-value'),
 deaths:number('.ui-cell.death .cell-value,.kill-death .death .cell-value'),
 assists:number('.ui-cell.assists .cell-value'),
 headshotPercent:number('.ui-cell.hsp .cell-value,.hs-percentage')};
 if(JSON.stringify(stats)!==prev)emit('stats',{...stats,source:'visible HUD'});
}
function ingestFeed(root,kind){
 if(!root)return;
 const parse=node=>{
   if(!(node instanceof Element)||tracked.has(node))return;
   if(node.matches('.kill-bar-item,.ach-item,.achievement,.slide-fade-enter-active')||node.querySelector('.kill-bar-item,.ach-item,.achievement,.slide-fade-enter-active')){
      tracked.add(node);
      const message=trim(node.textContent,180);
      if(!message)return;
      if(kind==='ach'){
        if(/\bassist\b/i.test(message)){seenAssists++;emit('assist',{source:'visible achievement',message});}
        if(/\bheadshot\b/i.test(message)){seenHS++;emit('headshot',{source:'visible achievement',message});}
      }else {
        seenKills++;emit('killfeed',{source:'visible killfeed',message});
      }
   }
 };
 const observer=new MutationObserver(changes=>{for(const c of changes)for(const node of c.addedNodes)parse(node)});
 observer.observe(root,{childList:true,subtree:true});observers.push(observer);
}
let feedRoot=null,achRoot=null;
function attachFeeds(){
 const f=document.querySelector('.kill-bar-cont'),a=document.querySelector('.ach-cont');
 if(f!==feedRoot){feedRoot=f;if(f)ingestFeed(f,'kill');}
 if(a!==achRoot){achRoot=a;if(a)ingestFeed(a,'ach');}
}
function profileSnapshot(){
 const panel=document.querySelector('.profile-cont,.card-profile,.profile-page');
 if(!panel)return null;
 return {nickname:trim(panel.querySelector('.nickname,.username,.player-name')?.textContent,60)||null,
  visibleBadges:[...panel.querySelectorAll('[title],[aria-label]')].map(x=>trim(x.getAttribute('title')||x.getAttribute('aria-label'),50)).filter(Boolean).slice(0,12)};
}
function inventorySnapshot(){
 const rows=[...document.querySelectorAll('.inventory .item-card,.inventory-item,.inventory .item')].slice(0,150);
 const unique=new Set(),items=[];
 for(const row of rows){
  const name=trim(row.querySelector('.name,.item-name')?.textContent||row.querySelector('img')?.alt||row.getAttribute('title'),70);
  if(!name||unique.has(name))continue;
  unique.add(name);items.push(name);
 }
 return {visibleCount:items.length,items:items.slice(0,50),source:'visible inventory elements, not a market API'};
}
function serverSnapshot(){
 const rows=[...document.querySelectorAll('.server-item,.servers .list > *, .server')].slice(0,70);
 return {visibleCount:rows.length,items:rows.map(el=>trim(el.textContent,90)).filter(Boolean).slice(0,25)};
}
function getSnapshot(){
 return {scene:scene(),stats:{...stats},observed:{assists:seenAssists,headshotAchievements:seenHS,killfeedItems:seenKills},
  profile:profileSnapshot(),inventory:inventorySnapshot(),servers:serverSnapshot(),
  render:window.__KS_WEBGL_COSMETICS__?.getStatus?.()||null,
  input:{pointerLocked:!!document.pointerLockElement},
  source:'visible Kirka.io DOM; absence means unavailable'};
}
function showError(message){lastError=trim(message,190);emit('notice',{message:lastError});}
function waitFor(selector,ms=1600){
 return new Promise(resolve=>{
  const current=document.querySelector(selector);if(current){resolve(current);return;}
  let done=false;
  const finish=node=>{if(done)return;done=true;clearTimeout(timer);o.disconnect();resolve(node)};
  const o=new MutationObserver(()=>{const n=document.querySelector(selector);if(n)finish(n)});
  o.observe(document.documentElement,{subtree:true,childList:true});
  const timer=setTimeout(()=>finish(null),ms);
 });
}
function setInput(el,value){
 const descriptor=Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value');
 if(descriptor?.set)descriptor.set.call(el,value);else el.value=value;
 el.dispatchEvent(new Event('input',{bubbles:true}));
 el.dispatchEvent(new Event('change',{bubbles:true}));
}
let joining=false;
async function join(value,spectate=false){
 const room=safeRoom(value);if(!room){showError('Invalid Kirka.io room URL');return false;}
 if(joining)return false;
 joining=true;lastJoin=room;joinMode=spectate?'spectate':'join';
 try{
  // Prefer the game's own Join UI, including its real spectator choice.
  const open=document.querySelector('#join-btn');
  if(open){
    open.click();
    const input=await waitFor('#join-modal-modal .input, #join-modal-modal input');
    if(!input){showError('Native Kirka join modal did not open');return false;}
    setInput(input,room);
    await new Promise(resolve=>setTimeout(resolve,80));
    const modal=document.querySelector('#join-modal-modal');
    if(!modal){showError('Join modal closed before submission');return false;}
    const buttons=[...modal.querySelectorAll('button,.btn')].filter(el=>el.getClientRects().length);
    let button=spectate?buttons.find(x=>/spectat|watch|néz/i.test(trim(x.textContent,40))):buttons.find(x=>/\bjoin\b|csatlako/i.test(trim(x.textContent,40)));
    if(spectate&&!button){showError('This Kirka version has no visible native Spectate button');return false;}
    if(!spectate&&!button)button=buttons.find(x=>x.classList.contains('btn'))||null;
    if(!button){showError('Native join button unavailable');return false;}
    button.click();emit(spectate?'spectate':'join',{room,through:'native Kirka dialog'});return true;
  }
  if(spectate){showError('Spectate needs Kirka native join modal; plain navigation would join as a player');return false;}
  nativePost({type:'game-join',url:room});emit('join',{room,through:'validated native navigation'});return true;
 }catch(e){showError('Join UI unavailable: '+trim(e.message,120));return false}
 finally{joining=false}
}
function addProfileNote(){
 const el=document.querySelector('.profile-cont,.card-profile,.profile-page');if(!el||el.querySelector('[data-ks-deep-profile]'))return;
 const note=document.createElement('div');note.dataset.ksDeepProfile='true';
 note.style.cssText='color:#e8b657;font:11px Segoe UI,Arial;margin:5px 0;pointer-events:none';
 note.textContent='KS Client: visible profile integration active';el.appendChild(note);
}
function addInventoryCount(){
 const el=document.querySelector('.inventory .items,.inventory .item-list,.inventory');if(!el||el.querySelector('[data-ks-deep-inventory]'))return;
 const note=document.createElement('div');note.dataset.ksDeepInventory='true';
 note.style.cssText='color:#e8b657;font:11px Segoe UI,Arial;margin:4px 0;pointer-events:none';
 const count=inventorySnapshot().visibleCount;note.textContent='KS Client: '+count+' visible inventory items (not account total)';
 el.prepend(note);
}
let timer=null;
function refresh(){
 const current=scene();
 if(matchId!==location.pathname){matchId=location.pathname;seenAssists=0;seenHS=0;seenKills=0;stats={kills:null,deaths:null,assists:null,headshotPercent:null};}
 if(current!==viewState){emit('scene',{from:viewState,to:current});viewState=current;}
 if(current==='match'){readStats();attachFeeds();}
 if(current==='profile')addProfileNote();
 if(current==='inventory')addInventoryCount();
}
function destroy(){clearInterval(timer);for(const o of observers)o.disconnect();observers.length=0;listeners.clear();}
window.__KS_DEEP__=Object.freeze({getSnapshot,getStatus:()=>({scene:scene(),lastError,lastJoin,joinMode,observers:observers.length}),join,on,refresh,destroy});
timer=setInterval(refresh,1000);if(document.body)refresh();else document.addEventListener('DOMContentLoaded',refresh,{once:true});
})();