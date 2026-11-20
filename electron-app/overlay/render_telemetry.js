/* KS 1.1.16 - passive WebGL draw telemetry; engine-agnostic renderer
   diagnostics. No depth edits, shaders, geometry copying or wallhacks. */
(() => {
'use strict';
if(location.protocol!=='https:' || !['kirka.io','www.kirka.io'].includes(location.hostname) || window.__KS_RENDER_TELEMETRY__)return;
let status={attached:0,drawCalls:0,drawArrays:0,drawElements:0,instanced:0,textureBinds:0,
  matrixUpdates:0,clearCalls:0,errors:0,drawsPerSecond:0,contextLost:0,contextRestored:0};
let active=false,contexts=new WeakSet();
const restoreFns=[],matrixCandidates=new Map();
let unsub=null,heartbeat=null,windowDraws=0,lastWindow=performance.now();
function attach(gl,canvas) {
 if(!gl||canvas.id!=='game'||contexts.has(gl))return;
 contexts.add(gl);status.attached++;
 function wrap(key,fn){
   const orig=gl[key];if(typeof orig!=='function')return;
   const wrapped=function(...args){
     try{fn(args)}catch(_){status.errors++}
     return Reflect.apply(orig,this,args);
   };
   try{gl[key]=wrapped;if(gl[key]===wrapped)restoreFns.push(()=>{if(gl[key]===wrapped)gl[key]=orig});}
   catch(_){status.errors++}
 }
 function draw(type,instanced=false){
   status.drawCalls++;windowDraws++;status[type]++;if(instanced)status.instanced++;
 }
 wrap('drawArrays',()=>draw('drawArrays'));
 wrap('drawElements',()=>draw('drawElements'));
 wrap('drawArraysInstanced',()=>draw('drawArrays',true));
 wrap('drawElementsInstanced',()=>draw('drawElements',true));
 wrap('bindTexture',()=>{status.textureBinds++});
 wrap('clear',()=>{status.clearCalls++});
 wrap('uniformMatrix4fv',args=>{
   status.matrixUpdates++;
   const data=args[2],offset=Number.isInteger(args[3])?args[3]:0;
   if(!data||data.length-offset<16||status.matrixUpdates%36!==0)return;
   // Fingerprints are for compatibility research, not automatic object
   // identification: without live Kirka calibration no weapon claim is made.
   if(matrixCandidates.size>=48)return;
   const m=Array.prototype.slice.call(data,offset,offset+16);
   if(m.some(x=>!Number.isFinite(x)))return;
   const signature=[0,5,10,12,13,14].map(i=>Number(m[i]).toFixed(3)).join(',');
   matrixCandidates.set(signature,(matrixCandidates.get(signature)||0)+1);
 });
 for(const [name,key] of [['webglcontextlost','contextLost'],['webglcontextrestored','contextRestored']]){
   const handler=()=>{status[key]++;};
   canvas.addEventListener(name,handler);
   restoreFns.push(()=>canvas.removeEventListener(name,handler));
 }
}
function connect(){
 if(!active || unsub || !window.__KS_RENDER_OBSERVER__?.onContext)return;
 unsub=window.__KS_RENDER_OBSERVER__.onContext(attach);
}
function sample(){
 const now=performance.now();const secs=Math.max(.1,(now-lastWindow)/1000);
 status.drawsPerSecond=Math.round(windowDraws/secs);
 windowDraws=0;lastWindow=now;
}
function setActive(value){
 if(active===Boolean(value))return;
 active=Boolean(value);
 if(active){
   windowDraws=0;lastWindow=performance.now();
   window.addEventListener('ks-render-observer-ready',connect);
   connect();heartbeat=setInterval(sample,1100);
 }else{
   clearInterval(heartbeat);window.removeEventListener('ks-render-observer-ready',connect);
   unsub?.();unsub=null;
   while(restoreFns.length)try{restoreFns.pop()()}catch(_){status.errors++}
   contexts=new WeakSet();status.attached=0;status.drawsPerSecond=0;
 }
}
window.__KS_RENDER_TELEMETRY__=Object.freeze({
 setActive,getStatus:()=>({...status,active,registry:window.__KS_RENDER_OBSERVER__?.getStatus?.()||null}),
 getCandidates:()=>[...matrixCandidates.entries()].map(([signature,count])=>({signature,count,identifiedAs:'unknown'})).slice(0,48),
 stop:()=>setActive(false)
});
})();
