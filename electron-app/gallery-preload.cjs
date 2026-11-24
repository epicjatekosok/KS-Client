'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('gallery',{request:(operation,id,file,value)=>ipcRenderer.invoke('ks:gallery',operation,id,file,value)});
