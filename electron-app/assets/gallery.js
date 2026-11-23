'use strict';
const $=id=>document.getElementById(id),rpc=window.gallery.request;
let packs=[],limit=36,renderID=0,detailID=0,previewURL=null;
const thumbs=new Map();
function node(tag,text){const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;}
async function task(fn){try{$('status').textContent='';await fn();}catch(e){$('status').textContent=e.message;}}
function button(label,fn){const b=node('button',label);b.onclick=()=>task(fn);return b;}
function cleanup(){detailID++;$('detail').replaceChildren();if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;}
async function refresh(){const d=await rpc('list');packs=d.packs;$('paths').replaceChildren(...d.observed.map(p=>node('option',p.slice(8))));render();}
function category(file){return /\.(mp3|ogg|wav)$/i.test(file)?'Sounds':/\.(otf|ttf|woff2?)$/i.test(file)?'Fonts':'Images';}
function render(){
  const version=++renderID,q=$('query').value.toLowerCase(),kind=$('category').value,root=$('rows');root.replaceChildren();
  let total=0;
  for(const p of packs){
    const files=p.details.filter(f=>(p.name+' '+f.path).toLowerCase().includes(q)&&(kind==='All'||kind===category(f.path)||kind==='Favorites'&&f.favorite));
    if(!files.length)continue;
    const pack=node('article'),title=node('strong',p.name);pack.append(title,node('small','  '+[p.author,p.revision,p.description].filter(Boolean).join(' · ')));
    const change=op=>async()=>{await rpc(op,p.id);cleanup();await refresh();};
    pack.append(button(p.enabled?'Disable pack':'Enable pack',change('toggle')),button('Highest priority',change('first')),button('Export',()=>rpc('export',p.id)));
    const name=node('input');name.value=p.name;name.setAttribute('aria-label','Pack name');pack.append(name,button('Rename',async()=>{await rpc('rename',p.id,null,name.value);await refresh();}),button('Remove',async()=>{if(confirm('Remove this managed pack?'))await change('remove')();}));
    root.append(pack);
    for(const f of files){
      if(++total>limit)continue;
      const row=node('div');pack.append(row);
      if(category(f.path)==='Images'){
        const img=node('img');img.alt='';row.append(img);const key=p.id+'/'+f.path;
        if(thumbs.has(key))img.src=thumbs.get(key);
        else rpc('thumbnail',p.id,f.path).then(url=>{if(thumbs.size>=160)thumbs.delete(thumbs.keys().next().value);thumbs.set(key,url);if(version===renderID)img.src=url;}).catch(()=>{});
      }
      row.append(button(f.path,()=>detail(p,f)),button(f.favorite?'★':'☆',async()=>{await rpc('favorite',p.id,f.path);await refresh();}),
        button(f.enabled?'Restore original':'Use replacement',async()=>{await rpc('enable',p.id,f.path);await refresh();}));
    }
  }
  $('more').hidden=total<=limit;
  if(!total)root.append(node('p','No matching pack files.'));
}
async function detail(p,f){
  cleanup();const version=detailID,section=$('detail'),type=category(f.path);
  section.append(node('h2',f.path),button('Close',cleanup));
  if(type==='Fonts')return;
  const data=await rpc('media',p.id,f.path);
  if(version!==detailID)return;
  previewURL=URL.createObjectURL(new Blob([data]));
  if(type==='Images'){const img=node('img');img.src=previewURL;section.append(img);return;}
  const player=node('audio');player.controls=true;player.src=previewURL;
  player.onerror=()=>{$('status').textContent='This audio file cannot be decoded.';};
  const volume=node('input');volume.type='range';volume.min=0;volume.max=100;volume.value=f.gain;
  const label=node('label'),out=node('output');
  volume.oninput=()=>{player.volume=Number(volume.value)/100;out.textContent=volume.value+'%';};volume.oninput();
  label.append('Volume ',volume,out);
  async function apply(percent){
    const bytes=percent===100?null:await scaledAudio(data,percent);
    if(detailID!==version)return;
    await rpc('gain',p.id,f.path,{percent,bytes});await refresh();$('status').textContent='Saved. Reload the game to apply this sound preset.';
  }
  section.append(player,label,button('Apply volume',()=>apply(+volume.value)),button('Mute',()=>{volume.value=0;volume.oninput();return apply(0);}),button('Restore volume',()=>{volume.value=100;volume.oninput();return apply(100);}));
}
async function scaledAudio(data,percent){
  const context=new AudioContext({sampleRate:44100});
  try{
    const clip=await context.decodeAudioData(new Uint8Array(data).buffer);
    const channels=clip.numberOfChannels, size=clip.length*channels*2;
    if(channels>2||44+size>12*1024*1024)throw Error('Use a short mono or stereo effect (maximum 12 MiB decoded).');
    const buf=new ArrayBuffer(44+size),v=new DataView(buf),write=(offset,str)=>[...str].forEach((c,i)=>v.setUint8(offset+i,c.charCodeAt(0)));
    write(0,'RIFF');v.setUint32(4,36+size,true);write(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);
    v.setUint16(22,channels,true);v.setUint32(24,clip.sampleRate,true);v.setUint32(28,clip.sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,size,true);
    for(let c=0;c<channels;c++){const source=clip.getChannelData(c);for(let i=0;i<clip.length;i++)v.setInt16(44+2*(i*channels+c),Math.round(Math.max(-1,Math.min(1,source[i]))*32767*percent/100),true);}
    return new Uint8Array(buf);
  }finally{await context.close();}
}
async function ingest(file){
  if(!file||file.size>17*1024*1024)throw Error('Choose one pack or media file up to 17 MiB.');
  let doc;
  if(file.name.toLowerCase().endsWith('.json'))doc=JSON.parse(await file.text());
  else{
    const path=$('target').value.trim().replace(/^\/assets\//,'');
    if(!path)throw Error('Select the exact original Kirka asset path first.');
    const uri=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
    doc={format:'ks-resource-pack',version:1,name:file.name,files:[{path,data:uri.split(',')[1]}]};
  }
  await rpc('pack',null,null,doc);await refresh();$('status').textContent='Imported and disabled. Review the pack before enabling it.';
}
$('import').onchange=e=>task(()=>ingest(e.target.files[0]));
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',e=>{e.preventDefault();task(()=>ingest(e.dataTransfer.files[0]));});
$('folder').onclick=()=>task(async()=>{await rpc('folder');await refresh();});
$('more').onclick=()=>{limit+=36;render();};
for(const id of ['query','category'])$(id).oninput=()=>{limit=36;render();};
window.addEventListener('pagehide',cleanup);
task(refresh);
