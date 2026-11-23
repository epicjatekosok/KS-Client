(() => {
  'use strict';
  if(window.__KS_KIRKA_STATS__ || !window.__KS_PUBLIC_STATS__)return;
  const api=window.__KS_PUBLIC_STATS__, players=new Map();
  const hu={
    Players:'Játékosok',Clans:'Klánok',Leaderboard:'Ranglista',Market:'Piac',Servers:'Szerverek',Search:'Keresés',
    'Player ID or known name':'Játékosazonosító vagy ismert név', 'Search skins or weapons':'Skin vagy fegyver keresése',
    'Player ID works for any public profile. Names are matched against the leaderboard and opened clan rosters.':'Azonosítóval bármely nyilvános profilt megkereshetsz. Név szerint a ranglistán és a megnyitott klánok tagjai között kereshetsz.',
    'No results':'Nincs találat','Source unavailable. Try again.':'Az adatforrás nem érhető el. Próbáld újra.',
    Loading:'Betöltés', 'Last successful read':'Utolsó sikeres lekérés', 'Cached data':'Korábbi adat',
    Refresh:'Frissítés',Back:'Vissza',Close:'Bezárás',Next:'Következő',Previous:'Előző',Filter:'Szűrés',
    name:'Név',shortId:'Játékosazonosító',level:'Szint',clan:'Klán',role:'Rang',createdAt:'Létrehozva',
    coins:'Arany',diamonds:'Gyémánt',games:'Mérkőzések',wins:'Győzelmek',kills:'Ölések',deaths:'Halálok',
    headshots:'Fejlövések',scores:'Pont',membersCount:'Tagok',monthScores:'Havi pont',allScores:'Összpont',
    currentClanWarPosition:'Klánháborús helyezés',lastSeen:'Utolsó megfigyelt aktivitás',bio:'Bemutatkozás',
    totalXp:'Összes XP',xpSinceLastLevel:'XP ezen a szinten',xpUntilNextLevel:'XP a következő szintig',
    body:'Karakterkinézet',weapon:'Fegyverkinézet',description:'Leírás',Inventory:'Felszerelés',
    rarity:'Ritkaság',type:'Típus',amount:'Darabszám',average:'Átlagár',inventory:'Nyilvántartott darabszám',
    min:'Korábbi minimum',max:'Korábbi maximum',trend:'Árváltozás (%)',position:'Helyezés',rating:'Értékelés',
    'Win rate (%)':'Győzelmi arány (%)','Estimated inventory value':'Becsült felszerelésérték',
    'Priced entries':'Beárazott tételek','Published rooms':'Nyilvános szobák','Total players':'Összes játékos',
    'Reported subtotal':'Elérhető régiók részösszege',region:'Régió',count:'Játékosok',map:'Pálya',mode:'Játékmód',
    id:'Azonosító','Unavailable':'Nincs adat','Season ends':'Szezon vége',Rewards:'Jutalmak',Solo:'Egyéni',
    'Price details':'Ár részletei','Clan details':'Klánstatisztika','All rarities':'Minden ritkaság','Sort':'Rendezés',
    'Profile':'Profil','Members':'Tagok','Season':'Szezon','Price estimates in coins':'Becsült árak aranyban',
    'Average level':'Átlagos szint','Activity observed (24h)':'Megfigyelt aktivitás (24 óra)',Banned:'Kitiltva',discordLink:'Discord',
    'Regional sample':'Regionális mintavétel','Public matches':'Nyilvános mérkőzések','Joined':'Csatlakozott'
  };
  const english={shortId:'Player ID',createdAt:'Created',membersCount:'Members',monthScores:'Monthly score',allScores:'Lifetime score',
    currentClanWarPosition:'Clan war position',lastSeen:'Last observed activity',totalXp:'Total XP',xpSinceLastLevel:'XP this level',
    xpUntilNextLevel:'XP until next level',body:'Body skin',weapon:'Weapon skin',inventory:'Recorded supply',min:'Historical low',
    max:'Historical high',trend:'Price change (%)',klo1V1:'1v1 KLO',kloRanked:'Ranked KLO',kloPOINT2V2:'2v2 Point KLO',kloSAD:'S&D KLO',klo:'KLO'};
  function t(k){return (document.querySelector('#ks-panel')?.lang==='hu'||language==='hu'?hu[k]:null)||
    window.__KS_CLIENT__?.translate?.(english[k]||k[0].toUpperCase()+k.slice(1))||english[k]||k;}
  let language='en',state,timer,generation=0,previousFocus,busy=false,stack=[];
  const host=document.createElement('section');host.id='ks-public-stats';host.hidden=true;
  const root=host.attachShadow({mode:'open'});document.body.append(host);
  root.innerHTML='<style>:host{all:initial;position:fixed;inset:0;z-index:2147483646;background:#05070bc9;color:#f4f5f8;font:15px/1.5 system-ui,sans-serif;display:grid;place-items:center}:host([hidden]){display:none}article{box-sizing:border-box;width:min(1000px,96vw);height:min(760px,91vh);background:#14161d;border:1px solid #544530;border-radius:14px;display:flex;flex-direction:column;padding:clamp(12px,2vw,24px);gap:10px}header,nav,form,.tools,.pager{display:flex;align-items:center;flex-wrap:wrap;gap:8px}header strong{font-size:22px;margin-right:auto}button,input,select{font:inherit;border:1px solid #484b55;border-radius:6px;background:#22252e;color:inherit;padding:5px 10px}button{cursor:pointer}button:hover,button[aria-current=true]{color:#ffbf62;border-color:#e79d30}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #ffb642}input{min-width:min(260px,55vw)}main{overflow:auto;flex:1;min-height:0}small{color:#bbc1cc}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:7px;border-bottom:1px solid #30343c;overflow-wrap:anywhere}th{color:#ffc26b}h2{margin:5px 0}dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px}dl div{padding:8px;background:#20232b;border-radius:6px}dt{color:#bdc2cd;font-size:13px}dd{margin:2px 0;overflow-wrap:anywhere}section{overflow-x:auto}button:disabled{opacity:.45}</style><article role="dialog" aria-modal="true" aria-label="KirkaStats"><header></header><nav></nav><aside></aside><small role="status"></small><main></main></article>';
  const at=s=>root.querySelector(s),main=at('main'),aside=at('aside'),status=at('[role=status]');
  function el(tag,content){const n=document.createElement(tag);if(content!=null)n.textContent=content;return n;}
  function btn(label,fn){const n=el('button',label);n.type='button';n.onclick=fn;return n;}
  function fmt(x){if(x==null||x==='')return '—';if(typeof x==='number')return x.toLocaleString(language,{maximumFractionDigits:2});
    if(typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x)))return new Date(x).toLocaleString(language);
    return String(x);}
  function display(n,x){if(x instanceof Node)n.append(x);else n.textContent=fmt(x);}
  function stats(parent,obj){const dl=el('dl');for(const [k,v] of Object.entries(obj)){const item=el('div'),dd=el('dd');display(dd,v);item.append(el('dt',t(k)),dd);dl.append(item);}parent.append(dl);}
  function table(cols,rows){const section=el('section'),tab=el('table'),thead=el('thead'),tr=el('tr'),body=el('tbody');
    cols.forEach(c=>tr.append(el('th',t(c))));thead.append(tr);tab.append(thead,body);
    for(const row of rows){const tr=el('tr');row.forEach(v=>{const td=el('td');display(td,v);tr.append(td);});body.append(tr);}
    section.append(tab);main.append(section);}
  function remember(r){const id=r.shortId||r.userId;if(r.name&&id){players.set(id,r.name);if(players.size>6000)players.delete(players.keys().next().value);}}
  function profileButton(r){remember(r);const id=r.shortId||r.userId;return id?btn(r.name,()=>go('player',id)):r.name;}
  function page(rows,cols,convert){const size=32;state.page=Math.min(state.page,Math.max(0,Math.ceil(rows.length/size)-1));
    if(!rows.length){main.append(el('p',t('No results')));return;}
    table(cols,rows.slice(state.page*size,(state.page+1)*size).map(convert));
    if(rows.length>size){const bar=el('div');bar.className='pager';for(const [label,delta] of [['Previous',-1],['Next',1]]){
      const b=btn(t(label),()=>{state.page+=delta;draw();main.scrollTop=0;});b.disabled=(state.page+delta)<0||(state.page+delta)*size>=rows.length;bar.append(b);}
      bar.append(el('small',(state.page+1)+' / '+Math.ceil(rows.length/size)));main.append(bar);}}
  const tabs={search:'Players',clans:'Clans',leaderboard:'Leaderboard',market:'Market',servers:'Servers'};
  function chrome(){
    const back=btn('‹ '+t('Back'),()=>{const old=stack.pop();if(old)enter(old);});back.disabled=!stack.length;
    at('header').replaceChildren(el('strong','KirkaStats'),back,btn(t('Refresh'),()=>reload()),btn('× '+t('Close'),close));
    const nav=at('nav');nav.replaceChildren();for(const [kind,label] of Object.entries(tabs)){
      const b=btn(t(label),()=>go(kind));b.setAttribute('aria-current',String(kind===state.kind||
        ({player:'search',inventory:'search',clan:'clans',skin:'market',ranked1V1:'leaderboard',ranked2V2:'leaderboard',rankedSAD:'leaderboard'})[state.kind]===kind));nav.append(b);}
    aside.replaceChildren();const k=state.kind;
    if(['search','clans','clan','market','inventory','leaderboard','ranked1V1','ranked2V2','rankedSAD'].includes(k)){
      const form=el('form'),input=el('input');input.type='search';input.maxLength=80;
      input.placeholder=t(k==='search'?'Player ID or known name':k==='market'?'Search skins or weapons':'Filter');
      input.setAttribute('aria-label',input.placeholder);input.value=state.filter;
      input.oninput=()=>{state.filter=input.value;state.page=0;draw();};
      form.onsubmit=e=>{e.preventDefault();const q=input.value.trim();if(k==='search'&&/^#?[a-z\d]{6}$/i.test(q))go('player',q);};
      form.append(input);if(k==='search'){const b=el('button',t('Search'));b.type='submit';form.append(b);}
      if(k==='market'){for(const [key,opts] of [['rarity',['','C','R','E','L','M','P']],['sort',['name','average','trend','inventory']]]){
        const sel=el('select');sel.setAttribute('aria-label',t(key==='sort'?'Sort':'rarity'));for(const v of opts){const o=el('option',v?t(v):t('All rarities'));o.value=v;sel.append(o);}
        sel.value=state[key];sel.onchange=()=>{state[key]=sel.value;state.page=0;draw();};form.append(sel);}}
      if(k==='inventory'){
        for(const [key,options] of Object.entries({sort:['name','price ↑','price ↓','rarity','type','favorites'],coverage:['all','priced','missing','favorites']})){
          const sel=el('select');sel.setAttribute('aria-label',key);
          for(const v of options){const o=el('option',v);o.value=v;sel.append(o);}
          sel.value=state[key]||options[0];sel.onchange=()=>{state[key]=sel.value;state.page=0;draw();};form.append(sel);
        }
        for(const key of ['Minimum price','Maximum price']){const box=el('input');box.type='number';box.min='0';box.placeholder=key;box.setAttribute('aria-label',key);box.value=state[key]??'';
          box.oninput=()=>{state[key]=box.value;state.page=0;draw();};form.append(box);}
      }
      aside.append(form);}
    if(k==='leaderboard'||k.startsWith('ranked')){const modes=el('div');modes.className='tools';for(const [a,b] of Object.entries({leaderboard:'Solo',ranked1V1:'1v1',ranked2V2:'2v2',rankedSAD:'S&D'}))modes.append(btn(t(b),()=>go(a)));aside.append(modes);}
  }
  function draw(){
    const k=state.kind,d=state.payload?.data,q=state.filter.trim().toLowerCase(),has=(...vs)=>vs.some(v=>String(v??'').toLowerCase().includes(q));
    main.replaceChildren();
    if(k==='search'){
      main.append(el('p',t('Player ID works for any public profile. Names are matched against the leaderboard and opened clan rosters.')));
      for(const r of d?.rows||[])remember(r);
      const rows=[...players].filter(([id,name])=>has(id,name));page(rows,['name','id'],([id,name])=>[btn(name,()=>go('player',id)),id]);return;
    }
    if(!d)return;
    if(k==='player'){
      main.append(el('h2',d.name+'  #'+d.shortId),btn(t('Inventory'),()=>go('inventory',d.shortId)));
      if(d.rank){const badge=el('strong',t('rank')+' · '+d.rank);badge.className='rank';main.append(badge);}
      const ratio=(a,b,f=1)=>a!=null&&b>0?a/b*f:null;
      const {id,name,shortId,banReported,...details}=d;if(banReported)main.append(el('strong',t('Banned')));
      stats(main,{...details,clan:d.clan?btn(d.clan,()=>go('clan',d.clan)):null,'K/D':ratio(d.kills,d.deaths),'Win rate (%)':ratio(d.wins,d.games,100)});return;
    }
    if(k==='inventory'){const priced=d.filter(x=>x.average>0&&x.amount!=null);stats(main,{'Estimated inventory value':priced.length?priced.reduce((sum,x)=>sum+x.average*x.amount,0):null,'Priced entries':priced.length+' / '+d.length});
      const favorites=new Set((window.__KS_WORKSHOP__?.getConfig()?.inventory||[]).filter(x=>x.favorite).map(x=>x.item.toLowerCase()));
      const fav=r=>favorites.has(r.name.toLowerCase()), rarity=r=>({C:1,R:2,E:3,L:4,M:5,P:6}[r.rarity]||0);
      const rows=d.filter(r=>has(r.name,r.type,r.rarity)&&(state.coverage!=='favorites'||fav(r))&&
        (state.coverage!=='priced'||r.average>0)&&(state.coverage!=='missing'||!r.average)&&
        (!state['Minimum price']||r.average>0&&r.average>=Number(state['Minimum price']))&&
        (!state['Maximum price']||r.average>0&&r.average<=Number(state['Maximum price'])));
      rows.sort((a,b)=>{
        if(state.sort.startsWith('price'))return Number(!a.average)-Number(!b.average)||(state.sort==='price ↑'?1:-1)*(a.average-b.average);
        if(state.sort==='rarity')return rarity(b)-rarity(a)||a.name.localeCompare(b.name);
        if(state.sort==='type')return a.type.localeCompare(b.type)||a.name.localeCompare(b.name);
        if(state.sort==='favorites')return Number(fav(b))-Number(fav(a))||a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
      main.append(el('small',t('Price estimates in coins')+' · KirkaTrades'));
      page(rows,['name','type','rarity','amount','average'],r=>[btn((fav(r)?'★ ':'')+r.name,()=>go('market','',r.name)),r.type,r.rarity,r.amount,r.average??t('Unavailable')]);return;}
    if(k==='clan'){
      const {members,name,...detail}=d;main.append(el('h2',name));const levels=members.map(m=>m.level).filter(Number.isFinite);
      stats(main,{...detail,Members:members.length,'Average level':levels.length?levels.reduce((a,b)=>a+b,0)/levels.length:null,
        'Activity observed (24h)':members.filter(m=>Date.parse(m.lastSeen)>=Date.now()-86400000).length});members.forEach(remember);
      page(members.filter(m=>has(m.name,m.shortId,m.role)).sort((a,b)=>b.monthScores-a.monthScores),['name','level','role','monthScores','allScores','Joined','lastSeen'],m=>[profileButton(m),m.level,m.role,m.monthScores,m.allScores,m.createdAt,m.lastSeen]);return;}
    if(k==='market'||k==='skin'){
      if(k==='skin'){const r=d.find(x=>JSON.stringify([x.name,x.type])===state.arg);
        if(r){main.append(el('h2',r.name),el('small',t('Price estimates in coins')));stats(main,{...r,average:r.average||null,bros:r.bros||null,bolt:r.bolt||null,fate:r.fate||null});}else main.append(el('p',t('No results')));return;}
      const rows=d.filter(r=>has(r.name,r.type)&&(!state.rarity||state.rarity===r.rarity));
      rows.sort((a,b)=>state.sort==='name'?a.name.localeCompare(b.name):(b[state.sort]??-Infinity)-(a[state.sort]??-Infinity));
      page(rows,['name','type','rarity','average','trend'],r=>[btn(r.name,()=>go('skin',JSON.stringify([r.name,r.type]))),r.type,r.rarity,r.average||null,r.trend]);return;}
    if(k==='servers'){
      const regions=d.regions;
      if(d.sample){main.append(el('h2',t('Regional sample')),el('small',new Date(d.sampledAt).toLocaleString(language)));stats(main,{'Total players':d.sample.every(Number.isFinite)?d.sample.reduce((a,b)=>a+b,0):null,...Object.fromEntries(regions.map((r,i)=>[r.region.toUpperCase(),d.sample[i]]))});}
      main.append(el('h2',t('Public matches')));const counts=regions.map(r=>r.rooms?r.rooms.reduce((n,x)=>n+x.count,0):r.sample??null);
      stats(main,{[counts.every(x=>x!=null)?'Total players':'Reported subtotal']:counts.some(x=>x!=null)?counts.reduce((n,x)=>n+(x||0),0):null});
      main.append(el('small','Regional HTTPS room-list response time, including transfer. In-match network latency can differ.'));
      table(['region','count','Published rooms','HTTP (ms)','Last successful read'],regions.map((r,i)=>[r.region.toUpperCase(),counts[i],r.rooms?.length??null,r.httpMs??t('Unavailable'),r.lastSuccess?new Date(r.lastSuccess).toLocaleTimeString(language):null]));
      const rooms=regions.flatMap(r=>(r.rooms||[]).map(x=>[r.region.toUpperCase(),x.mode,x.map,x.id,x.count]));
      if(rooms.length){main.append(el('h2',t('Public matches')));page(rooms,['region','mode','map','id','count'],x=>x);}return;}
    if(k==='clans'||k==='leaderboard'){
      if(d.endsAt)main.append(el('small',t('Season ends')+' · '+new Date(d.endsAt).toLocaleString(language)));
      if(d.rewards){const rewards=el('details');rewards.append(el('summary',t('Rewards')));for(const [rank,items] of Object.entries(d.rewards)){if(Array.isArray(items))rewards.append(el('p','#'+rank+' · '+items.map(x=>fmt(x.amount)+' × '+(x.item?.name||x.type)).join(', ')));}main.append(rewards);}
      const rows=d.rows.filter(r=>has(r.name));
      if(k==='clans')page(rows,['position','name','membersCount','scores'],r=>[r.position,btn(r.name,()=>go('clan',r.name)),r.membersCount,r.scores]);
      else page(rows,['position','name','scores'],r=>[r.position,profileButton(r),r.scores]);return;}
    page(d.filter(r=>has(r.name)),['position','name','rating'],r=>[r.position,profileButton(r),r.rating]);}
  async function reload(){
    if(busy||host.hidden||document.hidden)return;
    busy=true;const version=generation,view=state,k=view.kind;
    clearTimeout(timer);if(!view.payload)status.textContent=t('Loading')+'…';
    try{
      const source=k==='skin'?'market':k==='search'?'leaderboard':k;
      const data=await api.get(source,k==='skin'?'':view.arg);
      if(version!==generation)return;view.payload=data;
      status.textContent=data.source+' · '+t(data.stale?'Cached data':'Last successful read')+' · '+new Date(data.stamp).toLocaleString(language);
      const scroll=main.scrollTop,focus=main.contains(root.activeElement)?root.activeElement?.textContent:null;
      draw();main.scrollTop=scroll;
      if(focus){const next=[...main.querySelectorAll('button,summary')].find(n=>n.textContent===focus);(next||at('header button:last-child')).focus({preventScroll:true});}
    }catch{if(version===generation){status.textContent=t('Source unavailable. Try again.');if(view.payload)status.textContent+=' · '+t('Cached data');}}
    finally{if(version===generation){busy=false;if(!host.hidden&&!document.hidden)timer=setTimeout(reload,k==='inventory'?120000:['market','skin'].includes(k)||k.startsWith('ranked')?60000:30000);}}
  }
  function enter(view){clearTimeout(timer);generation++;busy=false;state=view;chrome();status.textContent='';draw();main.scrollTop=0;(aside.querySelector('input')||at('header button:last-child')).focus({preventScroll:true});reload();}
  function go(kind,arg='',filter=''){if(state)stack.push(state);if(stack.length>14)stack.shift();
    enter({kind,arg,filter,page:0,rarity:'',sort:'name',payload:null});}
  function open(kind='search',arg='',filter=''){
    if(document.pointerLockElement||window.__KS_GAME_RUNTIME__?.getStatus?.()?.scene==='match')return;
    if(host.hidden){previousFocus=document.activeElement;stack=[];state=null;}
    try{language=JSON.parse(localStorage.getItem('ksclient.settings.alpha')||'{}').language||'en';}catch{}
    window.__KS_CLIENT__?.close?.();host.hidden=false;go(kind,arg,filter);(aside.querySelector('input')||at('header button:last-child')).focus();
  }
  function close(){if(host.hidden)return;clearTimeout(timer);generation++;busy=false;host.hidden=true;state=null;stack=[];main.replaceChildren();
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
  host.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}
    if(e.key==='Tab'){const nodes=[...root.querySelectorAll('button:not(:disabled),input,select,summary')];
      if(e.shiftKey&&root.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}
      if(!e.shiftKey&&root.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}});
  host.addEventListener('click',e=>{if(e.composedPath()[0]===host)close();});
  document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement)close();});
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&!host.hidden)reload();});
  window.__KS_KIRKA_STATS__=Object.freeze({open,close});
  const surfaces=[
    ['.clans,.my-clan,.champions-container,.list-top:has(.clan-name)','clans','Clans'],
    ['.trade-window,.inventory,.marketplace,.market','market','Market'],
    ['.friends,.profile-cont,.profile-page,.card-profile','search','Players'],
    ['.servers','servers','Servers'],['.leaderboard-cont','leaderboard','Leaderboard']
  ];
  const clanNames='.clans .clan-name,.my-clan .clan-name,.list-top .clan-name,.champions-list .clan-name';
  const nativeRank='.champions-list .lists .items > .item';
  const clanAtRank=row=>Array.from(row.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
  function selectRank(event){
    const row=event.target.closest?.(nativeRank);if(!row||event.target.closest('[data-ks-public-action]'))return;
    const name=clanAtRank(row);if(!name||name==='~')return;
    if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
    event.preventDefault();open('clan',name);
  }
  for(const ev of ['click','keydown'])document.addEventListener(ev,selectRank);
  const itemNames='.trade-window .oi-name,.trade-window .ii-name,.inventory .name-skin,.inventory .item-name,.inventory .item-card .name,.trade .item-name,.market .listing .name';
  function dataButton(parent,key,label,action,after=false){
    const existing=after?parent.nextElementSibling:parent.querySelector(':scope > [data-ks-public-action]');
    if(existing?.dataset.ksPublicAction===key)return;
    const b=btn(label,e=>{e.preventDefault();e.stopPropagation();action();});
    b.dataset.ksPublicAction=key;
    b.style.cssText='display:inline-block;position:relative;z-index:2;margin:2px 5px;padding:4px 8px;font:600 12px/1.25 system-ui;color:#ffc063;background:#191b21;border:1px solid #765323;border-radius:5px;cursor:pointer';
    if(after)parent.after(b);else parent.prepend(b);
  }
  function nativeLinks(){
    if(document.hidden||document.pointerLockElement||window.__KS_GAME_RUNTIME__?.getStatus?.()?.scene==='match')return;
    for(const [selector,kind,label] of surfaces)for(const panel of document.querySelectorAll(selector)){
      if(!panel.getClientRects().length)continue;
      dataButton(panel,kind,'KirkaStats · '+t(label),()=>open(kind));}
    for(const row of document.querySelectorAll(nativeRank)){
      const name=clanAtRank(row);if(!name||name==='~')continue;
      row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label',t('Clan details')+' · '+name);row.style.cursor='pointer';}
    for(const n of document.querySelectorAll(clanNames)){
      if(n.getClientRects().length)dataButton(n,'clan',t('Clan details'),()=>open('clan',n.textContent.trim()),true);}
    for(const n of document.querySelectorAll('.friends .friend-id,.profile-cont .short-id,.profile-page .short-id,.member-shortid')){
      if(n.getClientRects().length && /^#?[\da-z]{6}$/i.test(n.textContent.trim()))
        dataButton(n,'profile',t('Profile'),()=>open('player',n.textContent.trim()),true);}
  }
  // One contextual price button for the pointed or focused item. Native item clicks still work.
  let lastItem=null;
  function offerPrice(event){
    const n=event.target;
    if(!(n instanceof Element)||document.pointerLockElement||host.contains(n))return;
    const row=n.closest('.offer-item,.inv-item,.inventory .item,.inventory .subject,.inventory .item-card,.trade-window .inventory-item,.market .listing');
    const label=n.closest(itemNames)||row?.querySelector('.oi-name,.ii-name,.name-skin,.item-name,.name,.subj-title');
    if(!label||!label.textContent.trim()||!label.getClientRects().length)return;
    if(lastItem!==label){if(lastItem?.nextElementSibling?.dataset.ksPublicAction==='item')lastItem.nextElementSibling.remove();lastItem=label;}
    dataButton(label,'item',t('Price details'),()=>open('market','',label.textContent.trim()),true);
  }
  for(const event of ['pointerover','focusin','click'])document.addEventListener(event,offerPrice,{passive:true});
  let scheduled=false;
  function schedule(){
    if(scheduled||document.hidden||document.pointerLockElement)return;
    scheduled=true;setTimeout(()=>{scheduled=false;nativeLinks();},500);
  }
  const watch=new MutationObserver(changes=>{
    if(document.pointerLockElement||document.hidden||window.__KS_GAME_RUNTIME__?.getStatus?.()?.scene==='match')return;
    if(changes.some(c=>Array.from(c.addedNodes).some(n=>n.nodeType===1&&!n.hasAttribute('data-ks-public-action'))))schedule();
  });
  watch.observe(document.body,{subtree:true,childList:true});
  document.addEventListener('visibilitychange',schedule);document.addEventListener('pointerlockchange',schedule);
  nativeLinks();
})();
