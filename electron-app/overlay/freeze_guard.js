/* KS Client 1.1.14 - optional frame-yield workaround for sustained mouse-down freezes.
   Does not alter game state; disabled by default; restart/reload required to apply.
   Keeps cancelAnimationFrame semantics and resets held state on blur. */
(() => {
'use strict';
if(location.protocol!=='https:'||!['kirka.io','www.kirka.io'].includes(location.hostname)||window.__KS_FREEZE_GUARD__)return;
const key='ksclient.advanced.v114';
let enabled=false;
try{enabled=JSON.parse(localStorage.getItem(key)||'{}').freezeGuard===true}catch(_){}
const original=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
const pending=new Map(),jobs=[],channel=enabled?new MessageChannel():null;let held=false,seq=0,lastHop=0,hops=0;
if(channel)channel.port1.onmessage=()=>{const job=jobs.shift();if(job)job();};
const mouse=e=>{held=(e.buttons&1)!==0;};
if(enabled){
window.addEventListener('mousedown',mouse,{capture:true,passive:true});
window.addEventListener('mouseup',mouse,{capture:true,passive:true});
window.addEventListener('mousemove',mouse,{capture:true,passive:true});
window.addEventListener('blur',()=>{held=false;},{passive:true});
}
const request=callback=>{
 if(!enabled||!held||performance.now()-lastHop<8)return original(callback);
 lastHop=performance.now();
 const id=--seq,record={native:0};pending.set(id,record);
 jobs.push(()=>{if(!pending.has(id))return;
   record.native=original(time=>{pending.delete(id);callback(time)});
 });
 channel.port2.postMessage(null);hops++;return id;
};
const cancelRequest=id=>{
 if(id>=0)return cancel(id);
 const item=pending.get(id);if(item){pending.delete(id);if(item.native)cancel(item.native);}
};
if(enabled){window.requestAnimationFrame=request;window.cancelAnimationFrame=cancelRequest;}
window.__KS_FREEZE_GUARD__=Object.freeze({getStatus:()=>({enabled,held,hops,pending:pending.size}),
 restore:()=>{if(window.requestAnimationFrame===request)window.requestAnimationFrame=original;
   if(window.cancelAnimationFrame===cancelRequest)window.cancelAnimationFrame=cancel;enabled=false;
   window.removeEventListener('mousedown',mouse,true);window.removeEventListener('mouseup',mouse,true);
   window.removeEventListener('mousemove',mouse,true);}});
})();