// Portable packs contain only validated passive media. The lookup index stores paths, not asset buffers.
'use strict';
const fs=require('node:fs'), path=require('node:path');
const {randomUUID}=require('node:crypto');
const MAX_BYTES=12*1024*1024, MAX_FILES=128, MAX_PACKS=12;
const categories={
  img:['png','jpg','jpeg','webp','gif'],ui:['png','jpg','jpeg','webp','gif'],
  textures:['png','jpg','jpeg','webp'],skins:['png','jpg','jpeg','webp'],
  audio:['mp3','wav','ogg'],media:['mp3','wav','ogg'],fonts:['woff','woff2','ttf','otf']
};
function validPath(name){
  if(typeof name!=='string'||name.length>220)return false;
  const parts=name.split('/'),ext=path.posix.extname(name).slice(1).toLowerCase();
  return parts.length>=2 && parts.length<=9 && Object.hasOwn(categories,parts[0]) &&
    categories[parts[0]].includes(ext) && parts.every(p=>/^[a-z0-9_-][a-z0-9_. -]{0,79}$/i.test(p)
      && !/[. ]$/.test(p) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p));
}
function signature(name,b){
  const ext=path.extname(name).toLowerCase(),start=b.toString('latin1',0,4);
  switch(ext){
    case '.png':return b.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
    case '.jpg':case '.jpeg':return b[0]===255&&b[1]===216&&b[2]===255;
    case '.gif':return ['GIF87a','GIF89a'].includes(b.toString('ascii',0,6));
    case '.webp':case '.wav':return start==='RIFF'&&b.toString('ascii',8,12)===(ext==='.wav'?'WAVE':'WEBP');
    case '.mp3':return start.startsWith('ID3')||(b[0]===255&&(b[1]&224)===224);
    case '.ogg':return start==='OggS';
    case '.woff':return start==='wOFF';
    case '.woff2':return start==='wOF2';
    case '.otf':return start==='OTTO';
    case '.ttf':return b.subarray(0,4).toString('hex')==='00010000';
    default:return false;
  }
}
function validate(doc){
  if(doc?.format!=='ks-resource-pack'||doc.version!==1||typeof doc.name!=='string'||!doc.name.trim()||
     !Array.isArray(doc.files)||!doc.files.length||doc.files.length>MAX_FILES)throw Error('Invalid pack manifest');
  let bytes=0;const seen=new Set();
  return doc.files.map(entry=>{
    if(!validPath(entry?.path)||seen.has(entry.path.toLowerCase())||typeof entry.data!=='string'||
      !entry.data.length||entry.data.length>Math.ceil((MAX_BYTES-bytes)/3)*4)throw Error('Invalid or duplicate pack entry');
    const data=Buffer.from(entry.data,'base64');bytes+=data.length;
    if(bytes>MAX_BYTES||data.toString('base64')!==entry.data||!signature(entry.path,data))throw Error('Invalid media: '+entry.path);
    seen.add(entry.path.toLowerCase());return {name:entry.path,data};
  });
}
function createStore(root){
  const index=path.join(root,'index.json'),matches=new Map(),observed=new Set();
  let packs=[];
  try{packs=JSON.parse(fs.readFileSync(index,'utf8')).filter(p=>/^[a-f0-9-]{36}$/.test(p.id)&&Array.isArray(p.files)&&p.files.every(validPath)).slice(0,MAX_PACKS);}
  catch(e){if(e.code!=='ENOENT')throw Error('Cannot read resource pack index');}
  function rebuild(){
    matches.clear();
    for(const p of packs.filter(p=>p.enabled))for(const n of p.files){
      if(!matches.has(n))matches.set(n,[]);
      matches.get(n).push({id:p.id,file:path.join(root,p.id,...n.split('/'))});
    }
  }
  function commit(next){
    fs.mkdirSync(root,{recursive:true});
    const temp=index+'.'+randomUUID();
    try{fs.writeFileSync(temp,JSON.stringify(next));fs.renameSync(temp,index);}
    finally{fs.rmSync(temp,{force:true});}
    packs=next;rebuild();
  }
  rebuild();
  return {
    list:()=>packs.map(p=>{
      const details=p.files.map(n=>{
        const available=fs.existsSync(path.join(root,p.id,...n.split('/')));
        const shadowed=p.enabled&&matches.get(n)?.[0]?.id!==p.id;
        return {path:n,available,shadowed,matched:observed.has(p.id+'/'+n)};
      });
      return {id:p.id,name:p.name,enabled:p.enabled,total:details.length,
        matched:details.filter(f=>f.matched).length,conflicts:details.filter(f=>f.shadowed).length,details};
    }),
    import(doc){
      if(packs.length>=MAX_PACKS)throw Error('Maximum 12 packs');
      const files=validate(doc),id=randomUUID(),dir=path.join(root,id);
      fs.mkdirSync(dir,{recursive:true});
      try{
        for(const {name,data} of files){const file=path.join(dir,...name.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data,{flag:'wx'});}
        commit([...packs,{id,name:doc.name.trim().slice(0,60),enabled:false,files:files.map(f=>f.name)}]);
      }catch(e){fs.rmSync(dir,{recursive:true,force:true});throw e;}
    },
    change(id,op){
      const p=packs.find(p=>p.id===id);if(!p)throw Error('Unknown resource pack');
      if(op==='toggle')commit(packs.map(x=>x===p?{...x,enabled:!x.enabled}:x));
      else if(op==='first')commit([p,...packs.filter(x=>x!==p)]);
      else if(op==='remove'){commit(packs.filter(x=>x!==p));fs.rmSync(path.join(root,id),{recursive:true,force:true});}
      else throw Error('Unknown pack operation');
    },
    resolve(name){
      const hash=name.replace(/[.-][a-f0-9]{8,64}(\.[a-z0-9]+)$/i,'.ks-anyhash$1');
      for(const key of new Set([name,hash])){
        for(const rec of matches.get(key)||[]){
          try{
            if(!fs.realpathSync(rec.file).startsWith(fs.realpathSync(root)+path.sep+rec.id+path.sep))continue;
            observed.add(rec.id+'/'+key);return rec.file;
          }catch{/* A removed file yields to the next matching pack. */}
        }
      }
      return null;
    },
    export(id){
      const p=packs.find(p=>p.id===id);if(!p)throw Error('Unknown resource pack');
      return fromFolder(path.join(root,id),p.name,p.files);
    }
  };
}
function fromFolder(dir,name,provided){
  const base=fs.realpathSync(dir),files=[];let size=0;
  function add(n){
    const file=path.join(base,...n.split('/')),st=fs.lstatSync(file);
    if(!validPath(n)||!st.isFile()||fs.realpathSync(file)!==file||(size+=st.size)>MAX_BYTES||files.length>=MAX_FILES)throw Error('Unsupported or oversized pack entry: '+n);
    files.push({path:n,data:fs.readFileSync(file).toString('base64')});
  }
  function walk(relative,depth){
    if(depth>8)throw Error('Pack nesting is too deep');
    for(const e of fs.readdirSync(path.join(base,relative),{withFileTypes:true})){
      const n=relative?relative+'/'+e.name:e.name;
      if(e.isDirectory())walk(n,depth+1);else add(n);
    }
  }
  if(provided)provided.forEach(add);else walk('',0);
  const doc={format:'ks-resource-pack',version:1,name,files};validate(doc);return doc;
}
module.exports={createStore,fromFolder,validate};
