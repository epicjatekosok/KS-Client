/* KS Client alpha 1.1.12 — independently maintained local Game Workshop.
   No imported third-party source. Settings stay in this browser profile.
   JS extensions run only after an explicit click, in a sandboxed opaque iframe.
*/
(() => {
 'use strict';
 if (window.__KS_WORKSHOP__) return;
 if(location.protocol!=='https:' || !['kirka.io','www.kirka.io'].includes(location.hostname))return;
 const KEY='ksclient.workshop.v1';
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
   if(!isObject(value))value={};
   const d=EMPTY(),w=isObject(value.weapon)?value.weapon:{};
   d.weapon={enabled:w.enabled===true,hue:clamp(w.hue,0,360,0),saturation:clamp(w.saturation,40,200,100),
     brightness:clamp(w.brightness,50,150,100),skinURL:imgURL(w.skinURL)||'',presets:inArray(w.presets,12,p=>{
       const name=trim(p.name,36);return name?{name,hue:clamp(p.hue,0,360,0),saturation:clamp(p.saturation,40,200,100),brightness:clamp(p.brightness,50,150,100),skinURL:imgURL(p.skinURL)||''}:null})};
   d.swapEnabled=value.swapEnabled===true;
   d.killfeedColors=value.killfeedColors===true;
   d.gameHudTheme=['original','compact','amber','ice'].includes(value.gameHudTheme)?value.gameHudTheme:'original';
   d.rooms=inArray(value.rooms,25,x=>{const url=kirkaURL(x.url),name=trim(x.name,45);return url?{name:name||'Saved room',url,settings:isObject(x.settings)?limitSettings(x.settings):{}}:null});
   d.history=inArray(value.history,20,x=>{const url=kirkaURL(x.url);return url?{url,time:trim(x.time,32)}:null});
   d.friends=inArray(value.friends,60,x=>{const nick=trim(x.nick,55),note=trim(x.note,130);return nick?{nick,note,color:color(x.color,'#f0aa35')}:null});
   d.inventory=inArray(value.inventory,100,x=>{const item=trim(x.item,80);return item?{item,note:trim(x.note,130),favorite:x.favorite===true,price:clamp(x.price,0,100000000,0)}:null});
   d.plugins=inArray(value.plugins,12,x=>{const name=trim(x.name,45),code=trim(x.code,12000);return name&&code?{name,code}:null});
   return d;
 }
 function clamp(v,min,max,fallback){const n=Number(v);return Number.isFinite(n)?Math.round(Math.max(min,Math.min(max,n))):fallback}
 function color(v,fallback){return /^#[0-9a-f]{6}$/i.test(String(v))?String(v):fallback}
 function limitSettings(s){
   const obj={};
   for(const [k,v] of Object.entries(s).slice(0,32)){
     if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')obj[trim(k,80)]=String(v).slice(0,100);
   }
   return obj;
 }
 let cfg=read();
 let status='Workshop features are local to this browser profile.';
 const value=id=>document.getElementById('ks-client-root')?.shadowRoot?.getElementById(id)?.value||'';
 const checked=id=>!!document.getElementById('ks-client-root')?.shadowRoot?.getElementById(id)?.checked;
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(cfg));}catch(e){status='Cannot save workshop data: '+e.message}refresh();};
 const btn=(action,name,extra='')=>'<button class="ks-btn" data-action="wk-'+action+'" '+extra+'>'+escape(name)+'</button>';
 const input=(id,label,v='',kind='text')=>'<label class="ks-row"><span class="ks-label">'+escape(label)+'</span><input class="ks-input" id="ks-wk-'+id+'" type="'+kind+'" value="'+escape(v)+'" maxlength="480"></label>';
 const card=(title,content)=>'<div class="ks-card"><h3 class="ks-section-heading">'+escape(title)+'</h3>'+content+'</div>';
 const notice='<p class="ks-hint">Local-only appearance and convenience tools; never changes player inventory, server data, weapon damage or hit detection.</p>';
 const list=(items,what)=>items.length?items.map((x,i)=>'<div class="ks-row"><span>'+escape(x.name||x.nick||x.item||x.url||'Item')+'</span>'+btn(what+'-use-'+i,'Use')+btn(what+'-delete-'+i,'Remove')+'</div>').join(''):'<p class="ks-hint">No saved entries yet.</p>';
 const srcmsg='Your own script runs only inside an opaque, sandboxed preview. No game DOM, cookies, Electron, Node.js, network or filesystem access. It never auto-runs.';
 function render(tab){
   if(tab==='Weapon Studio')return '<h2 class="ks-title">Weapon Studio / Custom Skin Link</h2><p class="ks-sub">Local weapon and inventory image cosmetics. 3D WebGL material replacement depends on exact supported game assets.</p>'+
     card('Weapon & inventory visual styling',input('weapon-hue','Hue rotation (0–360)',cfg.weapon.hue,'number')+
       input('weapon-saturation','Saturation % (40–200)',cfg.weapon.saturation,'number')+
       input('weapon-brightness','Brightness % (50–150)',cfg.weapon.brightness,'number')+
       input('skin-url','Custom Skin Link (HTTPS image)',cfg.weapon.skinURL)+
       '<label class="ks-row">Enable local cosmetic styling <input type="checkbox" id="ks-wk-weapon-on" '+(cfg.weapon.enabled?'checked':'')+'></label>'+
       btn('weapon-apply','Apply cosmetics')+' '+btn('weapon-reset','Clear cosmetics'))+
     card('Save weapon presets',input('weapon-name','Preset name')+btn('weapon-save','Save preset')+list(cfg.weapon.presets,'weapon'))+
     card('Game HUD appearance','<label class="ks-row">Colored killfeed <input type="checkbox" id="ks-wk-killfeed-on" '+(cfg.killfeedColors?'checked':'')+'></label>'+
       '<label class="ks-row">HUD style <select class="ks-input" id="ks-wk-hud-theme">'+
       ['original','compact','amber','ice'].map(v=>'<option value="'+v+'" '+(cfg.gameHudTheme===v?'selected':'')+'>'+v+'</option>').join('')+
       '</select></label>'+btn('hud-apply','Apply HUD appearance'))+
     card('Game cosmetic compatibility','<p class="ks-hint">Effects target Kirka.io HTML weapon and inventory previews. For actual 3D texture replacement, use Resource Swapper with an exact game asset path and your own permitted image.</p>')+notice;
   if(tab==='Resource Swapper')return '<h2 class="ks-title">Local Resource Swapper</h2><p class="ks-sub">Opt-in resource replacements in both engines, matched by exact Kirka.io /assets/... paths.</p>'+
     card('Local asset replacement','<p class="ks-hint">Copy permitted PNG, JPG, WebP, MP3, WAV, OGG or CSS files to Documents/KSClient/Swapper/assets/img, media or css, matching Kirka.io /assets/ subpaths. No remote downloads and no JavaScript replacements.</p>'+
       '<label class="ks-row">Enable replacements at startup <input type="checkbox" id="ks-wk-swap-on" '+(cfg.swapEnabled?'checked':'')+'></label>'+
       btn('swap-toggle','Save swapper state')+' '+btn('swap-folder','Open asset folder')+' '+btn('swap-scan','Scan files')+
       '<p class="ks-hint">Changes are applied to new network requests; reload the game after changing files. Some resources are cached, loaded from other hosts or protected by CSP.</p>')+notice;
   if(tab==='Plugins')return '<h2 class="ks-title">Safe JavaScript plugins</h2><p class="ks-sub">'+escape(srcmsg)+'</p>'+
     '<p class="ks-hint">Example: ks.message("Hello!"); ks.tint("hud","#ffaa22"); Available targets: hud, chat, killfeed, inventory. Each run requires a click.</p>'+
     card('Add local plugin',input('plugin-name','Plugin name')+'<textarea id="ks-wk-plugin-code" class="ks-input" rows="7" placeholder="document.body.textContent = &#39;Hello from a sandboxed plugin!&#39;"></textarea>'+btn('plugin-save','Save code'))+
     card('Saved plugins',cfg.plugins.length?cfg.plugins.map((p,i)=>'<div class="ks-row"><div><strong>'+escape(p.name)+'</strong><div class="ks-desc">Sandboxed, manual start</div></div>'+btn('plugin-run-'+i,'Run')+btn('plugin-delete-'+i,'Delete')+'</div>').join(''):'<p class="ks-hint">No scripts saved.</p>')+
     card('Plugin preview','<div id="ks-wk-plugin-preview" class="ks-note">Choose Run to open an isolated preview.</div>'+btn('plugin-stop','Stop preview'))+notice;
   if(tab==='Lobby')return '<h2 class="ks-title">Lobby / Quick Join</h2><p class="ks-sub">Save join links, room notes and supported HTML lobby form values.</p>'+
     card('Save current room',input('room-name','Room name')+input('room-url','Kirka.io room URL',kirkaURL(location.href)||'')+
       btn('room-save','Save room + visible form values')+' '+btn('room-capture','Capture current lobby options'))+
     card('Favorite rooms',cfg.rooms.length?cfg.rooms.map((r,i)=>'<div class="ks-row"><span>'+escape(r.name)+'</span>'+
       btn('room-use-'+i,'Apply preset')+btn('room-join-'+i,'Join')+btn('room-delete-'+i,'Remove')+'</div>').join(''):'<p class="ks-hint">No saved rooms.</p>')+
     card('Recently joined',list(cfg.history.map(h=>({name:h.url,url:h.url})), 'history'))+
     '<p class="ks-hint">Applying lobby settings changes only matching visible HTML controls, never hidden server configuration. Joining still follows Kirka.io permissions.</p>';
   if(tab==='Friends & Profiles')return '<h2 class="ks-title">Friends & Profiles</h2><p class="ks-sub">Local labels and notes for profiles you actually see. No access to private friend lists or invented spectate links.</p>'+
     card('Create local player annotation',input('friend-nick','Visible nickname / player ID')+input('friend-note','Personal note')+
       input('friend-color','Tag color', '#f0aa35','color')+btn('friend-save','Save note'))+
     card('Saved annotations',cfg.friends.length?cfg.friends.map((f,i)=>'<div class="ks-row"><div><strong>'+escape(f.nick)+'</strong><div class="ks-desc">'+escape(f.note)+'</div></div>'+btn('friend-delete-'+i,'Delete')+'</div>').join(''):'<p class="ks-hint">No saved player notes.</p>')+notice;
   if(tab==='Inventory & Market')return '<h2 class="ks-title">Inventory / Market</h2><p class="ks-sub">Personal item favorites, notes and manually entered estimates. No trades, purchases or prices are fabricated.</p>'+
     card('Add item to your list',input('item-name','Item / skin name')+input('item-note','Personal note')+
       input('item-price','Estimated price (manual only)',0,'number')+
       '<label class="ks-row">Favorite <input type="checkbox" id="ks-wk-item-favorite" checked></label>'+btn('item-save','Save item'))+
     card('Saved collection',cfg.inventory.length?cfg.inventory.map((x,i)=>'<div class="ks-row"><div><strong>'+(x.favorite?'★ ':'')+escape(x.item)+'</strong><div class="ks-desc">'+escape(x.note)+' · Manual estimate: '+x.price+'</div></div>'+btn('item-delete-'+i,'Delete')+'</div>').join(''):'<p class="ks-hint">No saved items.</p>')+notice;
   return '';
 }
 function captureLobby(){
   const obj={};
   const area=document.querySelector('.general-content, .create-game, .create-room');
   if(!area)return obj;
   const inputs=Array.from(area.querySelectorAll('input,select')).slice(0,32);
   for(const el of inputs){
     const wrap=el.closest('.element,.items,.setting,.form-group')||el.parentElement;
     const name=trim(wrap?.querySelector('.label, label')?.textContent || el.getAttribute('aria-label')||el.name||el.id,80);
     if(!name||el.type==='password'||el.type==='file'||el.type==='hidden')continue;
     obj[name]=el.type==='checkbox'?String(el.checked):trim(el.value,100);
   }
   return obj;
 }
 function applyLobby(room){
   const entries=Object.entries(room.settings||{});
   if(!entries.length){status='Saved room has no HTML form settings; use Join to navigate.';return}
   const container=document.querySelector('.general-content,.create-game,.create-room');
   if(!container){status='Kirka.io lobby creation form is not visible.';return}
   let applied=0;
   for(const el of Array.from(container.querySelectorAll('input,select')).slice(0,80)){
     const wrap=el.closest('.element,.items,.setting,.form-group')||el.parentElement;
     const label=trim(wrap?.querySelector('.label,label')?.textContent||el.getAttribute('aria-label')||el.name||el.id,80);
     if(!Object.prototype.hasOwnProperty.call(room.settings,label)||!['text','number','range','checkbox','select-one'].includes(el.type))continue;
     if(el.type==='checkbox')el.checked=room.settings[label]==='true';
     else el.value=room.settings[label];
     el.dispatchEvent(new Event('input',{bubbles:true}));
     el.dispatchEvent(new Event('change',{bubbles:true}));applied++;
   }
   status=applied+' visible native lobby fields restored; custom game controls may need manual selection.';
 }
 function recordJoin(value){
   const url=kirkaURL(value);if(!url)return false;
   cfg.history=[{url,time:new Date().toISOString()},...cfg.history.filter(x=>x.url!==url)].slice(0,20);save();return true;
 }
 function goRoom(url,notify){
   const safe=kirkaURL(url);if(!safe){status='Invalid Kirka.io link';return}
   recordJoin(safe);notify('game-join',{url:safe});status='Navigation requested: '+safe;
 }
 function action(a,ui,notify){
   if(!a.startsWith('wk-'))return false;
   a=a.slice(3);
   const val=id=>ui.getElementById('ks-wk-'+id)?.value??'';
   const flag=id=>!!ui.getElementById('ks-wk-'+id)?.checked;
   const number=(id,min,max,def)=>clamp(val(id),min,max,def);
   if(a==='weapon-apply'){
     Object.assign(cfg.weapon,{enabled:flag('weapon-on'),hue:number('weapon-hue',0,360,0),saturation:number('weapon-saturation',40,200,100),
       brightness:number('weapon-brightness',50,150,100),skinURL:imgURL(val('skin-url'))||''});
     status='Local weapon and inventory visual settings updated.';save();
   }else if(a==='hud-apply'){
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
     if(!name||!code||cfg.plugins.length>=12){status='Enter a name and code (maximum 12 plugins).';return true}
     cfg.plugins=[...cfg.plugins.filter(x=>x.name!==name),{name,code}];save();status='Plugin saved; not running.';
   }else if(a.startsWith('plugin-run-')){
     const p=cfg.plugins[Number(a.slice(11))];if(p)runPlugin(p,ui);
   }else if(a.startsWith('plugin-delete-')){cfg.plugins.splice(Number(a.slice(14)),1);save();}
   else if(a==='plugin-stop'){stopPlugin();const wrap=ui.getElementById('ks-wk-plugin-preview');if(wrap)wrap.replaceChildren(document.createTextNode('Preview stopped.'));}
   else if(a==='room-capture'){status='Captured '+Object.keys(captureLobby()).length+' editable native lobby controls; save a room to retain them.';}
   else if(a==='room-save'){
     const url=kirkaURL(val('room-url'));if(!url){status='Valid Kirka.io room link required.';return true}
     const room={url,name:trim(val('room-name'),45)||'Favorite room',settings:captureLobby()};
     cfg.rooms=[...cfg.rooms.filter(x=>x.url!==url),room].slice(-25);save();
   }else if(a.startsWith('room-use-')){
     const r=cfg.rooms[Number(a.slice(9))];if(r)applyLobby(r);
   }else if(a.startsWith('room-join-')){
     const r=cfg.rooms[Number(a.slice(10))];if(r)goRoom(r.url,notify);
   }else if(a.startsWith('room-delete-')){cfg.rooms.splice(Number(a.slice(12)),1);save();}
   else if(a.startsWith('history-use-')){const h=cfg.history[Number(a.slice(12))];if(h)goRoom(h.url,notify);}
   else if(a.startsWith('history-delete-')){cfg.history.splice(Number(a.slice(15)),1);save();}
   else if(a==='friend-save'){
     const nick=trim(val('friend-nick'),55);if(!nick){status='A nickname is required.';return true}
     const entry={nick,note:trim(val('friend-note'),130),color:color(val('friend-color'),'#f0aa35')};
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
 let pluginListener=null,pluginCSS=null;
 function stopPlugin(){
   if(pluginListener){window.removeEventListener('message',pluginListener);pluginListener=null;}
   pluginCSS?.remove();pluginCSS=null;
 }
 function runPlugin(plugin,ui){
   stopPlugin();
   const wrap=ui.getElementById('ks-wk-plugin-preview');if(!wrap)return;
   const frame=document.createElement('iframe');
   frame.setAttribute('sandbox','allow-scripts');
   frame.setAttribute('title','Isolated local plugin preview');
   frame.style.cssText='width:100%;height:150px;border:1px solid #8b6327;border-radius:6px;background:#111;';
   const code64=btoa(unescape(encodeURIComponent(plugin.code)));
   const html='<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39; &#39;unsafe-eval&#39;; style-src &#39;unsafe-inline&#39;; img-src data:; connect-src &#39;none&#39;; form-action &#39;none&#39;">'+
     '<style>body{background:#0d1219;color:#f0aa35;font:14px system-ui;padding:12px}</style></head><body>'+
     '<div id="plugin-status">Isolated plugin preview</div>'+
     '<script>window.ks=Object.freeze({message:function(text){parent.postMessage({ksWorkshopPlugin:1,action:"message",text:String(text).slice(0,140)},"*")},tint:function(target,color){parent.postMessage({ksWorkshopPlugin:1,action:"tint",target:String(target),color:String(color)},"*")}});</script>'+     '<script>try{(new Function(atob("'+code64+'")))()}catch(e){document.getElementById("plugin-status").textContent="Plugin error: "+String(e.message).slice(0,150)}</script></body></html>';
   const presets={hud:'.script-ui',chat:'#chat',killfeed:'.kill-bar-cont',inventory:'.inventory'};
   let calls=0;
   pluginListener=e=>{
     if(e.source!==frame.contentWindow||!isObject(e.data)||e.data.ksWorkshopPlugin!==1||++calls>80)return;
     if(e.data.action==='message'){
       status='Plugin message: '+trim(e.data.text,140);
       const node=ui.getElementById('ks-wk-status');if(node)node.textContent=status;
     }
     if(e.data.action==='tint'&&Object.hasOwn(presets,e.data.target)){
       const value=color(e.data.color,'');
       if(!value)return;
       if(!pluginCSS){pluginCSS=document.createElement('style');pluginCSS.id='ks-workshop-plugin-style';document.head.appendChild(pluginCSS);}
       pluginCSS.textContent=presets[e.data.target]+'{color:'+value+'!important;border-color:'+value+'!important}';
       status='Sandboxed plugin applied a cosmetic color to '+e.data.target;
       const node=ui.getElementById('ks-wk-status');if(node)node.textContent=status;
     }
   };
   window.addEventListener('message',pluginListener);
   frame.srcdoc=html;
   wrap.replaceChildren(frame);
   status='Sandbox plugin running locally; no Kirka.io access granted.';
 }
 let style=null, observer=null, lastUpdate=0;
 function refresh(){
   if(!document.body)return;
   if(!style){style=document.createElement('style');style.id='ks-workshop-cosmetics';document.head.appendChild(style);}
   const w=cfg.weapon;
   const filter='hue-rotate('+w.hue+'deg) saturate('+(w.saturation/100)+') brightness('+(w.brightness/100)+')';
   style.textContent=(w.enabled?'.inventory img,.weapons img,.weapon-icon img,.weapon-preview img,.item-card img{filter:'+filter+'!important;}':'')+
    (cfg.killfeedColors?'.kill-bar-cont .kill-bar-item.blue{color:#73ccff}.kill-bar-cont .kill-bar-item.red{color:#ff7777}':'')+
    (cfg.gameHudTheme==='compact'?'.script-ui .ui-row{transform:scale(.92);transform-origin:top right}':'')+
    (cfg.gameHudTheme==='amber'?'.script-ui .ui-cell{filter:sepia(.35)}':'')+
    (cfg.gameHudTheme==='ice'?'.script-ui .ui-cell{filter:hue-rotate(120deg)}':'');
   if(w.enabled && w.skinURL) {
     for(const img of document.querySelectorAll('.weapon-preview img,.inventory .weapon-icon img,.weapon-card img')){
       if(img.dataset.ksWorkshopSkin===w.skinURL)continue;
       if(!img.dataset.ksWorkshopOriginal)img.dataset.ksWorkshopOriginal=img.src;
       img.src=w.skinURL;img.dataset.ksWorkshopSkin=w.skinURL;
     }
   }else for(const img of document.querySelectorAll('[data-ks-workshop-original]')){
     img.src=img.dataset.ksWorkshopOriginal;delete img.dataset.ksWorkshopOriginal;delete img.dataset.ksWorkshopSkin;
   }
   for(const item of cfg.friends){
     const selectors=['.friend .nickname','.profile .nickname','.player-cont .nickname'];
     for(const el of document.querySelectorAll(selectors.join(','))){
       if(trim(el.textContent,55).toLowerCase()!==item.nick.toLowerCase())continue;
       el.style.textShadow='0 0 5px '+item.color;
       if(item.note)el.title='KS note: '+item.note;
     }
   }
   for(const item of cfg.inventory.filter(x=>x.favorite)){
     for(const el of document.querySelectorAll('.inventory .item-card,.inventory .item,.inventory-item')){
       const title=trim(el.getAttribute('title')||el.querySelector('img')?.alt||el.querySelector('.name')?.textContent,80);
       if(title&&title.toLowerCase()===item.item.toLowerCase())el.style.outline='2px solid #f0aa35';
     }
   }
 }
 function loop(){if(Date.now()-lastUpdate>2200){lastUpdate=Date.now();refresh();}setTimeout(loop,1500);}
 window.__KS_WORKSHOP__=Object.freeze({render,action,refresh,recordJoin,getStatus:()=>status,getConfig:()=>JSON.parse(JSON.stringify(cfg)),
  setStatus:message=>{status=trim(message,400);},getRoom:idx=>cfg.rooms[idx]||null});
 if(document.body){refresh();}else document.addEventListener('DOMContentLoaded',refresh,{once:true});
 loop();
})();