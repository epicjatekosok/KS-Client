'use strict';
const {BrowserWindow,ipcMain,dialog,nativeImage}=require('electron');
const {pathToFileURL}=require('node:url');
const path=require('node:path'),fs=require('node:fs/promises');
const swap=require('./swapper.cjs');
const local=path.join(__dirname,'assets','gallery.html'),url=pathToFileURL(local).href;
let win,observed=[];
function open(parent,paths){
  observed=Array.isArray(paths)?paths.filter(p=>typeof p==='string'&&p.startsWith('/assets/')&&p.length<240).slice(0,100):[];
  if(win&&!win.isDestroyed()){win.focus();return;}
  win=new BrowserWindow({parent,title:'KS Workshop Gallery',width:910,height:690,autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,'gallery-preload.cjs'),sandbox:true,nodeIntegration:false,contextIsolation:true,partition:'ks-gallery'}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.on('closed',()=>{win=null;});
  win.loadFile(local);
}
ipcMain.handle('ks:gallery',async(e,op,id,file,value)=>{
  if(!win||e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame||e.senderFrame.url!==url)throw Error('Gallery is closed');
  const owner=win,store=swap.packs();
  switch(op){
    case 'list':return {packs:store.list(),observed};
    case 'pack':store.import(value);break;
    case 'folder':{
      const r=await dialog.showOpenDialog(owner,{properties:['openDirectory']});
      if(!r.canceled)store.import(swap.fromFolder(r.filePaths[0],path.basename(r.filePaths[0])));break;
    }
    case 'export':{
      const doc=store.export(id),r=await dialog.showSaveDialog(owner,{defaultPath:'KS-pack.json'});
      if(!r.canceled)await fs.writeFile(r.filePath,JSON.stringify(doc));break;
    }
    case 'thumbnail':{
      const bytes=store.read(id,file);
      if(!/\.(png|jpe?g|webp|gif)$/i.test(file))throw Error('Unsupported thumbnail');
      const img=nativeImage.createFromBuffer(bytes);
      if(img.isEmpty())throw Error('Invalid image');
      return img.resize({width:80}).toDataURL();
    }
    case 'media':return store.read(id,file);
    case 'rename':case 'enable':case 'favorite':store.edit(id,file,op,value);break;
    case 'gain':store.sound(id,file,value.percent,value.bytes?Buffer.from(value.bytes):null);break;
    case 'toggle':case 'remove':case 'first':store.change(id,op);break;
    default:throw Error('Unknown gallery command');
  }
  return true;
});
module.exports={open};
