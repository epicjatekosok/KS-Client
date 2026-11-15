/* KS 1.1.14 – opt-in, render-only WebGL cosmetics.
   Exact image URL match or explicitly calibrated matrix signature is required.
   No packet access, hidden-geometry rendering, depth changes or aim assistance. */
(() => {
'use strict';
if(location.protocol!=='https:'||!['kirka.io','www.kirka.io'].includes(location.hostname)||window.__KS_WEBGL_COSMETICS__)return;
const KEY='ksclient.webgl.v114', hooked=new WeakSet(), records=new Set();
const defaults={enabled:false,assetURL:'',skinURL:'',hue:0,saturation:100,brightness:100,scale:100,offsetX:0,offsetY:0,offsetZ:0,matrixSignature:''};
let cfg={...defaults}, replacement=null, replacementFor='', diagnostic='', draws=0, textures=0, transforms=0, contexts=0, missed=0, scanCount=0, candidates=new Map();
const clamp=(v,lo,hi,base)=>Number.isFinite(Number(v))?Math.min(hi,Math.max(lo,Number(v))):base;
const safeURL=s=>{
 try{const u=new URL(String(s),location.href);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:'';}catch(_){return '';}
};
const asset=s=>{const u=safeURL(s);return /^https:\/\/(?:www\.)?kirka\.io\/assets\/(?:img|media|textures|skins|ui)\/[^?#]+$/i.test(u)?u:''};
function read(){
 let o={};try{o=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){}
 cfg={enabled:o.enabled===true,assetURL:asset(o.assetURL),skinURL:safeURL(o.skinURL),
 hue:clamp(o.hue,0,360,0),saturation:clamp(o.saturation,20,300,100),
 brightness:clamp(o.brightness,20,250,100),scale:clamp(o.scale,50,150,100),
 offsetX:clamp(o.offsetX,-2,2,0),offsetY:clamp(o.offsetY,-2,2,0),offsetZ:clamp(o.offsetZ,-2,2,0),
 matrixSignature:/^[\d., -]{1,90}$/.test(String(o.matrixSignature||''))?String(o.matrixSignature):''};
}
function loadImage(){
 replacement=null;replacementFor='';
 if(!cfg.enabled||!cfg.assetURL||!cfg.skinURL)return;
 const img=new Image();img.crossOrigin='anonymous';
 const expected=cfg.skinURL;
 img.onload=()=>{
   if(!cfg.enabled||cfg.skinURL!==expected)return;
   if(img.naturalWidth<1||img.naturalHeight<1||img.naturalWidth>2048||img.naturalHeight>2048){diagnostic='Image outside 1–2048px bounds';return;}
   try{
     const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
     const ctx=c.getContext('2d');if(!ctx)return;
     ctx.filter='hue-rotate('+cfg.hue+'deg) saturate('+cfg.saturation+'%) brightness('+cfg.brightness+'%)';
     ctx.drawImage(img,0,0); // Throws if source fails CORS; game rendering is unchanged.
     ctx.getImageData(0,0,1,1);replacement=c;replacementFor=expected;diagnostic='Cosmetic image ready';
   }catch(e){diagnostic='CORS or image processing blocked: '+String(e.message).slice(0,120)}
 };
 img.onerror=()=>{diagnostic='Skin URL could not be loaded with CORS';};
 img.src=expected;
}
function reload(){read();loadImage();}
reload();
const original=HTMLCanvasElement.prototype.getContext;
function install(gl,canvas){
 if(!gl||hooked.has(gl))return;
 hooked.add(gl);contexts++;
 const origTex=gl.texImage2D.bind(gl);
 const origMatrix=gl.uniformMatrix4fv.bind(gl);
 function tex(...args){
   if(cfg.enabled&&replacement&&replacementFor===cfg.skinURL&&cfg.assetURL&&args.length===6){
     const src=args[5];
     if(typeof HTMLImageElement!=='undefined'&&src instanceof HTMLImageElement&&safeURL(src.currentSrc||src.src)===cfg.assetURL){
       try{const copy=args.slice();copy[5]=replacement;const value=origTex(...copy);textures++;return value}
       catch(e){missed++;diagnostic='Texture fallback: '+String(e.message).slice(0,100)}
     }
   }
   return origTex(...args);
 }
 const fingerprint=m=>[0,5,10,12,13,14].map(i=>Number(m[i]).toFixed(3)).join(',');
 function matrix(location,transpose,data,offset,length){
   // Observe only the game's own canvas. Do not probe other 3D objects,
   // rewrite depth state, or transform anything without manual signature.
   if(data&&data.length>=16){
     try{
       const base=Number.isInteger(offset)?offset:0;
       const m=Array.prototype.slice.call(data,base,base+16);
       if(m.length===16&&!transpose){
         if(scanCount++%80===0&&candidates.size<45){
           const fp=fingerprint(m);candidates.set(fp,(candidates.get(fp)||0)+1);
         }
         if(cfg.enabled&&cfg.matrixSignature&&fingerprint(m)===cfg.matrixSignature){
           const copy=new Float32Array(m),scale=cfg.scale/100;
           for(const j of [0,1,2,4,5,6,8,9,10])copy[j]*=scale;
           copy[12]+=cfg.offsetX;copy[13]+=cfg.offsetY;copy[14]+=cfg.offsetZ;
           try{const value=origMatrix(location,transpose,copy);transforms++;return value}
           catch(e){missed++;diagnostic='Matrix fallback: '+String(e.message).slice(0,100)}
         }
       }
     }catch(_){}
   }
   return origMatrix(location,transpose,data,offset,length);
 }
 try{
  gl.texImage2D=tex;
  gl.uniformMatrix4fv=matrix;
  records.add({gl,origTex,origMatrix,tex,matrix});
 }catch(e){diagnostic='Read-only WebGL context; hook refused: '+String(e.message).slice(0,100)}
 canvas.addEventListener('webglcontextlost',()=>{replacement=null;diagnostic='Context lost, awaiting recovery'},{passive:true});
 canvas.addEventListener('webglcontextrestored',()=>reload(),{passive:true});
}
function wrapped(kind,...args){
 const gl=Reflect.apply(original,this,[kind,...args]);
 if((kind==='webgl'||kind==='webgl2')&&this.id==='game')try{install(gl,this)}catch(_){}
 return gl;
}
try{HTMLCanvasElement.prototype.getContext=wrapped}catch(e){diagnostic='Could not install WebGL hook'}
window.addEventListener('ks-webgl-settings',reload);
window.__KS_WEBGL_COSMETICS__=Object.freeze({
 getStatus:()=>({enabled:cfg.enabled,contexts,textureReplacements:textures,matrixTransforms:transforms,
  fallbacks:missed,ready:!!replacement,diagnostic,assetURL:cfg.assetURL,signature:cfg.matrixSignature,
  sampledSignatures:[...candidates.entries()].map(([signature,count])=>({signature,count})).slice(0,20)}),
 refresh:reload,
 restore:()=>{for(const r of records){if(r.gl.texImage2D===r.tex)r.gl.texImage2D=r.origTex;if(r.gl.uniformMatrix4fv===r.matrix)r.gl.uniformMatrix4fv=r.origMatrix;}if(HTMLCanvasElement.prototype.getContext===wrapped)HTMLCanvasElement.prototype.getContext=original;}
});
})();