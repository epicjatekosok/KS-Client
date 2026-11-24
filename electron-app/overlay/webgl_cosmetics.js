/* KS 1.1.14 – opt-in, render-only WebGL cosmetics.
   Exact image URL match or explicitly calibrated matrix signature is required.
   No packet access, hidden-geometry rendering, depth changes or aim assistance. */
(() => {
'use strict';
if(location.protocol!=='https:'||!['kirka.io','www.kirka.io'].includes(location.hostname)||window.__KS_WEBGL_COSMETICS__)return;
const KEY='ksclient.webgl.v114', hooked=new WeakSet(), records=new Set();
const defaults={enabled:false,assetURL:'',skinURL:'',hue:0,saturation:100,brightness:100,scale:100,offsetX:0,offsetY:0,offsetZ:0,matrixSignature:''};
let cfg={...defaults}, diagnostic='', draws=0, textures=0, transforms=0, contexts=0, missed=0, scanCount=0, candidates=new Map();
const clamp=(v,lo,hi,base)=>Number.isFinite(Number(v))?Math.min(hi,Math.max(lo,Number(v))):base;
const safeURL=s=>{
 if(typeof s!=='string'||!s.trim())return '';
 try{const u=new URL(s,location.href);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:'';}catch(_){return '';}
};
const asset=s=>{const u=safeURL(s);return /^https:\/\/(?:www\.)?kirka\.io\/assets\/(?:img|media|textures|skins|ui)\/[^?#]+$/i.test(u)?u:''};
const skin=s=>typeof s==='string'&&s.length<=180000&&/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(s)?s:safeURL(s);
const uploadHistory=new Map();
let hasBoundPoses=false,discovery=false,weaponPoses={},selectionRoot=null,selectedName='',selectionObserver=null;
const visible=el=>!!el?.getClientRects().length&&getComputedStyle(el).visibility==='visible';
function selectedWeapon(){
 const cards=[...document.querySelectorAll('.weapon-cont .bottom.is-selected')].filter(visible);
 if(cards.length!==1)return null;
 const card=cards[0].closest('.weapon-cont');
 const name=card?.querySelector('.weapon-name')?.textContent.trim().slice(0,48);
 return name?{name,card}:null;
}
function refreshSelection(){
 const root=document.querySelector('.list-weapons')||document.querySelector('.weapon-cont')?.parentElement||null;
 if(root!==selectionRoot){
   selectionObserver?.disconnect();selectionRoot=root;
   if(root){selectionObserver=new MutationObserver(refreshSelection);selectionObserver.observe(root,{subtree:true,attributes:true,attributeFilter:['class','hidden','style'],childList:true,characterData:true});}
 }
 selectedName=selectedWeapon()?.name||'';
}
function previewURL(){
 const selected=selectedWeapon();
 const nodes=selected?[...selected.card.querySelectorAll('img')]:[...document.querySelectorAll('.weapon-preview img,.weapon-card[aria-selected="true"] img')];
 const urls=new Set(nodes.filter(visible).map(img=>asset(img.dataset.ksWorkshopOriginal||img.currentSrc||img.src)).filter(Boolean));
 return urls.size===1?[...urls][0]:'';
}
// Historical public asset fingerprints. Accept only a file uploaded by this game
// session on the allowlisted origin. A changed game asset simply stops matching.
const defaultTextures=Object.freeze({scar:'b3fc7981',ar9:'1794de31',mac10:'36d894bd',m60:'b658c822',
 tomahawk:'397a3f05',vita:'b2a49027',shark:'6c8a6582',revolver:'0bed9187',bayonet:'76c24e59',lar:'d97db214',weatie:'212a85fe'});
const sessionCounts=new Map();
function observedDefault(name){
 const hash=defaultTextures[String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'')];
 if(!hash)return '';
 const hits=[...uploadHistory.keys()].filter(url=>{
   const file=new URL(url).pathname.split('/').pop().toLowerCase();
   return file==='texture.'+hash+'.webp'||file==='texture.'+hash+'.png';
 });
 return hits.length===1?hits[0]:'';
}
function verifiedPreview(){
 const url=previewURL();
 if(url&&(uploadHistory.has(url)||previewProbe?.matched&&previewProbe.url===url))return url;
 return observedDefault(selectedWeapon()?.name);
}
let slots=[],images=new Map(),imageGeneration=0;
function read(){
 let o={};try{o=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){}
 discovery=o.discover===true;
 weaponPoses=Object.create(null);
 for(const b of (Array.isArray(o.weaponPoses)?o.weaponPoses:[]).slice(0,32)){
   if(typeof b?.name!=='string'||!b.name.trim()||b.name.length>48||!/^[-\d., ]{1,90}$/.test(b.signature))continue;
   weaponPoses[b.name]={signature:b.signature,scale:clamp(b.scale,50,150,100),x:clamp(b.x,-80,80,0)/100,y:clamp(b.y,-80,80,0)/100,z:clamp(b.z,-80,80,0)/100,angles:['rx','ry','rz'].map(k=>clamp(b[k],-180,180,0)*Math.PI/180)};
 }
 hasBoundPoses=Object.keys(weaponPoses).length>0;
 slots=Array.isArray(o.slots)?o.slots.slice(0,8).filter(p=>p&&asset(p.assetURL)&&skin(p.skinURL)):[];
 cfg={enabled:o.enabled===true,assetURL:asset(o.assetURL),skinURL:skin(o.skinURL),
 hue:clamp(o.hue,0,360,0),saturation:clamp(o.saturation,20,300,100),
 brightness:clamp(o.brightness,20,250,100),scale:clamp(o.scale,50,150,100),
 offsetX:clamp(o.offsetX,-2,2,0),offsetY:clamp(o.offsetY,-2,2,0),offsetZ:clamp(o.offsetZ,-2,2,0),
 matrixSignature:/^[\d., -]{1,90}$/.test(String(o.matrixSignature||''))?String(o.matrixSignature):''};
}
let previewProbe=null,probeTimeout=null;
function syncTexture(r){
 const needed=!!(previewProbe&&!previewProbe.matched&&performance.now()<=previewProbe.until)||cfg.enabled||discovery;
 if(needed&&r.gl.texImage2D===r.origTex)r.gl.texImage2D=r.tex;
 if(!needed&&r.gl.texImage2D===r.tex)r.gl.texImage2D=r.origTex;
}
function updateTextureHooks(){for(const r of records)syncTexture(r);}

function matchVisiblePreview(){
 const url=previewURL();
 clearTimeout(probeTimeout);
 if(!url){previewProbe=null;updateTextureHooks();return 'Open a single visible weapon preview to identify its image.';}
 previewProbe={url,until:performance.now()+15000,matched:uploadHistory.has(url)};
 if(previewProbe.matched)return 'Confirmed by an earlier game texture upload.';
 updateTextureHooks();
 probeTimeout=setTimeout(()=>{if(!previewProbe?.matched)previewProbe=null;updateTextureHooks();},15000);
 return 'Watching game texture uploads for this exact preview image for 15 seconds.';
}
function loadImage(){
 images=new Map();
 const generation=++imageGeneration;
 if(!cfg.enabled)return;
 // The active form takes priority over saved bindings for the same source.
 const mappings=new Map();
 for(const p of [...slots,cfg])if(asset(p.assetURL)&&skin(p.skinURL))mappings.set(p.assetURL,p);
 for(const [url,p] of mappings){
   const img=new Image();img.crossOrigin='anonymous';
   img.onload=()=>{
     if(generation!==imageGeneration)return;
     if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth>2048||img.naturalHeight>2048){diagnostic='Image outside 1–2048px bounds';return;}
     try{
       const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
       const ctx=c.getContext('2d');if(!ctx)return;
       ctx.filter='hue-rotate('+clamp(p.hue,0,360,0)+'deg) saturate('+clamp(p.saturation,20,300,100)+'%) brightness('+clamp(p.brightness,20,250,100)+'%)';
       ctx.drawImage(img,0,0);ctx.getImageData(0,0,1,1);images.set(url,c);
       diagnostic='Cosmetic image ready';
     }catch{diagnostic='Image unavailable for local processing';}
   };
   img.onerror=()=>{if(generation===imageGeneration)diagnostic='Skin URL could not be loaded with CORS';};
   img.src=p.skinURL;
 }
}
function syncMatrix(record){
 const {gl,matrix,origMatrix}=record;
 if(cfg.enabled && gl.uniformMatrix4fv===origMatrix)gl.uniformMatrix4fv=matrix;
 if(!cfg.enabled && gl.uniformMatrix4fv===matrix)gl.uniformMatrix4fv=origMatrix;
}
function reload(){read();if(hasBoundPoses)refreshSelection();else{selectionObserver?.disconnect();selectionRoot=null;selectedName='';}loadImage();for(const record of records){syncMatrix(record);syncTexture(record);}}
reload();
let fallbackOriginal=null, fallbackWrapped=null, unsubscribe=null, hookup='not-installed';
function install(gl,canvas){
 if(!gl||hooked.has(gl))return;
 hooked.add(gl);contexts++;
 const rawTex=gl.texImage2D, rawMatrix=gl.uniformMatrix4fv;
 const origTex=(...args)=>Reflect.apply(rawTex,gl,args);
 const origMatrix=(...args)=>Reflect.apply(rawMatrix,gl,args);
 function tex(...args){
   // Only TexImageSource overloads with real DOM image provenance are supported.
   const index=args.length===6?5:args.length===9?8:-1;
   const src=args[index];
   if(index>=0 && typeof HTMLImageElement!=='undefined' && src instanceof HTMLImageElement){
     const url=asset(src.currentSrc||src.src);
     if(url){
       if(discovery||previewProbe||cfg.enabled){
         uploadHistory.delete(url);uploadHistory.set(url,true);
         if(uploadHistory.size>256)uploadHistory.delete(uploadHistory.keys().next().value);
       }
       if(previewProbe&&performance.now()<=previewProbe.until&&previewProbe.url===url)previewProbe.matched=true;
       const replacement=cfg.enabled&&images.get(url);
       if(replacement){
         // Keep the original upload geometry on sized WebGL2 subresources.
         if(index===8&&(args[3]!==replacement.width||args[4]!==replacement.height))missed++;
         else try{const copy=args.slice();copy[index]=replacement;const output=origTex(...copy);textures++;sessionCounts.set(url,(sessionCounts.get(url)||0)+1);if(sessionCounts.size>128)sessionCounts.delete(sessionCounts.keys().next().value);return output;}
         catch{missed++;diagnostic='Upload rejected; using original image';}
       }
     }
   }
   return origTex(...args);
 }
 const fingerprint=m=>[0,5,10,12,13,14].map(i=>Number(m[i]).toFixed(3)).join(',');
 function matrix(location,transpose,data,offset,length){
   // Observe only the game's own canvas. Do not probe other 3D objects,
   // rewrite depth state, or transform anything without manual signature.
   if(!cfg.enabled)return Reflect.apply(rawMatrix,this,arguments);
   if(data&&data.length>=16){
     try{
       const base=Number.isInteger(offset)?offset:0;
       const bound=selectionRoot?.isConnected&&weaponPoses[selectedName];
       const signature=hasBoundPoses?(bound?.signature||''):cfg.matrixSignature;
       const sample=scanCount++%80===0 && candidates.size<45;
       if((length?length===16:data.length-base===16) && !transpose && (sample||signature)){
         const m=Array.prototype.slice.call(data,base,base+16);
         const fp=fingerprint(m);
         if(sample){
           candidates.set(fp,(candidates.get(fp)||0)+1);
         }
         if(cfg.enabled&&signature&&fp===signature){
           const copy=new Float32Array(m),scale=(bound?bound.scale:cfg.scale)/100;
           if(bound){
             const pairs=[[4,8],[8,0],[0,4]];
             for(const [axis,angle] of bound.angles.entries()){
               if(!angle)continue;
               const [a,b]=pairs[axis],c=Math.cos(angle),s=Math.sin(angle);
               for(let i=0;i<3;i++){const u=copy[a+i],v=copy[b+i];copy[a+i]=c*u+s*v;copy[b+i]=c*v-s*u;}
             }
           }
           for(const j of [0,1,2,4,5,6,8,9,10])copy[j]*=scale;
           copy[12]+=bound?bound.x:cfg.offsetX;copy[13]+=bound?bound.y:cfg.offsetY;copy[14]+=bound?bound.z:cfg.offsetZ;
           try{const value=origMatrix(location,transpose,copy);transforms++;return value}
           catch(e){missed++;diagnostic='Matrix fallback: '+String(e.message).slice(0,100)}
         }
       }
     }catch(_){}
   }
   return Reflect.apply(rawMatrix,this,arguments);
 }
 try{
  const record={gl,origTex:rawTex,origMatrix:rawMatrix,tex,matrix};
  records.add(record);syncMatrix(record);syncTexture(record);
 }catch(e){diagnostic='Read-only WebGL context; hook refused: '+String(e.message).slice(0,100)}
 canvas.addEventListener('webglcontextlost',()=>{imageGeneration++;images.clear();diagnostic='Context lost, awaiting recovery'},{passive:true});
 canvas.addEventListener('webglcontextrestored',()=>reload(),{passive:true});
}
// Prefer the shared early observer. It replays contexts which already existed
// before the cosmetic module loaded, so no late getContext() call is necessary.
function connect(){
 const shared=window.__KS_RENDER_OBSERVER__;
 if(shared?.onContext&&hookup!=='shared'){
   unsubscribe?.();
   unsubscribe=shared.onContext((gl,canvas)=>{try{install(gl,canvas)}catch(e){diagnostic='Renderer attach error: '+String(e.message).slice(0,100)}});
   hookup='shared';
   // If a fallback wrapper was installed first, it remains in the chain but
   // WeakSet prevents duplicate hooks; no existing GPU contexts are created.
 }
}
function installFallback(){
 if(window.__KS_RENDER_OBSERVER__?.onContext)return connect();
 fallbackOriginal=HTMLCanvasElement.prototype.getContext;
 fallbackWrapped=function(kind,...args){
   const gl=Reflect.apply(fallbackOriginal,this,[kind,...args]);
   if((kind==='webgl'||kind==='webgl2'||kind==='experimental-webgl')&&this.id==='game')try{install(gl,this)}catch(_){}
   return gl;
 };
 try{
   HTMLCanvasElement.prototype.getContext=fallbackWrapped;
   hookup='late-fallback';
   diagnostic='Early render registry unavailable: late fallback observes future context calls only';
 }catch(e){diagnostic='WebGL fallback hook failed: '+String(e.message).slice(0,100)}
}
connect();
if(hookup!=='shared')installFallback();
const refreshOff=window.__KS_GAME_RUNTIME__?.on?.('refresh',()=>{if(hasBoundPoses&&(!selectionRoot||!selectionRoot.isConnected))refreshSelection();});
window.addEventListener('ks-render-observer-ready',connect);
window.addEventListener('ks-webgl-settings',reload);
window.__KS_WEBGL_COSMETICS__=Object.freeze({
 selectedWeapon:()=>selectedWeapon()?.name||'',
 verifiedPreview,
 compatibility:()=>{const url=verifiedPreview();return {gameCanvasContexts:contexts,weapon:selectedWeapon()?.name||null,observedTexture:!!url,observedFile:url?new URL(url).pathname.split('/').pop():null,replacementsForTexture:sessionCounts.get(url)||0,allMatrixTransforms:transforms,uploadFallbacks:missed};},
 getStatus:()=>({selectedWeapon:selectedWeapon()?.name||'',observedImages:uploadHistory.size,discovery,enabled:cfg.enabled,contexts,hookup,textureReplacements:textures,matrixTransforms:transforms,
  fallbacks:missed,ready:images.size>0,readyMappings:images.size,diagnostic,assetURL:cfg.assetURL,signature:cfg.matrixSignature,
  sampledSignatures:[...candidates.entries()].map(([signature,count])=>({signature,count})).slice(0,20)}),
 matchVisiblePreview,
 matchedPreview:verifiedPreview,
 refresh:reload,
 restore:()=>{refreshOff?.();selectionObserver?.disconnect();clearTimeout(probeTimeout);unsubscribe?.();window.removeEventListener('ks-render-observer-ready',connect);window.removeEventListener('ks-webgl-settings',reload);for(const r of records){if(r.gl.texImage2D===r.tex)r.gl.texImage2D=r.origTex;if(r.gl.uniformMatrix4fv===r.matrix)r.gl.uniformMatrix4fv=r.origMatrix;}if(fallbackWrapped&&HTMLCanvasElement.prototype.getContext===fallbackWrapped)HTMLCanvasElement.prototype.getContext=fallbackOriginal;}
});
})();