/* KS Client alpha 1.1.17 — independently maintained local Game Workshop.
   No imported third-party source. Settings stay in this browser profile.
   JS extensions run only after an explicit click, in a sandboxed opaque iframe.
*/
(() => {
 'use strict';
 if (window.__KS_WORKSHOP__) return;
 if(location.protocol!=='https:' || !['kirka.io','www.kirka.io'].includes(location.hostname))return;
 const KEY='ksclient.workshop.v1';
 const WG='ksclient.webgl.v114';
 const ADV='ksclient.advanced.v114';
 const advancedCfg=()=>{try{return JSON.parse(localStorage.getItem(ADV)||'{}')||{}}catch(_){return {}}};
 const glCfg=()=>{try{return JSON.parse(localStorage.getItem(WG)||'{}')||{}}catch(_){return {}}};
 const glStatus=()=>window.__KS_WEBGL_COSMETICS__?.getStatus?.()||{};
 const deepSnapshot=()=>window.__KS_DEEP__?.getSnapshot?.()||{};
 const EMPTY=()=>({weapon:{hue:0,saturation:100,brightness:100,skinURL:'',enabled:false,presets:[]},
   swapEnabled:false,plugins:[],rooms:[],history:[],friends:[],inventory:[],killfeedColors:false,gameHudTheme:'original'});
 const isObject=x=>x&&typeof x==='object'&&!Array.isArray(x);
 const trim=(v,n=120)=>String(v??'').trim().slice(0,n);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const kirkaURL=value=>{
   try{const u=new URL(trim(value,500));if(u.protocol!=='https:'||!['kirka.io','www.kirka.io'].includes(u.hostname)||u.username||u.password||u.port)return null;return u.href;}
   catch(_){return null}
 };
 const imgURL=value=>{try{const u=new URL(trim(value,450));return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<450?u.href:null}catch(_){return null}};
 const inArray=(raw,max,validate)=>Array.isArray(raw)?raw.slice(0,max).filter(isObject).map(validate).filter(Boolean):[];
 function read(){
   let value={};try{value=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){}
   return normalizeWorkshop(value);
 }
 function normalizeWorkshop(value){
   if(!isObject(value))value={};
   const d=EMPTY(),w=isObject(value.weapon)?value.weapon:{};
   d.weapon={enabled:w.enabled===true,hue:clamp(w.hue,0,360,0),saturation:clamp(w.saturation,40,200,100),
     brightness:clamp(w.brightness,50,150,100),skinURL:imgURL(w.skinURL)||'',presets:inArray(w.presets,12,p=>{
       const name=trim(p.name,36);return name?{name,hue:clamp(p.hue,0,360,0),saturation:clamp(p.saturation,40,200,100),brightness:clamp(p.brightness,50,150,100),skinURL:imgURL(p.skinURL)||''}:null})};
   d.appearance=appearance(value.appearance);
   d.favoriteLooks=inArray(value.favoriteLooks,12,x=>({name:trim(x.name,30),...appearance(x)})).filter(x=>x.name);
   d.poses=inArray(value.poses,32,pose).filter(x=>x.name);
   d.swapEnabled=value.swapEnabled===true;
   d.markerId=/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value.markerId||'')?value.markerId:'';
   d.markerColor=color(value.markerColor,'#ffffff');
   d.killfeedColors=value.killfeedColors===true;
   d.gameHudTheme=['original','compact','amber','ice'].includes(value.gameHudTheme)?value.gameHudTheme:'original';
   d.rooms=inArray(value.rooms,25,x=>{const url=kirkaURL(x.url),name=trim(x.name,45);return url?{name:name||'Saved room',url,settings:isObject(x.settings)?limitSettings(x.settings):{}}:null});
   d.history=inArray(value.history,20,x=>{const url=kirkaURL(x.url);return url?{url,time:trim(x.time,32)}:null});
   d.friends=inArray(value.friends,60,x=>{const nick=trim(x.nick,55),note=trim(x.note,130);return nick?{nick,note,tag:trim(x.tag,32),favorite:x.favorite===true,color:color(x.color,'#f0aa35')}:null});
   d.inventory=inArray(value.inventory,100,x=>{const item=trim(x.item,80);return item?{item,note:trim(x.note,130),favorite:x.favorite===true,price:clamp(x.price,0,100000000,0)}:null});
   d.plugins=inArray(value.plugins,12,normalizePlugin);
   return d;
 }
 function clamp(v,min,max,fallback){const n=Number(v);return Number.isFinite(n)?Math.round(Math.max(min,Math.min(max,n))):fallback}
 function color(v,fallback){return /^#[0-9a-f]{6}$/i.test(String(v))?String(v):fallback}
 function appearance(x={}){
   x=isObject(x)?x:{};
   return {enabled:x.enabled===true,nameColor:color(x.nameColor,'#f0aa35'),clanColor:color(x.clanColor,'#66cddd'),
     gradient:x.gradient===true,badge:['','KS ◆','KS ★','KS ●'].includes(x.badge)?x.badge:'',
     card:['original','outlined','tinted'].includes(x.card)?x.card:'original'};
 }
 function pose(x){
   return {name:trim(x.name,48),x:clamp(x.x,-80,80,0),y:clamp(x.y,-80,80,0),z:clamp(x.z,-80,80,0),
     scale:clamp(x.scale,50,150,100),rx:clamp(x.rx,-180,180,0),ry:clamp(x.ry,-180,180,0),rz:clamp(x.rz,-180,180,0)};
 }
 function poseTransform(p){
   return 'translate3d('+p.x+'px,'+p.y+'px,'+p.z+'px) rotateX('+p.rx+'deg) rotateY('+p.ry+'deg) rotateZ('+p.rz+'deg) scale('+p.scale/100+')';
 }
 function appearanceCSS(a){
   if(!a.enabled)return '';
   const nick=':is(.profile-cont,.card-profile,.profile-page) :is(.nickname,.username,.player-name)';
   return nick+'{color:'+a.nameColor+'!important;'+(a.gradient?'background:linear-gradient(90deg,'+a.nameColor+','+a.clanColor+');background-clip:text;-webkit-text-fill-color:transparent;':'')+'}'+
     ':is(.profile-cont,.card-profile,.profile-page) .clan-name{color:'+a.clanColor+'!important}'+
     (a.badge?nick+'::after{content:" '+a.badge+'";font:600 11px system-ui;color:'+a.nameColor+';-webkit-text-fill-color:'+a.nameColor+'}':'')+
     (a.card==='outlined'?'.card-profile{outline:1px solid '+a.clanColor+'}':a.card==='tinted'?'.card-profile{background-color:'+a.clanColor+'22!important}':'');
 }
 function lookControls(){
   const a=cfg.appearance;
   return card('Local profile style',input('look-nameColor','Profile color',a.nameColor,'color')+input('look-clanColor','Clan color',a.clanColor,'color')+
     '<label>Gradient <input id="ks-wk-look-gradient" type="checkbox" '+(a.gradient?'checked':'')+'></label>'+
     ['badge','card'].map(k=>'<label>'+k+' <select id="ks-wk-look-'+k+'">'+(k==='badge'?['','KS ◆','KS ★','KS ●']:['original','outlined','tinted']).map(v=>'<option value="'+v+'" '+(a[k]===v?'selected':'')+'>'+escape(v||'None')+'</option>').join('')+'</select></label>').join('')+
     '<p id="ks-look-preview" style="color:'+a.nameColor+'">Profile · Clan '+escape(a.badge)+'</p>'+
     btn('look-apply','Apply locally')+btn('look-reset','Restore original')+input('look-name','Preset name')+btn('look-save','Save favorite colors')+
     cfg.favoriteLooks.map((x,i)=>btn('look-use-'+i,x.name)).join(''));
 }
 let editingPose=null;
 function poseCard(){
   const p=editingPose||pose({});
   return card('Viewmodel pose studio','<p>Preview locally. A live pose needs a selected Kirka weapon and its confirmed matrix signature. Offsets use hundredths of a model unit.</p>'+
     '<div style="height:140px;display:grid;place-items:center;perspective:350px;overflow:hidden"><div id="ks-pose-preview" style="transform-style:preserve-3d;transform:'+poseTransform(p)+'"><i style="display:block;width:95px;height:16px;background:#d89c47;transform:translateZ(7px)"></i><i style="position:absolute;top:0;width:95px;height:14px;background:#9e7439;transform:rotateX(90deg);transform-origin:top"></i><i style="display:block;width:12px;height:22px;margin-left:18px;background:#75624c"></i></div></div>'+
     input('pose-name','Weapon preset name',p.name)+['x','y','z','scale','rx','ry','rz'].map(k=>input('pose-'+k,k,p[k],'number')).join('')+
     btn('pose-save','Save pose')+btn('pose-bind','Apply pose to calibrated weapon')+btn('pose-unbind','Clear live pose bindings')+btn('pose-reset','Reset preview')+btn('pose-export','Export poses')+'<input id="ks-wk-pose-file" type="file" accept=".json">'+btn('pose-import','Import poses')+
     cfg.poses.map((x,i)=>btn('pose-use-'+i,x.name)+btn('pose-delete-'+i,'Remove')).join(''));
 }
 function readPose(ui){const v=k=>ui.getElementById('ks-wk-pose-'+k)?.value;return pose(Object.fromEntries(['name','x','y','z','scale','rx','ry','rz'].map(k=>[k,v(k)])));}
 function readLook(ui){const v=k=>ui.getElementById('ks-wk-look-'+k);return appearance({enabled:true,nameColor:v('nameColor')?.value,clanColor:v('clanColor')?.value,gradient:v('gradient')?.checked,badge:v('badge')?.value,card:v('card')?.value});}
 document.addEventListener('input',e=>{
   const el=e.composedPath()[0],ui=el?.getRootNode();if(!ui?.host||ui.host.id!=='ks-client-root')return;
   if(el.id.startsWith('ks-wk-pose-')){editingPose=readPose(ui);const box=ui.getElementById('ks-pose-preview');if(box)box.style.transform=poseTransform(editingPose);}
   if(el.id.startsWith('ks-wk-look-')){const a=readLook(ui),box=ui.getElementById('ks-look-preview');if(box){box.style.color=a.nameColor;box.style.background=a.gradient?'linear-gradient(90deg,'+a.nameColor+'35,'+a.clanColor+'66)':'';box.style.borderColor=a.clanColor;box.textContent='Profile · Clan '+a.badge;}}
 });
 function limitSettings(s){
   const obj={};
   for(const [k,v] of Object.entries(s).slice(0,32)){
     if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')obj[trim(k,80)]=String(v).slice(0,100);
   }
   return obj;
 }
 const cssTargets=['.profile .nickname','.profile .clan-name','.friends .nickname','.inventory .item-name','.market .listing .name'];
 let cfg=read();
 let watchFriend=null;
 let status='Workshop features are local to this browser profile.';
 const value=id=>document.getElementById('ks-client-root')?.shadowRoot?.getElementById(id)?.value||'';
 const checked=id=>!!document.getElementById('ks-client-root')?.shadowRoot?.getElementById(id)?.checked;
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(cfg));}catch(e){status='Cannot save workshop data: '+e.message}refresh();syncWork(activeTab);};
 const btn=(action,name,extra='')=>'<button class="ks-btn" data-action="wk-'+action+'" '+extra+'>'+escape(name)+'</button>';
 const input=(id,label,v='',kind='text')=>'<label class="ks-row"><span class="ks-label">'+escape(label)+'</span><input class="ks-input" id="ks-wk-'+id+'" type="'+kind+'" value="'+escape(v)+'" maxlength="480"></label>';
 const card=(title,content)=>'<div class="ks-card"><h3 class="ks-section-heading">'+escape(title)+'</h3>'+content+'</div>';
 const notice='<p class="ks-hint">Local-only appearance and convenience tools; never changes player inventory, server data, weapon damage or hit detection.</p>';
 const list=(items,what)=>items.length?items.map((x,i)=>'<div class="ks-row"><span>'+escape(x.name||x.nick||x.item||x.url||'Item')+'</span>'+btn(what+'-use-'+i,'Use')+btn(what+'-delete-'+i,'Remove')+'</div>').join(''):'<p class="ks-hint">No saved entries yet.</p>';
 const srcmsg='Your own script runs only inside an opaque, sandboxed preview. No raw game DOM, cookies, Electron, Node.js, network or filesystem access. The approved ks.snapshot() API returns a sanitized copy of the visible Kirka UI. Scripts never auto-run.';
 function observedAssets(){
   const paths=new Set();
   for(const entry of performance.getEntriesByType('resource')){
     let url;
     try{url=new URL(entry.name);}catch{continue;}
     if(url.origin!==location.origin || !/^\/assets\/(img|skins|textures|ui|media|audio|fonts|css)\/.+\.(png|jpe?g|webp|gif|svg|mp3|ogg|wav|woff2?|otf|ttf|css)$/i.test(url.pathname))continue;
     paths.add(url.pathname);
   }
   return [...paths].slice(-100);
 }
 const marketKey='ksclient.market.observations.v1';
 let lastInventory=[],lastRead='',marketRows=[],friendRows=[],inventoryTime=0;
 let query='',sortPrice=false,onlyFav=false;
 let history=[];
 try{const parsed=JSON.parse(localStorage.getItem(marketKey)||'[]');
   if(Array.isArray(parsed))history=parsed.filter(x=>x&&typeof x.item==='string'&&typeof x.unit==='string'&&Number.isFinite(x.price)&&Number.isFinite(x.time)).slice(-400);
 }catch{}
 function priceOf(x){
   // Ambiguous grouped/decimal prices are shown verbatim and excluded from comparisons.
   const match=/^([0-9]+)(?:\s+([^\d\s][^\d]{0,24}))?$/.exec(x.price.trim());
   if(!match||!Number.isSafeInteger(Number(match[1])))return null;
   return {amount:Number(match[1]),unit:(x.unit||match[2]||'').trim().toLowerCase()};
 }
 function updateHistory(listings){
   const minimum=new Map();
   for(const x of listings){
     const p=priceOf(x);if(!p||!p.unit)continue;
     const key=JSON.stringify([x.item,p.unit]);
     if(!minimum.has(key)||minimum.get(key).price>p.amount)minimum.set(key,{item:x.item,unit:p.unit,price:p.amount});
   }
   let changed=false;
   for(const v of minimum.values()){
     const prev=history.findLast(x=>x.item===v.item&&x.unit===v.unit);
     if(prev?.price===v.price)continue;
     history.push({...v,time:Date.now()});changed=true;
   }
   if(changed){history=history.slice(-400);try{localStorage.setItem(marketKey,JSON.stringify(history));}catch{}}
 }
 function lineChart(rows){
   if(rows.length<2)return '';
   const values=rows.slice(-24),times=values.map(x=>x.time),prices=values.map(x=>x.price);
   const min=Math.min(...prices),span=Math.max(1,Math.max(...prices)-min),duration=Math.max(1,times.at(-1)-times[0]);
   const points=values.map(x=>((x.time-times[0])/duration*100).toFixed(1)+','+(23-(x.price-min)/span*21).toFixed(1)).join(' ');
   return '<svg width="100" height="25" viewBox="0 0 102 25" aria-hidden="true"><polyline fill="none" stroke="currentColor" points="'+points+'"/></svg> <small>'+prices[0]+' → '+prices.at(-1)+' '+escape(values[0].unit)+'</small>';
 }
 function marketAnchor(){
   return [...document.querySelectorAll('a[href]')].find(a=>{
     try{const u=new URL(a.href);return u.origin===location.origin&&/^\/market(?:place)?\/?$/.test(u.pathname)&&a.getClientRects().length&&getComputedStyle(a).visibility==='visible';}catch{return false;}
   });
 }
 function nativeMarketLink(){return marketAnchor()?btn('open-market','Open market'):'';}
 function tableControls(kind){
   return input('query','Search',query)+'<label class="ks-row">Favorites <input id="ks-wk-only-fav" type="checkbox" '+(onlyFav?'checked':'')+'></label>'+
     (kind==='market'?'<label class="ks-row">Sort by price <input id="ks-wk-price-sort" type="checkbox" '+(sortPrice?'checked':'')+'></label>':'')+btn('filter','Apply');
 }
 function updateLists(panel){
   const deep=window.__KS_DEEP__;if(!deep)return;
   const node=panel?.getElementById('ks-live-market')||panel?.getElementById('ks-live-friends');if(!node)return;
   const needle=query.toLocaleLowerCase(),has=s=>s.toLocaleLowerCase().includes(needle);
   let html='';
   if(node.id==='ks-live-friends'){
     const profile=deep.profileSnapshot?.(),profileNode=panel.getElementById('ks-live-profile');
     if(profileNode){
       const details=profile?[profile.nickname,...profile.visibleBadges,...profile.stats].filter(Boolean):[];
       const summary=details.join(' · ')||window.__KS_CLIENT__?.translate?.('No visible entries on this game screen.')||'No visible entries on this game screen.';
       if(profileNode.textContent!==summary)profileNode.textContent=summary;
     }
     friendRows=deep.friendsSnapshot?.().entries||[];
     html=friendRows.map((x,i)=>{
       const saved=cfg.friends.find(f=>f.nick.toLowerCase()===x.name.toLowerCase()||x.id&&f.nick===x.id);
       if(!has([x.name,x.id,saved?.tag,saved?.note].join(' '))||onlyFav&&!saved?.favorite)return '';
       return '<div class="ks-row"><span>'+escape([x.name,x.id,x.observedEarlier?'Last seen':'',x.state?(window.__KS_CLIENT__?.translate?.(x.state==='online'?'Online':'Offline')||x.state):'',saved?.tag,saved?.note].filter(Boolean).join(' · '))+'</span>'+
         (!x.observedEarlier&&x.profile?btn('profile-'+i,'Open profile'):'')+'</div>';
     }).join('');
   }else{
     const inventory=deep.inventorySnapshot?.();
     if(inventory?.available){
       const next=JSON.stringify(inventory.entries);
       if(next!==lastRead){lastRead=next;lastInventory=inventory.entries;inventoryTime=Date.now();}
     }
     const fav=item=>cfg.inventory.some(x=>x.favorite&&x.item.toLowerCase()===item.toLowerCase());
     const inventoryNode=panel.getElementById('ks-visible-inventory');
     let cards=lastInventory.filter(x=>has(x.name+' '+x.type)&&(!onlyFav||fav(x.name))).sort((a,b)=>a.name.localeCompare(b.name))
       .map(x=>'<div class="ks-row">'+(x.image?'<img loading="lazy" width="32" height="32" alt="" src="'+escape(x.image)+'">':'')+'<span>'+escape(x.name)+' '+escape(x.type)+'</span></div>').join('');
     if(!inventory?.available&&inventoryTime)cards='<small>'+escape(new Date(inventoryTime).toLocaleString())+'</small>'+cards;
     const empty='<p class="ks-hint">'+escape(window.__KS_CLIENT__?.translate?.('No visible entries on this game screen.')||'No visible entries on this game screen.')+'</p>';
     const set=(n,markup)=>{if(n&&n._ksMarkup!==markup){n.innerHTML=markup;n._ksMarkup=markup;}};
     set(inventoryNode,cards||empty);
     marketRows=deep.marketSnapshot?.().listings||[];
     updateHistory(marketRows);
     const filtered=marketRows.filter(x=>has(x.item)&&(!onlyFav||fav(x.item)));
     if(sortPrice)filtered.sort((a,b)=>{
       const x=priceOf(a),y=priceOf(b);if(!x?.unit||!y?.unit)return Number(!x?.unit)-Number(!y?.unit);
       return x.unit.localeCompare(y.unit)||x.amount-y.amount;
     });
     html=filtered.map(x=>'<div class="ks-row"><span>'+escape(x.item)+'</span><strong>'+escape(x.price)+' '+escape(x.unit||'')+'</strong></div>').join('');
     const series=new Map();
     for(const x of history.filter(x=>has(x.item)&&(!onlyFav||fav(x.item)))){
       const key=JSON.stringify([x.item,x.unit]);if(!series.has(key))series.set(key,[]);series.get(key).push(x);
     }
     set(panel.getElementById('ks-price-history'),[...series.values()].slice(-30).map(rows=>'<div class="ks-row"><span>'+escape(rows[0].item)+'</span>'+
       (lineChart(rows)||escape(rows[0].price+' '+rows[0].unit))+'</div>').join('')||empty);
   }
   if(!html)html=escape(window.__KS_CLIENT__?.translate?.('No visible entries on this game screen.')||'No visible entries on this game screen.');
   if(node._ksMarkup!==html){node.innerHTML=html;node._ksMarkup=html;}
 }

 let packList=[];
 function packRows(){
   const tr=s=>window.__KS_CLIENT__?.translate?.(s)||s;
   return packList.map((p,i)=>'<div class="ks-row"><div><strong>'+escape(p.name)+'</strong><div class="ks-desc">'+
     escape(tr('Observed paths'))+' '+p.matched+'/'+p.total+' · '+escape(tr('Conflicts'))+' '+p.conflicts+'</div></div>'+
     btn('pack-toggle-'+i,tr(p.enabled?'Disable':'Enable'))+btn('pack-first-'+i,tr('Highest priority'))+
     btn('pack-export-'+i,tr('Export'))+btn('pack-remove-'+i,tr('Remove'))+'</div>'+
     '<details><summary>'+escape(tr('Observed paths'))+'</summary><ul>'+p.details.map(f=>'<li>'+escape(f.path)+' · '+
       escape(tr(!f.available?'Missing file':f.shadowed?'Conflicts':f.matched?'Observed paths':'Not observed yet'))+'</li>').join('')+'</ul></details>').join('');
 }
 function setPacks(result){
   if(!Array.isArray(result?.packs))return;
   packList=result.packs;
   const panel=document.getElementById('ks-client-root')?.shadowRoot,node=panel?.getElementById('ks-wk-pack-list');
   if(node)node.innerHTML=packRows();
   if(result.message){status=trim(result.message,180);const n=panel?.getElementById('ks-wk-status');if(n)n.textContent=status;}
 }
 function downloadJSON(data,name){
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function render(tab){
   if(tab==='KS Analytics')return (window.__KS_ANALYTICS__?.render(escape)||'Analytics unavailable')+
     btn('analytics-refresh','Refresh')+btn('analytics-export','Export statistics')+btn('analytics-reset','Reset statistics');
   if(tab==='Weapon Studio')return '<h2 class="ks-title">Weapon Studio / Custom Skin Link</h2><p class="ks-sub">Local weapon and inventory image cosmetics. 3D WebGL material replacement depends on exact supported game assets.</p>'+
     poseCard()+card('Weapon & inventory visual styling',input('weapon-hue','Hue rotation (0–360)',cfg.weapon.hue,'number')+
       input('weapon-saturation','Saturation % (40–200)',cfg.weapon.saturation,'number')+
       input('weapon-brightness','Brightness % (50–150)',cfg.weapon.brightness,'number')+
       input('skin-url','Custom Skin Link (HTTPS image)',cfg.weapon.skinURL)+
       '<label class="ks-row">Enable local cosmetic styling <input type="checkbox" id="ks-wk-weapon-on" '+(cfg.weapon.enabled?'checked':'')+'></label>'+
       btn('weapon-apply','Apply cosmetics')+' '+btn('weapon-reset','Clear cosmetics'))+
     card('3D Weapon Studio (experimental exact-match WebGL)',
       '<p class="ks-hint">Select a Kirka weapon, choose its skin image, then bind it. Known default weapons work immediately on their next texture upload. For other weapons enable discovery before opening the preview. Shared game textures can affect multiple models.</p>'+
       btn('gallery','Open Workshop Gallery')+' '+btn('gl-discovery',glCfg().discover?'Stop texture discovery':'Start texture discovery')+' '+btn('gl-auto-bind','Bind skin to selected weapon')+' '+btn('gl-report','Live compatibility report')+' '+btn('gl-probe','Identify visible weapon image')+' '+btn('gl-use-probe','Use observed texture')+
       input('gl-source','Original Kirka texture URL (exact HTTPS asset)',glCfg().assetURL||'')+
       input('gl-skin','Custom 3D Skin Link (HTTPS CORS image)',glCfg().skinURL?.startsWith('data:')?'':glCfg().skinURL||'')+
       '<label class="ks-row"><span>Local skin image</span><input id="ks-wk-gl-file" type="file" accept="image/png,image/jpeg,image/webp"></label>'+
       input('gl-name','Weapon preset name')+btn('gl-bind','Save weapon binding')+
       (glCfg().slots||[]).map((slot,i)=>'<div class="ks-row"><span>'+escape(slot.name)+'</span>'+btn('gl-select-'+i,'Use')+btn('gl-remove-'+i,'Remove')+'</div>').join('')+
       input('gl-hue','Texture hue 0–360',glCfg().hue??0,'number')+
       input('gl-saturation','Texture saturation %',glCfg().saturation??100,'number')+
       input('gl-brightness','Texture brightness %',glCfg().brightness??100,'number')+
       input('gl-scale','3D scale % (calibrated target only)',glCfg().scale??100,'number')+
       input('gl-x','3D X offset',glCfg().offsetX??0,'number')+
       input('gl-y','3D Y offset',glCfg().offsetY??0,'number')+
       input('gl-z','3D Z offset',glCfg().offsetZ??0,'number')+
       input('gl-matrix','Manual WebGL matrix signature',glCfg().matrixSignature||'')+
       '<label class="ks-row">Enable 3D cosmetics <input type="checkbox" id="ks-wk-gl-enabled" '+(glCfg().enabled?'checked':'')+'></label>'+
       btn('gl-apply','Apply 3D cosmetics')+' '+btn('gl-reset','Disable 3D cosmetics')+
       '<p class="ks-hint">Renderer: '+escape(JSON.stringify(glStatus()).slice(0,900))+'</p>')+
     card('Save weapon presets',input('weapon-name','Preset name')+btn('weapon-save','Save preset')+list(cfg.weapon.presets,'weapon'))+
     card('Game HUD appearance',input('marker-id','Native HTML hitmarker element ID (optional)',cfg.markerId)+input('marker-color','Marker color',cfg.markerColor,'color')+
       '<p class="ks-hint">'+(cfg.markerId && document.getElementById(cfg.markerId)?'Selected game element found.':'No matching native HTML hitmarker selected.')+'</p><label class="ks-row">Colored killfeed <input type="checkbox" id="ks-wk-killfeed-on" '+(cfg.killfeedColors?'checked':'')+'></label>'+
       '<label class="ks-row">HUD style <select class="ks-input" id="ks-wk-hud-theme">'+
       ['original','compact','amber','ice'].map(v=>'<option value="'+v+'" '+(cfg.gameHudTheme===v?'selected':'')+'>'+v+'</option>').join('')+
       '</select></label>'+btn('hud-apply','Apply HUD appearance'))+
     card('Game cosmetic compatibility','<p class="ks-hint">Effects target Kirka.io HTML weapon and inventory previews. For actual 3D texture replacement, use Resource Swapper with an exact game asset path and your own permitted image.</p>')+notice;
   if(tab==='Resource Swapper')return '<h2 class="ks-title">Local Resource Swapper</h2><p class="ks-sub">Opt-in resource replacements in both engines, matched by exact Kirka.io /assets/... paths.</p>'+
     card('Local asset replacement','<p class="ks-hint">Copy permitted PNG, JPG, WebP, MP3, WAV, OGG or CSS files to Documents/KSClient/Swapper/assets/img, media or css, matching Kirka.io /assets/ subpaths. No remote downloads and no JavaScript replacements.</p>'+
       '<label class="ks-row">Enable replacements at startup <input type="checkbox" id="ks-wk-swap-on" '+(cfg.swapEnabled?'checked':'')+'></label>'+
       btn('swap-toggle','Save swapper state')+' '+btn('swap-folder','Open asset folder')+' '+btn('swap-scan','Scan files')+
       '<p class="ks-hint">Exact Kirka image/audio/font/CSS resource matching only. Reload after changing files; no game JavaScript interception.</p>')+
     card('Workshop Gallery',btn('gallery','Browse images, sounds and shared packs'))+
     card('Resource packs',btn('pack-import','Import pack')+' '+btn('pack-create','Create from folder')+' '+btn('pack-list','Refresh')+
       '<div id="ks-wk-pack-list">'+packRows()+'</div>')+
     card('Observed asset paths','<p>For a versioned path such as img/logo.1234abcd.png, you can name your local file img/logo.ks-anyhash.png. Exact names take priority. Only the hexadecimal build suffix can change.</p>'+btn('asset-refresh','Refresh observed paths')+'<pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+escape(observedAssets().join('\n')||'No supported assets observed in this document.')+'</pre>')+
     card('Mouse-held freeze workaround (experimental)',
       '<label class="ks-row">Enable optional frame-yield guard (reload required) <input type="checkbox" id="ks-wk-freeze-on" '+(advancedCfg().freezeGuard?'checked':'')+'></label>'+
       btn('freeze-save','Save frame-yield setting')+
       '<p class="ks-hint">Status: '+escape(JSON.stringify(window.__KS_FREEZE_GUARD__?.getStatus?.()||{}).slice(0,260))+'</p>')+notice;
   if(tab==='Plugins')return '<h2 class="ks-title">Safe JavaScript plugins</h2><p class="ks-sub">'+escape(srcmsg)+'</p>'+
     '<p class="ks-hint">Example: ks.message("Hello!"); ks.tint("hud","#ffaa22"); ks.snapshot().then(s=>ks.message(s.scene)); The snapshot includes only visible game data. Each run requires a click.</p>'+
     card('Add local plugin',input('plugin-name','Plugin name')+input('plugin-author','Author')+input('plugin-description','Description')+input('plugin-category','Category')+
       '<label class="ks-row">Plugin type <select id="ks-wk-plugin-type"><option value="js">JavaScript</option><option value="css">Scoped CSS</option></select></label>'+'<textarea id="ks-wk-plugin-code" class="ks-input" rows="7" placeholder="ks.message(&#39;Hello!&#39;)"></textarea>'+input('plugin-version','Plugin version','1.0.0')+input('plugin-settings','Plugin settings (JSON)','{}')+
       '<label class="ks-row">Worker API 2 <input id="ks-wk-plugin-v2" type="checkbox"></label>'+btn('plugin-save','Save code')+
       '<input id="ks-wk-plugin-file" type="file" accept=".json,.js,.css">'+btn('plugin-import','Import plugin'))+
     card('Saved plugins',cfg.plugins.length?cfg.plugins.map((p,i)=>'<div class="ks-row"><div><strong>'+escape(p.name)+'</strong><div class="ks-desc">v'+escape(p.version)+' · API '+p.api+' · '+escape([p.author,p.category,p.kind].filter(Boolean).join(' / '))+'</div><small>'+escape(p.description)+'</small></div>'+(p.enabled?btn('plugin-run-'+i,'Run'):'')+btn('plugin-toggle-'+i,p.enabled?'Disable':'Enable')+btn('plugin-edit-'+i,'Edit')+btn('plugin-export-'+i,'Export')+btn('plugin-delete-'+i,'Delete')+'</div>').join(''):'<p class="ks-hint">No scripts saved.</p>')+
     card('CSS plugin format','<p>Use color, background-color or border-color with six-digit hex colors on these supported selectors: '+escape(cssTargets.join(', '))+'</p>')+
     card('Plugin preview','<div id="ks-wk-plugin-preview" class="ks-note">Choose Run to open an isolated preview.</div>'+btn('plugin-stop','Stop preview')+'<pre>'+escape(pluginLog.join('\n'))+'</pre>')+notice;
   if(tab==='Lobby')return '<h2 class="ks-title">Lobby / Quick Join</h2><p class="ks-sub">Save join links, room notes and supported HTML lobby form values.</p>'+
     card('Regional latency',btn('regions','Open regional latency and servers'))+
     card('Save current room',input('room-name','Room name')+input('room-url','Kirka.io room URL',kirkaURL(location.href)||'')+
       btn('room-save','Save room + visible form values')+' '+btn('room-capture','Capture current lobby options'))+
     card('Favorite rooms',cfg.rooms.length?cfg.rooms.map((r,i)=>'<div class="ks-row"><span>'+escape(r.name)+'</span>'+
       btn('room-use-'+i,'Apply preset')+btn('room-join-'+i,'Join')+btn('room-spectate-'+i,'Spectate')+btn('room-delete-'+i,'Remove')+'</div>').join(''):'<p class="ks-hint">No saved rooms.</p>')+
     card('Recently joined',list(cfg.history.map(h=>({name:h.url,url:h.url})), 'history'))+
     '<p class="ks-hint">Applying lobby settings changes only matching visible HTML controls, never hidden server configuration. Joining still follows Kirka.io permissions.</p>';
   if(tab==='Friends & Profiles')return '<h2 class="ks-title">Friends & Profiles</h2><p class="ks-sub">Local labels and notes for profiles you actually see. No access to private friend lists or invented spectate links.</p>'+
     lookControls()+card('Create local player annotation',input('friend-nick','Visible nickname / player ID')+input('friend-note','Personal note')+
       input('friend-tag','Player tag')+'<label class="ks-row">Favorite <input id="ks-wk-friend-favorite" type="checkbox"></label>'+input('friend-color','Tag color', '#f0aa35','color')+btn('friend-save','Save note'))+
     card('Visible friend list',tableControls('friends')+btn('scan-friends','Read open Kirka friend list')+'<div id="ks-live-friends"></div>'+input('watch-name','Exact visible friend name',watchFriend?.name||'')+
       btn('watch-friend','Watch for native Spectate (60 seconds)')+' '+btn('watch-cancel','Cancel')+
       '<p class="ks-hint">Keep this panel open. The game must offer Spectate for this friend.</p>')+
     card('Clan directory',btn('clans','Search public clans'))+
     card('Visible profile details','<div id="ks-live-profile"></div>')+
     card('Saved annotations',cfg.friends.length?cfg.friends.map((f,i)=>
       ((onlyFav&&!f.favorite)||!([f.nick,f.tag,f.note].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())))?'':'<div class="ks-row"><div><strong>'+escape((f.favorite?'★ ':'')+f.nick+' '+(f.tag||''))+'</strong><div class="ks-desc">'+escape(f.note)+'</div></div>'+btn('friend-delete-'+i,'Delete')+'</div>').join(''):'<p class="ks-hint">No saved player notes.</p>')+notice;
   if(tab==='Inventory & Market')return '<h2 class="ks-title">Inventory / Market</h2><p class="ks-sub">Personal item favorites, notes and manually entered estimates. No trades, purchases or prices are fabricated.</p>'+
     card('Add item to your list',input('item-name','Item / skin name')+input('item-note','Personal note')+
       input('item-price','Estimated price (manual only)',0,'number')+
       '<label class="ks-row">Favorite <input type="checkbox" id="ks-wk-item-favorite" checked></label>'+btn('item-save','Save item'))+
     card('Visible inventory details',nativeMarketLink()+btn('kirka-stats','Open KirkaStats')+tableControls('market')+'<div id="ks-visible-inventory"></div>')+
     card('Visible market listings (read-only)','<div id="ks-live-market"></div>')+
     card('Observed price history','<div id="ks-price-history"></div>')+
     card('Saved collection',cfg.inventory.length?cfg.inventory.map((x,i)=>'<div class="ks-row"><div><strong>'+(x.favorite?'★ ':'')+escape(x.item)+'</strong><div class="ks-desc">'+escape(x.note)+' · Manual estimate: '+x.price+'</div></div>'+btn('item-delete-'+i,'Delete')+'</div>').join(''):'<p class="ks-hint">No saved items.</p>')+notice;
   return '';
 }
 function captureLobby(){
   const obj={};
   // Include Kirka's modal with custom game-mode, map and weapon selectors.
   const area=document.querySelector('.create-modal,.general-content,.create-game,.create-room');
   if(!area)return obj;
   const inputs=Array.from(area.querySelectorAll('input,select')).slice(0,32);
   for(const el of inputs){
     if(!el.getClientRects().length || el.disabled)continue;
     const wrap=el.closest('.element,.items,.setting,.form-group')||el.parentElement;
     const name=trim(wrap?.querySelector('.label, label')?.textContent || el.getAttribute('aria-label')||el.name||el.id,80);
     if(!name||el.type==='password'||el.type==='file'||el.type==='hidden')continue;
     obj[name]=el.type==='checkbox'?String(el.checked):trim(el.value,100);
   }
   // Custom Kirka selectors are not standard input rows; preserve them by
   // category and visible label, rather than guessing a private game state.
   const groups={modes:'.mods .custom-checkbox',maps:'.maps .custom-checkbox',weapons:'.weapons-cont .custom-checkbox'};
   for(const [group,selector] of Object.entries(groups)){
     for(const item of Array.from(area.querySelectorAll(selector)).slice(0,64)){
       const box=item.querySelector('input[type="checkbox"]');
       const label=trim(item.querySelector('span,label')?.textContent||'',70);
       if(box&&label)obj['ks-group:'+group+':'+label]=String(box.checked);
     }
   }
   return obj;
 }
 function applyLobby(room){
   const entries=Object.entries(room.settings||{});
   if(!entries.length){status='Saved room has no HTML form settings; use Join to navigate.';return}
   const container=document.querySelector('.create-modal,.general-content,.create-game,.create-room');
   if(!container){status='Kirka.io lobby creation form is not visible.';return}
   let applied=0;
   for(const el of Array.from(container.querySelectorAll('input,select')).slice(0,80)){
     const wrap=el.closest('.element,.items,.setting,.form-group')||el.parentElement;
     const label=trim(wrap?.querySelector('.label,label')?.textContent||el.getAttribute('aria-label')||el.name||el.id,80);
     if(!Object.prototype.hasOwnProperty.call(room.settings,label)||!['text','number','range','checkbox','select-one'].includes(el.type))continue;
     if(el.disabled || !el.getClientRects().length)continue;
     if(el.tagName==='SELECT' && !Array.from(el.options).some(opt=>!opt.disabled && opt.value===room.settings[label]))continue;
     if(el.type==='checkbox')el.checked=room.settings[label]==='true';
     else el.value=room.settings[label];
     el.dispatchEvent(new Event('input',{bubbles:true}));
     el.dispatchEvent(new Event('change',{bubbles:true}));applied++;
   }
   const groups={modes:'.mods .custom-checkbox',maps:'.maps .custom-checkbox',weapons:'.weapons-cont .custom-checkbox'};
   for(const [group,selector] of Object.entries(groups)){
     for(const item of Array.from(container.querySelectorAll(selector)).slice(0,64)){
       const box=item.querySelector('input[type="checkbox"]');
       const label=trim(item.querySelector('span,label')?.textContent||'',70);
       const key='ks-group:'+group+':'+label;
       if(!box||!label||!Object.prototype.hasOwnProperty.call(room.settings,key))continue;
       const wanted=room.settings[key]==='true';
       // A real user initiated the preset action. Let the game's own event
       // handler process checkbox changes rather than silently changing state.
       if(box.checked!==wanted){box.click();applied++;}
     }
   }
   status=applied+' visible lobby fields (including supported mode/map/weapon choices) restored.';
 }
 function recordJoin(value){
   const url=kirkaURL(value);if(!url)return false;
   cfg.history=[{url,time:new Date().toISOString()},...cfg.history.filter(x=>x.url!==url)].slice(0,20);save();return true;
 }
 async function goRoom(url,notify,ui,spectate=false){
   const safe=kirkaURL(url);if(!safe){status='Invalid Kirka.io link';return}
   const deep=window.__KS_DEEP__;
   const accepted=deep?await deep.join(safe,spectate):!spectate && /^\/(games\/|hub\/ranked|servers\/)/.test(new URL(safe).pathname) && notify('game-join',{url:safe});
   if(accepted){recordJoin(safe);status=spectate?'Spectate requested.':'Room navigation requested.';}
   else status=deep?.getStatus().lastError||'Room action unavailable.';
   const node=ui.getElementById('ks-wk-status');if(node)node.textContent=window.__KS_CLIENT__?.translate(status) ?? status;
 }
 async function localSkin(file){
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1024*1024)throw Error('Choose a PNG, JPEG or WebP up to 1 MiB');
   const image=await createImageBitmap(file);
   try{
     if(Math.max(image.width,image.height)>2048)throw Error('Maximum skin dimension is 2048 pixels');
     const ratio=Math.min(1,512/Math.max(image.width,image.height)),canvas=document.createElement('canvas');
     canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
     canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
     const encoded=canvas.toDataURL('image/webp',.85);
     if(encoded.length>180000)throw Error('Choose a smaller skin image');
     return encoded;
   }finally{image.close();}
 }
 function saveGraphics(config){
   localStorage.setItem(WG,JSON.stringify(config));window.dispatchEvent(new Event('ks-webgl-settings'));
 }
 function action(a,ui,notify){
   if(a==='wk-asset-refresh')return true;
   if(!a.startsWith('wk-'))return false;
   a=a.slice(3);
   const val=id=>ui.getElementById('ks-wk-'+id)?.value??'';
   const flag=id=>!!ui.getElementById('ks-wk-'+id)?.checked;
   const number=(id,min,max,def)=>clamp(val(id),min,max,def);
   if(a.startsWith('look-')){
     const look=readLook(ui),name=trim(val('look-name'),30);
     if(a==='look-reset')cfg.appearance=appearance();
     else if(a==='look-apply')cfg.appearance=look;
     else if(a==='look-save'){if(!name)throw Error('Preset name required');cfg.favoriteLooks=[...cfg.favoriteLooks.filter(x=>x.name!==name),{...look,name}].slice(-12);}
     else if(a.startsWith('look-use-'))cfg.appearance=appearance(cfg.favoriteLooks[Number(a.slice(9))]);
     save();return true;
   }
   if(a.startsWith('pose-')){
     if(a==='pose-bind'){
       const name=window.__KS_WEBGL_COSMETICS__?.selectedWeapon?.(),signature=trim(val('gl-matrix'),90);
       if(!name||!/^[-\d., ]{1,90}$/.test(signature))throw Error('Select a Kirka weapon and enter its calibrated matrix signature first.');
       const config=glCfg(),bindings=(config.weaponPoses||[]).filter(x=>x.name!==name);
       if(bindings.length>=32)throw Error('Maximum 32 weapon poses');
       config.weaponPoses=[...bindings,{...readPose(ui),name,signature}];config.enabled=true;config.matrixSignature='';
       saveGraphics(config);status='Live pose bound to '+name;return true;
     }else if(a==='pose-unbind'){
       const config=glCfg();config.weaponPoses=[];saveGraphics(config);status='Live pose bindings cleared.';return true;
     }else if(a==='pose-export')downloadJSON({format:'ks-viewmodel-poses',version:1,poses:cfg.poses},'KS-poses.json');
     else if(a==='pose-import')return (async()=>{const file=ui.getElementById('ks-wk-pose-file')?.files[0];
       if(!file||file.size>24000)throw Error('Choose a pose JSON up to 24 KiB');const doc=JSON.parse(await file.text());
       if(doc.format!=='ks-viewmodel-poses'||doc.version!==1||!Array.isArray(doc.poses)||doc.poses.length>32)throw Error('Invalid pose pack');
       const incoming=inArray(doc.poses,32,pose);if(incoming.some(x=>!x.name)||incoming.length!==doc.poses.length)throw Error('Invalid pose name');
       const merged=new Map([...cfg.poses,...incoming].map(x=>[x.name,x]));if(merged.size>32)throw Error('Maximum 32 poses');cfg.poses=[...merged.values()];save();return true;})();
     else if(a==='pose-reset')editingPose=pose({});
     else if(a==='pose-save'){const p=readPose(ui);if(!p.name)throw Error('Enter a weapon preset name');if(!cfg.poses.some(x=>x.name===p.name)&&cfg.poses.length>=32)throw Error('Maximum 32 poses');cfg.poses=[...cfg.poses.filter(x=>x.name!==p.name),p];editingPose=p;save();}
     else if(a.startsWith('pose-use-'))editingPose=cfg.poses[Number(a.slice(9))];
     else if(a.startsWith('pose-delete-')){cfg.poses.splice(Number(a.slice(12)),1);save();}
     return true;
   }
   if(a.startsWith('analytics-')){
     const stats=window.__KS_ANALYTICS__;
     if(stats && a==='analytics-export')downloadJSON(stats.exportData(),'KS-Analytics.json');
     if(stats && a==='analytics-reset'&&confirm('Erase local Analytics history?'))stats.reset();
     return true;
   }
   if(a==='gallery'){notify('workshop-gallery',{paths:observedAssets().slice(-12)});return true;}
   if(a==='regions'){window.__KS_KIRKA_STATS__?.open('servers');return true;}
   if(a==='clans'){window.__KS_KIRKA_STATS__?.open('clans');return true;}
   if(a.startsWith('pack-')){
     const [,command,index]=a.split('-'),id=packList[Number(index)]?.id;
     if(command==='remove'&&!confirm(window.__KS_CLIENT__?.translate?.('Remove')||'Remove'))return true;
     notify('resource-packs',{command,id});return true;
   }
   if(a==='kirka-stats'){notify('stats');return true;}
   if(a==='scan-friends')return (async()=>{status=await window.__KS_DEEP__?.scanFriends?.()||'Friends panel unavailable.';return true;})();
   if(a==='open-market'){marketAnchor()?.click();return true;}
   if(a==='filter'){query=trim(val('query'),80);onlyFav=flag('only-fav');sortPrice=flag('price-sort');}
   else if(a.startsWith('profile-')){
     const row=friendRows[Number(a.slice(8))];
     const current=window.__KS_DEEP__?.friendsSnapshot?.().entries.find(x=>x.name===row?.name&&x.id===row?.id&&x.profile===row?.profile);
     if(current?.profile){
       const link=[...document.querySelectorAll('.friends a[href]')].find(a=>a.getClientRects().length&&a.href===new URL(current.profile,location.origin).href);
       link?.click();
     }
   }else if(a==='watch-friend'){
     const name=trim(val('watch-name'),60);
     watchFriend=name?{name,until:Date.now()+60000}:null;
     status=name?'Waiting for the native Spectate control for '+name:'Enter the exact visible name.';
   }else if(a==='watch-cancel'){
     watchFriend=null;status='Friend spectate request cancelled.';
   }else if(a==='gl-report'){
     const report=window.__KS_WEBGL_COSMETICS__?.compatibility?.();
     if(!report)throw Error('Game renderer unavailable.');
     status=JSON.stringify(report);downloadJSON(report,'KS-live-weapon-check.json');
   }else if(a==='gl-discovery'){
     const config=glCfg();config.discover=!config.discover;saveGraphics(config);
     status=config.discover?'Discovery on. Open or reload the weapon in Kirka.':'Texture discovery stopped.';
   }else if(a==='gl-probe'){
     status=window.__KS_WEBGL_COSMETICS__?.matchVisiblePreview?.()||'Renderer unavailable.';
   }else if(a==='gl-use-probe'){
     const url=window.__KS_WEBGL_COSMETICS__?.matchedPreview?.();
     if(!url){status='No matching game texture upload observed.';return true;}
     const config=glCfg();config.assetURL=url;config.enabled=false;config.matrixSignature='';
     localStorage.setItem(WG,JSON.stringify(config));window.dispatchEvent(new Event('ks-webgl-settings'));
     status='Exact texture URL copied. Review and apply the cosmetic settings.';
   }else if(a==='freeze-save'){
     localStorage.setItem(ADV,JSON.stringify({freezeGuard:flag('freeze-on')}));
     status='Frame-yield setting saved. Reload Kirka to apply safely.';
   }else if(a.startsWith('gl-select-')||a.startsWith('gl-remove-')){
     const config=glCfg(),idx=Number(a.split('-').pop()),slot=config.slots?.[idx];
     if(slot){if(a.startsWith('gl-select-'))Object.assign(config,slot,{matrixSignature:''});else config.slots.splice(idx,1);saveGraphics(config);}
   }else if(a==='gl-apply'||a==='gl-bind'||a==='gl-auto-bind'){
     return (async()=>{
     const prev=glCfg(),file=ui.getElementById('ks-wk-gl-file')?.files?.[0];
     const auto=a==='gl-auto-bind',renderer=window.__KS_WEBGL_COSMETICS__;
     const source=auto?renderer?.bindingSource?.():trim(val('gl-source'),450);
     const selected=auto?renderer?.selectedWeapon?.():'';
     if(auto&&(!source||!selected))throw Error('Select a supported default weapon, or enable discovery and open a weapon with an observed texture.');
     const x={discover:prev.discover===true,weaponPoses:prev.weaponPoses||[],enabled:auto||flag('gl-enabled'),assetURL:source,skinURL:file?await localSkin(file):imgURL(val('gl-skin'))||(prev.skinURL?.startsWith('data:')?prev.skinURL:''),slots:prev.slots||[],
       hue:number('gl-hue',0,360,0),saturation:number('gl-saturation',20,300,100),
       brightness:number('gl-brightness',20,250,100),scale:number('gl-scale',50,150,100),
       offsetX:Math.min(2,Math.max(-2,Number(val('gl-x'))||0)),
       offsetY:Math.min(2,Math.max(-2,Number(val('gl-y'))||0)),
       offsetZ:Math.min(2,Math.max(-2,Number(val('gl-z'))||0)),
       matrixSignature:trim(val('gl-matrix'),90)};
     if((x.enabled||a==='gl-bind')&&(!/^https:\/\/(?:www\.)?kirka\.io\/assets\/(?:img|media|textures|skins|ui)\//i.test(x.assetURL)||!x.skinURL)){
       status='3D texture replacement needs exact Kirka asset URL and HTTPS skin URL.';return true;
     }
     if(x.matrixSignature&&!/^[\d., -]{1,90}$/.test(x.matrixSignature)){status='Invalid calibration signature';return true;}
     if(a==='gl-bind'||auto){
       const name=selected||trim(val('gl-name'),48);if(!name)throw Error('Preset name required');
       const slots=x.slots.filter(p=>p.assetURL!==x.assetURL);
       if(slots.length>=8)throw Error('Maximum eight weapon bindings');
       x.slots=[...slots,{name,assetURL:x.assetURL,skinURL:x.skinURL,hue:x.hue,saturation:x.saturation,brightness:x.brightness}];
     }
     saveGraphics(x);
     status='3D cosmetics saved; reload gameplay if the texture was already loaded.';
     return true;
     })();
   }else if(a==='gl-reset'){
     saveGraphics({enabled:false,slots:glCfg().slots||[]});
     status='3D cosmetics disabled. Reload game to restore previously uploaded textures.';
   }else if(a==='weapon-apply'){
     Object.assign(cfg.weapon,{enabled:flag('weapon-on'),hue:number('weapon-hue',0,360,0),saturation:number('weapon-saturation',40,200,100),
       brightness:number('weapon-brightness',50,150,100),skinURL:imgURL(val('skin-url'))||''});
     status='Local weapon and inventory visual settings updated.';save();
   }else if(a==='hud-apply'){
     const marker=val('marker-id').trim();
     if(marker && !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(marker)){status='Enter a single HTML element ID.';return true;}
     cfg.markerId=marker;cfg.markerColor=color(val('marker-color'),'#ffffff');
     cfg.killfeedColors=flag('killfeed-on');
     cfg.gameHudTheme=['original','compact','amber','ice'].includes(val('hud-theme'))?val('hud-theme'):'original';
     status='Visible HUD style updated locally.';save();
   }else if(a==='weapon-reset'){cfg.weapon={...EMPTY().weapon};status='Local weapon cosmetics removed.';save();}
   else if(a==='weapon-save'){
     const name=trim(val('weapon-name'),36);if(!name){status='Preset name required';return true}
     const preset={name,hue:number('weapon-hue',0,360,0),saturation:number('weapon-saturation',40,200,100),brightness:number('weapon-brightness',50,150,100),skinURL:imgURL(val('skin-url'))||''};
     cfg.weapon.presets=[...cfg.weapon.presets.filter(x=>x.name!==name),preset].slice(-12);save();
   }else if(a.startsWith('weapon-use-')){
     const preset=cfg.weapon.presets[Number(a.slice(11))];if(preset){Object.assign(cfg.weapon,preset,{enabled:true});save();}
   }else if(a.startsWith('weapon-delete-')){cfg.weapon.presets.splice(Number(a.slice(14)),1);save();}
   else if(a==='swap-toggle'){cfg.swapEnabled=flag('swap-on');save();notify('resource-save',{enabled:cfg.swapEnabled});status='Native resource-swap setting requested; reload the game.';}
   else if(a==='swap-folder'){notify('resource-folder');status='Requested the local resource folder.';}
   else if(a==='swap-scan'){notify('resource-scan');status='Scanning local assets…';}
   else if(a==='plugin-save'){
     const name=trim(val('plugin-name'),45),code=trim(val('plugin-code'),12000);
     const p=normalizePlugin({name,code,kind:val('plugin-type'),author:val('plugin-author'),description:val('plugin-description'),category:val('plugin-category'),version:val('plugin-version'),settings:JSON.parse(val('plugin-settings')||'{}'),api:flag('plugin-v2')?2:1});
     if(!p||(!cfg.plugins.some(x=>x.name===name)&&cfg.plugins.length>=12))throw Error('Invalid plugin or plugin limit reached');
     if(activePlugin===name)stopPlugin();
     cfg.plugins=[...cfg.plugins.filter(x=>x.name!==name),p];save();status='Plugin saved; not running.';
   }else if(a==='plugin-import'){
     return (async()=>{
       const file=ui.getElementById('ks-wk-plugin-file')?.files?.[0];if(!file||file.size>65536)throw Error('Select a plugin JSON up to 64 KiB');
       const text=await file.text(),ext=file.name.split('.').pop().toLowerCase();
       const doc=ext==='json'?JSON.parse(text):['css','js'].includes(ext)?{format:'ks-plugin',api:2,kind:ext,version:'1.0.0',name:file.name.replace(/\.[^.]+$/,''),code:text}:null;
       const p=doc&&normalizePlugin(doc);
       if(doc?.format!=='ks-plugin'||!p||cfg.plugins.length>=12||cfg.plugins.some(x=>x.name===p.name))throw Error('Incompatible or duplicate plugin');
       cfg.plugins.push({...p,enabled:false});save();return true;
     })();
   }else if(a.startsWith('plugin-toggle-')){
     const p=cfg.plugins[Number(a.slice(14))];if(p){mailbox.delete(p.name);if(activePlugin===p.name)stopPlugin();p.enabled=!p.enabled;save();}
   }else if(a.startsWith('plugin-edit-')){
     const p=cfg.plugins[Number(a.slice(12))];if(p){
       for(const [id,text] of Object.entries({name:p.name,code:p.code,type:p.kind,author:p.author,description:p.description,category:p.category,version:p.version,settings:JSON.stringify(p.settings)}))ui.getElementById('ks-wk-plugin-'+id).value=text;
       ui.getElementById('ks-wk-plugin-v2').checked=p.api===2;
     }
   }else if(a.startsWith('plugin-export-')){
     const p=cfg.plugins[Number(a.slice(14))];if(p)exportPlugin(p);
   }else if(a.startsWith('plugin-run-')){
     const p=cfg.plugins[Number(a.slice(11))];if(p)runPlugin(p,ui);
   }else if(a.startsWith('plugin-delete-')){const [p]=cfg.plugins.splice(Number(a.slice(14)),1);if(p){mailbox.delete(p.name);if(p.name===activePlugin)stopPlugin();}save();}
   else if(a==='plugin-stop'){stopPlugin();const wrap=ui.getElementById('ks-wk-plugin-preview');if(wrap)wrap.replaceChildren(document.createTextNode('Preview stopped.'));}
   else if(a==='room-capture'){status='Captured '+Object.keys(captureLobby()).length+' editable native lobby controls; save a room to retain them.';}
   else if(a==='room-save'){
     const url=kirkaURL(val('room-url'));if(!url){status='Valid Kirka.io room link required.';return true}
     const room={url,name:trim(val('room-name'),45)||'Favorite room',settings:captureLobby()};
     cfg.rooms=[...cfg.rooms.filter(x=>x.url!==url),room].slice(-25);save();
   }else if(a.startsWith('room-use-')){
     const r=cfg.rooms[Number(a.slice(9))];if(r)applyLobby(r);
   }else if(a.startsWith('room-join-')){
     const r=cfg.rooms[Number(a.slice(10))];if(r)void goRoom(r.url,notify,ui);
   }else if(a.startsWith('room-spectate-')){
     const r=cfg.rooms[Number(a.slice('room-spectate-'.length))];
     if(r&&window.__KS_DEEP__?.join)void goRoom(r.url,notify,ui,true);
     else status='Spectate requires an available Kirka native join modal.';
   }else if(a.startsWith('room-delete-')){cfg.rooms.splice(Number(a.slice(12)),1);save();}
   else if(a.startsWith('history-use-')){const h=cfg.history[Number(a.slice(12))];if(h)void goRoom(h.url,notify,ui);}
   else if(a.startsWith('history-delete-')){cfg.history.splice(Number(a.slice(15)),1);save();}
   else if(a==='friend-save'){
     const nick=trim(val('friend-nick'),55);if(!nick){status='A nickname is required.';return true}
     const entry={nick,tag:trim(val('friend-tag'),32),favorite:flag('friend-favorite'),note:trim(val('friend-note'),130),color:color(val('friend-color'),'#f0aa35')};
     cfg.friends=[...cfg.friends.filter(x=>x.nick.toLowerCase()!==nick.toLowerCase()),entry].slice(-60);save();
   }else if(a.startsWith('friend-delete-')){cfg.friends.splice(Number(a.slice(14)),1);save();}
   else if(a==='item-save'){
     const item=trim(val('item-name'),80);if(!item){status='An item name is required.';return true}
     const entry={item,note:trim(val('item-note'),130),price:number('item-price',0,100000000,0),favorite:flag('item-favorite')};
     cfg.inventory=[...cfg.inventory.filter(x=>x.item.toLowerCase()!==item.toLowerCase()),entry].slice(-100);save();
   }else if(a.startsWith('item-delete-')){cfg.inventory.splice(Number(a.slice(12)),1);save();}
   else return false;
   return true;
 }
 let pluginListener=null,pluginCSS=null,pluginFrame=null;
 function scopedCSS(code){
   const rules=[],str=code.replace(/\/\*[\s\S]*?\*\//g,'').trim();
   const pattern=/\s*([^{}]+)\{([^{}]+)\}\s*/gy;
   let index=0;
   while(index<str.length){
     const match=pattern.exec(str);if(!match||rules.length>=40)return null;
     const selector=match[1].trim(),styles=match[2].split(';').map(x=>x.trim()).filter(Boolean);
     if(!cssTargets.includes(selector)||!styles.length||!styles.every(x=>/^(color|background-color|border-color)\s*:\s*#[0-9a-f]{6}$/i.test(x)))return null;
     rules.push(selector+'{'+styles.join(';')+'}');index=pattern.lastIndex;
   }
   return rules.length?rules.join('\n'):null;
 }
 function normalizePlugin(x){
   const version=trim(x.version||'1.0.0',24),api=x.api??1;
   if(typeof x.code!=='string'||x.code.length>12000)return null;
   const name=trim(x.name,45),code=x.code.trim();
   if(!name||!code||![1,2].includes(api)||!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version))return null;
   const settings=isObject(x.settings)?x.settings:{};
   if(JSON.stringify(settings).length>2000)return null;
   const kind=x.kind??'js';
   if(!['css','js'].includes(kind)||kind==='css'&&!scopedCSS(code))return null;
   const permissions=kind==='css'?['scoped-colors']:api===2?['panel','snapshot','events','messages']:['preview','panel','snapshot'];
   if(x.permissions&&(!Array.isArray(x.permissions)||x.permissions.some(p=>!permissions.includes(p))))return null;
   return {name,code,api,kind,author:trim(x.author,60),description:trim(x.description,240),category:trim(x.category,32),
     permissions:x.permissions||permissions,version,enabled:x.enabled!==false,settings};
 }
 const pluginLog=[],mailbox=new Map();
 let activePlugin=null,cleanupWorker=null,workerStop=null;
 function recordError(text){pluginLog.push(trim(text,160));if(pluginLog.length>20)pluginLog.shift();}
 function exportPlugin(p){
   const url=URL.createObjectURL(new Blob([JSON.stringify({format:'ks-plugin',...p},null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download='KS-plugin.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 // Serialized into an opaque-origin iframe. Only its dedicated worker executes imported v2 code.
 function isolatedRunner(){
   let worker=null;
   addEventListener('message',e=>{
     if(e.source!==parent)return;
     if(e.data?.type==='start'&&!worker){
       const boot='const post=self.postMessage.bind(self),handlers=new Map();let init,request=0;const pending=new Map();'+
         'self.onmessage=e=>{const d=e.data;if(d.type==="ping"){post({type:"alive"});return}if(d.type==="reply"){pending.get(d.id)?.(d.value);pending.delete(d.id);return}if(d.type==="event"){for(const cb of handlers.get(d.name)||[])cb(d.value);return}if(d.type==="init"&&!init){init=true;'+
         'self.ks=Object.freeze({apiVersion:2,settings:Object.freeze(d.settings),send:(to,text)=>post({type:"send",to:String(to).slice(0,45),text:String(text).slice(0,140)}),message:text=>post({type:"panel",text:String(text).slice(0,180)}),panel:text=>post({type:"panel",text:String(text).slice(0,180)}),on:(name,fn)=>{if(!["scene","settings","shortcut","message"].includes(name)||typeof fn!=="function")throw Error("Unknown event");if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);return ()=>handlers.get(name).delete(fn)},snapshot:()=>new Promise(resolve=>{if(pending.size>=4)return resolve(null);const id=++request;pending.set(id,resolve);post({type:"snapshot",id})})});(new Function(d.code))()}}';
       const url=URL.createObjectURL(new Blob([boot],{type:'text/javascript'}));
       worker=new Worker(url);URL.revokeObjectURL(url);
       worker.onmessage=event=>parent.postMessage({ksV2:event.data},'*');
       worker.onerror=err=>parent.postMessage({ksV2:{type:'error',text:String(err.message).slice(0,160)}},'*');
       worker.postMessage({type:'init',settings:e.data.settings,code:e.data.code});
     }else if(worker)worker.postMessage(e.data);
   });
 }
 function startWorker(plugin){
   stopPlugin();
   const frame=document.createElement('iframe'),out=document.createElement('output');
   frame.hidden=true;frame.setAttribute('sandbox','allow-scripts');
   out.hidden=true;out.style.cssText='position:fixed;bottom:3em;right:1em;z-index:2147483600;pointer-events:none;color:white;background:#13151b;padding:.5em;font:14px system-ui';
   let ping=null,alive=Date.now(),period=Date.now(),calls=0;
   const post=msg=>frame.contentWindow?.postMessage(msg,'*');
   const event=(name,value)=>{if(plugin.permissions.includes(name==='message'?'messages':'events'))post({type:'event',name,value});};
   const off=window.__KS_GAME_RUNTIME__?.on?.('scene',e=>event('scene',e.detail?.to||'unknown'));
   function key(e){if(!e.repeat&&e.isTrusted&&e.altKey&&e.shiftKey&&e.code==='KeyP'&&!document.hidden)event('shortcut','Alt+Shift+P');}
   function settings(e){event('settings',!!e.detail);}
   function listen(e){
     if(e.source!==frame.contentWindow||e.origin!=='null')return;
     const m=e.data?.ksV2;if(!m||typeof m!=='object')return;
     if(Date.now()-period>1000){calls=0;period=Date.now();}
     if(++calls>32||m.type==='error'){recordError(m.type==='error'?m.text:'Plugin message limit exceeded');stopPlugin();return;}
     if(m.type==='alive'){alive=Date.now();return;}
     if(m.type==='send'&&plugin.permissions.includes('messages')){
       const recipient=cfg.plugins.find(p=>p.name===m.to&&p.api===2&&p.enabled);
       if(recipient&&Array.isArray(recipient.settings.allowFrom)&&recipient.settings.allowFrom.includes(plugin.name)){
         const message={from:plugin.name,text:trim(m.text,140)};
         if(recipient.name===activePlugin)event('message',message);
         else mailbox.set(recipient.name,[...(mailbox.get(recipient.name)||[]).slice(-7),message]);
       }
     }
     if(m.type==='panel'&&plugin.permissions.includes('panel')){out.textContent=trim(m.text,180);out.hidden=!out.textContent;}
     if(m.type==='snapshot'&&Number.isSafeInteger(m.id)){
       if(!plugin.permissions.includes('snapshot')){post({type:'reply',id:m.id,value:null});return;}
       const p=window.__KS_FRAME_PACER__?.getStats();
       post({type:'reply',id:m.id,value:{scene:window.__KS_GAME_RUNTIME__?.scene||'unknown',
         settingsOpen:!!window.__KS_CLIENT__?.isSettingsOpen(),callbackFPS:p?.estimatedCallbackFPS??null,
         callbackFrameMs:p?.estimatedCallbackFrameMs??null}});
     }
   }
   const shutdown=()=>{recordError('Plugin time budget reached');stopPlugin();};
   window.addEventListener('message',listen);window.addEventListener('keydown',key);window.addEventListener('ks-settings-visible',settings);
   activePlugin=plugin.name;
   cleanupWorker=()=>{
     clearInterval(ping);clearTimeout(workerStop);off?.();window.removeEventListener('message',listen);
     window.removeEventListener('keydown',key);window.removeEventListener('ks-settings-visible',settings);frame.remove();out.remove();
   };
   frame.onload=()=>{
     post({type:'start',code:plugin.code,settings:plugin.settings});
     const opening=!!window.__KS_CLIENT__?.isSettingsOpen();event('settings',opening);
     for(const m of mailbox.get(plugin.name)||[])if(plugin.settings.allowFrom?.includes?.(m.from))event('message',m);
     mailbox.delete(plugin.name);
     ping=setInterval(()=>{if(!document.hidden&&Date.now()-alive>6500){shutdown();return;}post({type:'ping'});},1500);
   };
   frame.srcdoc='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; worker-src blob:; connect-src \'none\'; form-action \'none\'"><script>('+isolatedRunner.toString()+')()</script>';
   document.body.append(frame,out);workerStop=setTimeout(shutdown,300000);
 }

 function stopPreview(){if(!cleanupWorker)stopPlugin();}
 function stopPlugin(){
   cleanupWorker?.();cleanupWorker=null;activePlugin=null;
   if(pluginListener){window.removeEventListener('message',pluginListener);pluginListener=null;}
   pluginFrame?.remove();pluginFrame=null;
   pluginCSS?.remove();pluginCSS=null;
 }
 function runPlugin(plugin,ui){
   if(plugin.enabled===false)return;
   if(plugin.kind==='css'){
     stopPlugin();const css=scopedCSS(plugin.code);if(!css||!plugin.permissions.includes('scoped-colors'))return;
     activePlugin=plugin.name;pluginCSS=document.createElement('style');pluginCSS.textContent=css;document.head.append(pluginCSS);status='Scoped colors applied locally.';return;
   }
   if(plugin.api===2){startWorker(plugin);status='Plugin started';return;}
   stopPlugin();activePlugin=plugin.name;
   const wrap=ui.getElementById('ks-wk-plugin-preview');if(!wrap)return;
   const frame=document.createElement('iframe');
   pluginFrame=frame;
   frame.setAttribute('sandbox','allow-scripts');
   frame.setAttribute('title','Isolated local plugin preview');
   frame.style.cssText='width:100%;height:150px;border:1px solid #8b6327;border-radius:6px;background:#111;';
   const code64=btoa(unescape(encodeURIComponent(plugin.code)));
   const html='<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39; &#39;unsafe-eval&#39;; style-src &#39;unsafe-inline&#39;; img-src data:; connect-src &#39;none&#39;; form-action &#39;none&#39;">'+
     '<style>body{background:#0d1219;color:#f0aa35;font:14px system-ui;padding:12px}</style></head><body>'+
     '<div id="plugin-status">Isolated plugin preview</div>'+
     '<script>let id=0;const pending=new Map();window.addEventListener("message",e=>{if(e.source===parent&&e.data?.ksWorkshopReply===1&&pending.has(e.data.id)){pending.get(e.data.id)(e.data.snapshot);pending.delete(e.data.id)}});window.ks=Object.freeze({message:function(text){parent.postMessage({ksWorkshopPlugin:1,action:"message",text:String(text).slice(0,140)},"*")},tint:function(target,color){parent.postMessage({ksWorkshopPlugin:1,action:"tint",target:String(target),color:String(color)},"*")},snapshot:function(){return new Promise(resolve=>{let n=++id;pending.set(n,resolve);parent.postMessage({ksWorkshopPlugin:1,action:"snapshot",id:n},"*")})}});</script>'+     '<script>try{(new Function(new TextDecoder().decode(Uint8Array.from(atob("'+code64+'"),c=>c.charCodeAt(0)))))()}catch(e){document.getElementById("plugin-status").textContent="Plugin error: "+String(e.message).slice(0,150)}</script></body></html>';
   const presets={hud:'.script-ui',chat:'#chat',killfeed:'.kill-bar-cont',inventory:'.inventory'};
   let calls=0;
   pluginListener=e=>{
     if(e.origin!=='null'||!frame.isConnected||e.source!==frame.contentWindow||!isObject(e.data)||e.data.ksWorkshopPlugin!==1||++calls>80)return;
     if(plugin.permissions.includes('snapshot')&&e.data.action==='snapshot'&&Number.isSafeInteger(e.data.id)&&e.data.id>0&&e.data.id<=100){
       const data=deepSnapshot();
       const safe={scene:data.scene||'unknown',stats:data.stats||{},observed:data.observed||{},
         friends:data.friends||null,inventory:data.inventory||null,market:data.market||null,profile:data.profile||null,servers:data.servers||null,input:data.input||{}};
       frame.contentWindow?.postMessage({ksWorkshopReply:1,id:e.data.id,snapshot:safe},'*');
     }
     if(plugin.permissions.includes('panel')&&e.data.action==='message'){
       status='Plugin message: '+trim(e.data.text,140);
       const node=ui.getElementById('ks-wk-status');if(node)node.textContent=window.__KS_CLIENT__?.translate(status) ?? status;
     }
     if(plugin.permissions.includes('panel')&&e.data.action==='tint'&&Object.hasOwn(presets,e.data.target)){
       const value=color(e.data.color,'');
       if(!value)return;
       if(!pluginCSS){pluginCSS=document.createElement('style');pluginCSS.id='ks-workshop-plugin-style';document.head.appendChild(pluginCSS);}
       pluginCSS.textContent=presets[e.data.target]+'{color:'+value+'!important;border-color:'+value+'!important}';
       status='Sandboxed plugin applied a cosmetic color to '+e.data.target;
       const node=ui.getElementById('ks-wk-status');if(node)node.textContent=window.__KS_CLIENT__?.translate(status) ?? status;
     }
   };
   window.addEventListener('message',pluginListener);
   frame.srcdoc=html;
   wrap.replaceChildren(frame);
   status='Sandbox plugin running locally; no Kirka.io access granted.';
 }
 let style=null,lastUpdate=0;
 const decorated=new Map();
 function refresh(){
   if(!document.body)return;
   if(!style){style=document.createElement('style');style.id='ks-workshop-cosmetics';document.head.appendChild(style);}
   const panel=document.getElementById('ks-client-root')?.shadowRoot;
   const market=panel?.getElementById('ks-live-market');
   const friendsNode=panel?.getElementById('ks-live-friends');
   if(watchFriend){
     if(!friendsNode || !window.__KS_CLIENT__?.isSettingsOpen() || document.hidden || Date.now()>watchFriend.until){
       watchFriend=null;status='Friend spectate request ended.';
     }else{
       const names=[...document.querySelectorAll('.friends .nickname,.friends .username,.friends .player-name')].filter(el=>
         el.getClientRects().length && getComputedStyle(el).visibility==='visible' && trim(el.textContent,60)===watchFriend.name);
       const row=names.length===1?names[0].closest('.friend,.friend-item,[data-friend-id],li'):null;
       const buttons=row?[...row.querySelectorAll('button,[role="button"]')].filter(el=>
         el.getClientRects().length && getComputedStyle(el).visibility==='visible' && !el.disabled &&
         el.getAttribute('aria-disabled')!=='true' && /^(spectate|megfigyelés)$/i.test(trim(el.getAttribute('aria-label')||el.textContent,40))):[];
       if(buttons.length===1){watchFriend=null;status='Requested spectating through Kirka.';buttons[0].click();}
     }
   }
   if(!document.hidden && window.__KS_CLIENT__?.isSettingsOpen() && (market||friendsNode)){
     updateLists(panel);
   }
   const w=cfg.weapon;
   const filter='hue-rotate('+w.hue+'deg) saturate('+(w.saturation/100)+') brightness('+(w.brightness/100)+')';
   const css=appearanceCSS(cfg.appearance)+(w.enabled?'.inventory img,.weapons img,.weapon-icon img,.weapon-preview img,.item-card img{filter:'+filter+'!important;}':'')+
    (cfg.markerId?'#'+cfg.markerId+'{color:'+cfg.markerColor+'!important;border-color:'+cfg.markerColor+'!important}':'')+
    (cfg.killfeedColors?'.kill-bar-cont .kill-bar-item.blue{color:#73ccff}.kill-bar-cont .kill-bar-item.red{color:#ff7777}':'')+
    (cfg.gameHudTheme==='compact'?'.script-ui .ui-row{transform:scale(.92);transform-origin:top right}':'')+
    (cfg.gameHudTheme==='amber'?'.script-ui .ui-cell{filter:sepia(.35)}':'')+
    (cfg.gameHudTheme==='ice'?'.script-ui .ui-cell{filter:hue-rotate(120deg)}':'');
   if(style.textContent!==css)style.textContent=css;
   if(w.enabled && w.skinURL) {
     for(const img of document.querySelectorAll('.weapon-preview img,.inventory .weapon-icon img,.weapon-card img')){
       if(img.dataset.ksWorkshopSkin===w.skinURL)continue;
       if(!img.dataset.ksWorkshopOriginal)img.dataset.ksWorkshopOriginal=img.src;
       img.src=w.skinURL;img.dataset.ksWorkshopSkin=w.skinURL;
     }
   }else for(const img of document.querySelectorAll('[data-ks-workshop-original]')){
     img.src=img.dataset.ksWorkshopOriginal;delete img.dataset.ksWorkshopOriginal;delete img.dataset.ksWorkshopSkin;
   }
   const next=new Map();
   const friends=new Map(cfg.friends.map(item=>[item.nick.toLowerCase(),item]));
   if(friends.size)for(const el of document.querySelectorAll('.friend .nickname,.profile .nickname,.player-cont .nickname')){
     const item=friends.get(trim(el.textContent,55).toLowerCase());
     if(item)next.set(el,{textShadow:'0 0 5px '+item.color,...(item.note?{title:'KS note: '+item.note}:{})});
   }
   const favorites=new Set(cfg.inventory.filter(x=>x.favorite).map(x=>x.item.toLowerCase()));
   if(favorites.size)for(const el of document.querySelectorAll('.inventory .item-card,.inventory .item,.inventory-item')){
     const title=trim(el.getAttribute('title')||el.querySelector('img')?.alt||el.querySelector('.name')?.textContent,80);
     if(favorites.has(title.toLowerCase()))next.set(el,{outline:'2px solid #f0aa35'});
   }
   for(const [el,fields] of decorated){
     for(const [key,record] of Object.entries(fields)){
       if(next.get(el)?.[key]!==undefined)continue;
       const target=key==='title'?el:el.style;
       if(target[key]===record.applied)target[key]=record.original;
       delete fields[key];
     }
     if(!Object.keys(fields).length)decorated.delete(el);
   }
   for(const [el,values] of next){
     const fields=decorated.get(el)||{};
     for(const [key,value] of Object.entries(values)){
       const target=key==='title'?el:el.style;
       const prev=fields[key];
       if(prev?.value===value && target[key]===prev.applied)continue;
       const original=prev && target[key]===prev.applied?prev.original:target[key];
       target[key]=value;
       fields[key]={original,value,applied:target[key]};
     }
     decorated.set(el,fields);
   }
 }
 window.addEventListener("pagehide",()=>{stopPlugin();mailbox.clear();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&cleanupWorker)stopPlugin();});
 window.__KS_GAME_RUNTIME__?.on("route",stopPlugin);
 let activeTab=null,offRefresh=null,fallbackTimer=null;
 function syncWork(tab){
   if(tab==='Resource Swapper'&&activeTab!==tab)window.__KS_NATIVE__?.post?.({type:'resource-packs',command:'list'});
   activeTab=tab;
   const needed=!document.hidden&&(tab==='Inventory & Market'||tab==='Friends & Profiles'||cfg.weapon.enabled||
     cfg.friends.length||cfg.inventory.some(x=>x.favorite));
   if(needed&&!offRefresh&&!fallbackTimer){
     if(window.__KS_GAME_RUNTIME__?.on)offRefresh=window.__KS_GAME_RUNTIME__.on('refresh',refresh);
     else fallbackTimer=setInterval(refresh,1200);
   }else if(!needed){offRefresh?.();offRefresh=null;clearInterval(fallbackTimer);fallbackTimer=null;}
 }
 document.addEventListener('visibilitychange',()=>syncWork(activeTab));
 window.__KS_WORKSHOP__=Object.freeze({
  styles:()=>cfg.plugins.filter(p=>p.kind==='css').map(p=>({name:p.name,kind:'css',author:p.author,version:p.version,enabled:p.enabled,active:activePlugin===p.name})),
  toggleStyle(name,ui){
    const p=cfg.plugins.find(p=>p.kind==='css'&&p.name===name&&p.enabled);if(!p)return false;
    if(activePlugin===p.name)stopPlugin();else runPlugin(p,ui);return true;
  },setPacks,render,action,refresh,syncWork,stopPlugin,stopPreview,cancelWatch:()=>{watchFriend=null;},recordJoin,normalizeWorkshop,reloadProfile:()=>{stopPlugin();mailbox.clear();cfg=read();refresh();syncWork(activeTab);},getStatus:()=>status,getConfig:()=>JSON.parse(JSON.stringify(cfg)),
  setStatus:message=>{status=trim(message,400);},getRoom:idx=>cfg.rooms[idx]||null});
 if(document.body){refresh();}else document.addEventListener('DOMContentLoaded',refresh,{once:true});
 syncWork(null);
})();