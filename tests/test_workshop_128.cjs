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
