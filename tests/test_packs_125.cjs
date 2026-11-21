'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createStore,validate,fromFolder}=require('../electron-app/resource-packs.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ks-packs-'));
const png='iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8v5SBgYGBiYGBgYGBAQAU2QGo4jF1qQAAAABJRU5ErkJggg==';
const doc={format:'ks-resource-pack',version:1,name:'Test',files:[{path:'textures/rifle.ks-anyhash.png',data:png}]};
try{
  const store=createStore(root);store.import(doc);store.import({...doc,name:'Other'});
  const [a,b]=store.list();assert.equal(store.resolve('textures/rifle.01234567.png'),null);
  store.change(a.id,'toggle');store.change(b.id,'toggle');assert(store.resolve('textures/rifle.01234567.png').includes(a.id));
  assert.equal(store.list()[1].conflicts,1);store.change(b.id,'first');assert(store.resolve('textures/rifle.01234567.png').includes(b.id));
  assert.equal(store.list()[0].matched,1);assert.deepEqual(store.export(a.id),doc);
  const reopened=createStore(root);assert(reopened.resolve('textures/rifle.01234567.png').includes(b.id));
  assert.deepEqual(fromFolder(path.join(root,a.id),'Test'),doc);
  reopened.change(b.id,'remove');assert(reopened.resolve('textures/rifle.01234567.png').includes(a.id));
  for(const file of [{path:'../bad.png',data:png},{path:'ui/test.js',data:png},{path:'ui/logo.png',data:'aGVsbG8='},{path:'ui/con.png',data:png}]){
    assert.throws(()=>validate({...doc,files:[file]}));
  }
  assert.throws(()=>validate({...doc,files:[...doc.files,...doc.files]}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
