'use strict';
// Run in the downloaded Windows Electron runtime against the actual isolated preload and IPC handlers.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ks-gallery-smoke-'));
process.env.LOCALAPPDATA=temp;
app.setPath('userData',path.join(temp,'profile'));
app.whenReady().then(async()=>{
  const host=new BrowserWindow({show:false});await host.loadURL('about:blank');
  await require('../electron-app/gallery.cjs').open(host,[]);
  const win=BrowserWindow.getAllWindows().find(w=>w!==host),wc=win.webContents;
  if(wc.isLoading()||!wc.getURL())await new Promise(resolve=>wc.once('did-finish-load',resolve));
  const result=await wc.executeJavaScript(`(async()=>{
    const rpc=window.gallery.request;
    if(typeof require!=='undefined')throw Error('Node exposed to gallery');
    const doc={format:'ks-resource-pack',version:1,name:'Sample',files:[{path:'img/sample.png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJmsAAAAASUVORK5CYII='}]};
    await rpc('pack',null,null,doc);const list=await rpc('list'),id=list.packs[0].id;
    const media=await rpc('media',id,'img/sample.png');
    let denied=false;try{await rpc('media',id,'../host.json');}catch{denied=true;}
    await rpc('favorite',id,'img/sample.png');
    await rpc('retarget',id,'img/sample.png','img/other.png');
    const saved=(await rpc('list')).packs[0];
    return {bytes:media.length,denied,path:saved.details[0].path,favorite:saved.details[0].favorite,preload:typeof rpc};
  })()`);
  assert(result.bytes>60&&result.denied&&result.favorite&&result.path==='img/other.png'&&result.preload==='function');
  win.destroy();host.destroy();fs.writeFileSync(process.env.KS_RESOLUTION_RESULT,'PASS Windows Gallery IPC, sandbox and media round trip');
  app.exit(0);
}).catch(e=>{fs.writeFileSync(process.env.KS_RESOLUTION_RESULT,String(e.stack));app.exit(1);});
