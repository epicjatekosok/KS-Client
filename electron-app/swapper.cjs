'use strict';
// Exact-path, opt-in resource replacements for Kirka.io's /assets tree.
// No JavaScript/HTML replacement and no interception of authentication/API requests.
const {app,session,protocol,shell} = require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const ROOT=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'KSClient');
const SETTINGS=path.join(ROOT,'resource-swap.json');
const FOLDER=path.join(app.getPath('documents'),'KSClient','Swapper','assets');
const TYPES=Object.freeze({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif',
 '.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.css':'text/css'});
const ALLOWED=Object.freeze({img:new Set(['.png','.jpg','.jpeg','.webp','.gif','.svg']),
 textures:new Set(['.png','.jpg','.jpeg','.webp','.gif']),skins:new Set(['.png','.jpg','.jpeg','.webp']),
 ui:new Set(['.png','.jpg','.jpeg','.webp','.gif','.svg']),audio:new Set(['.mp3','.wav','.ogg']),
 fonts:new Set(['.woff','.woff2','.ttf','.otf']),
 media:new Set(['.mp3','.wav','.ogg']),css:new Set(['.css'])});
let cachedEnabled=false,readAfter=0;
const counts={served:0,unmatched:0,failed:0};
function settings(){
 if(Date.now()<readAfter)return cachedEnabled;
 try{cachedEnabled=JSON.parse(fs.readFileSync(SETTINGS,'utf8')).enabled===true;}catch(_){cachedEnabled=false;}
 readAfter=Date.now()+1000;
 return cachedEnabled;
}
function setEnabled(enabled){fs.mkdirSync(ROOT,{recursive:true});fs.writeFileSync(SETTINGS,JSON.stringify({enabled:enabled===true}),{mode:0o600});readAfter=0;return settings()}
function folder(){for(const sub of Object.keys(ALLOWED))fs.mkdirSync(path.join(FOLDER,sub),{recursive:true});return FOLDER}
function resolve(request){
 try{
  const u=new URL(request);
  if(u.protocol!=='https:'|| !['kirka.io','www.kirka.io'].includes(u.hostname)||u.username||u.password||u.port)return null;
  const parts=u.pathname.split('/').filter(Boolean).map(x=>decodeURIComponent(x));
  if(parts.length<3||parts[0]!=='assets'||!Object.hasOwn(ALLOWED,parts[1])||parts.some(x=>x==='.'||x==='..'||x.includes('\\')||x.includes('/')||x.includes('\0')))return null;
  const rel=parts.slice(1), ext=path.extname(rel[rel.length-1]).toLowerCase();
  if(!ALLOWED[parts[1]].has(ext))return null;
  const root=path.resolve(FOLDER),candidate=path.resolve(root,...rel);
  if(!candidate.startsWith(root+path.sep))return null;
  const physical=fs.realpathSync(candidate),realRoot=fs.realpathSync(root);
  if(!physical.startsWith(realRoot+path.sep))return null;
  const st=fs.lstatSync(candidate);
  if(!st.isFile()||st.isSymbolicLink()||st.size===0||st.size>16*1024*1024)return null;
  return {file:candidate,mime:TYPES[ext]};
 }catch(_){return null}
}
function scan(){
 folder();let count=0,bytes=0;
 function walk(dir,level){
  if(level>8)return;
  for(const f of fs.readdirSync(dir,{withFileTypes:true})){
   if(f.isSymbolicLink())continue;
   const p=path.join(dir,f.name);
   if(f.isDirectory())walk(p,level+1);
   else if(f.isFile()&&Object.hasOwn(TYPES,path.extname(p).toLowerCase())){count++;bytes+=fs.statSync(p).size}
  }
 }
 walk(FOLDER,0);return {count,bytes,folder:FOLDER,enabled:settings(),...counts};
}
function registerSchemes(){
 protocol.registerSchemesAsPrivileged([{scheme:'ksclient-asset',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:false,stream:true}}]);
}
function install(log=()=>{}){
 folder();
 protocol.handle('ksclient-asset',async(request)=>{
  const original=new URL(request.url).searchParams.get('origin');
  const mapped=original&&settings()?resolve(original):null;
  if(!mapped)return new Response('Not found',{status:404});
  try{
   const bytes=await fs.promises.readFile(mapped.file);counts.served++;
   return new Response(bytes,{status:200,headers:{
     'Content-Type':mapped.mime,'Access-Control-Allow-Origin':'https://kirka.io','Cache-Control':'no-store'
   }});
  }catch(e){counts.failed++;log('Local asset failed: '+e.message);return new Response('Not found',{status:404})}
 });
 session.defaultSession.webRequest.onBeforeRequest({
  urls:['https://kirka.io/assets/*','https://www.kirka.io/assets/*']
 },(details,done)=>{
  if(!settings()||!['image','media','stylesheet','font','xhr','other'].includes(details.resourceType))return done({});
  const match=resolve(details.url);
  if(!match){counts.unmatched++;return done({});}
  const next='ksclient-asset://asset.local/?origin='+encodeURIComponent(details.url);
  done({redirectURL:next});
 });
 log('KS resource swapper ready; '+scan().count+' local files');
}
module.exports={install,folder,scan,setEnabled,registerSchemes,resolve};
