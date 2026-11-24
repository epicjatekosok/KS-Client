'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), os=require('node:os'),path=require('node:path');
const {createStore}=require('../electron-app/resource-packs.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ks-media-'));
const wav=Buffer.alloc(46);wav.write('RIFF');wav.write('WAVEfmt ',8);wav.write('data',36);
const name='audio/test.wav',pack={format:'ks-resource-pack',name:'Audio preset',version:1,author:'KS',files:[{path:name,data:wav.toString('base64')}]};
try{
  let s=createStore(root);s.import(pack);const id=s.list()[0].id;
  s.change(id,'toggle');s.edit(id,name,'favorite');s.edit(id,null,'rename','New name');
  s.sound(id,name,0,wav);assert(s.resolve(name).endsWith('.ks-gain.wav'));
  s=createStore(root);assert.equal(s.list()[0].details[0].gain,0);
  s.edit(id,name,'enable');assert.equal(s.resolve(name),null);
  s.edit(id,name,'enable');s.sound(id,name,100);assert(s.resolve(name).endsWith('test.wav'));
  assert(s.read(id,name).equals(wav));assert.equal(s.export(id).author,'KS');
  assert.throws(()=>s.read(id,'../../config'));assert.throws(()=>s.import({...pack,api:2}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log('PASS gallery persistence, sound gain, restore, allowed file boundaries and shared pack compatibility');
const vm=require('node:vm');
function analytics(storage,clock){
  const events={},listeners={};
  const window={__KS_GAME_RUNTIME__:{scene:'lobby',on:(name,callback)=>{events[name]=callback;}},addEventListener:(k,fn)=>{listeners[k]=fn;}};
  class Clock extends Date{constructor(...a){super(...(a.length?a:[clock.time]));}static now(){return clock.time;}}
  const context={Date:Clock,window,document:{hidden:false,hasFocus:()=>true,querySelector:()=>({textContent:'EU'}),addEventListener(){}},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},structuredClone};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../electron-app/overlay/analytics.js'),'utf8'),context);
  return {events,listeners,stats:window.__KS_ANALYTICS__};
}
const db=new Map(),clock={time:new Date(2026,9,5,23,59,58).getTime()};
const a=analytics(db,clock);a.events.refresh();clock.time+=1000;a.events.scene({detail:{to:'match'}});
clock.time+=4000;a.events.scene({detail:{to:'results'}});a.listeners.pagehide();
const b=analytics(db,clock);const d=b.stats.exportData();
assert.equal(d.completed,1);assert.equal(d.completedMs,4000);assert.equal(Object.keys(d.days).length,2);
assert.equal(Object.values(d.days).reduce((n,x)=>n+x.regions.EU,0),4000);
b.stats.reset();assert.equal(b.stats.exportData().completed,0);
const {createService}=require('../electron-app/kirka-stats.cjs');
(async()=>{
  let count=0,now=1000;
  const svc=createService(async()=>{if(++count>1)throw Error('offline');return '[]';},()=>now);
  assert.equal((await svc.get('latency','eu')).data.lastSuccess,1000);
  assert.equal((await svc.get('latency','eu')).data.httpMs>=0,true);assert.equal(count,1);
  now+=60000;const missing=(await svc.get('latency','eu')).data;assert.equal(missing.httpMs,null);assert.equal(missing.lastSuccess,1000);
  await assert.rejects(svc.get('latency','invalid'));console.log('PASS cross-midnight analytics, restart, reset and regional latency caching');
})().catch(e=>{console.error(e);process.exitCode=1;});
