'use strict';
// Public route loader values only. Reject expressions and never execute a site's script.
function readRoute(html) {
  const marker = /,u:(\d+),s:"success",l:\$R\[\d+\]=\{initial:/g.exec(html);
  if (!marker) throw Error('Public route has no published data');
  let index = marker.index + marker[0].length, nodes = 0;
  const refs = new Map();
  function take(re) {
    re.lastIndex = index;
    const m = re.exec(html);
    if (m) index = re.lastIndex;
    return m;
  }
  function value(depth) {
    if (depth > 24 || ++nodes > 60000) throw Error('Route too complex');
    const ref = take(/\$R\[(\d{1,6})\](=)?/y);
    if (ref && !ref[2]) {
      if (!refs.has(ref[1])) throw Error('Unsupported reference');
      return refs.get(ref[1]);
    }
    const c = html[index];
    let out;
    if (c === '[' || c === '{') {
      index++;
      const array = c === '[', end = array ? ']' : '}';
      out = array ? [] : Object.create(null);
      if (html[index] !== end) for (;;) {
        if (array) out.push(value(depth+1));
        else {
          const key = take(/(?:[\w$]+|"(?:[^"\\]|\\.)*"):/y);
          if (!key) throw Error('Unsupported field');
          const field = key[0].slice(0,-1);
          out[field.startsWith('"') ? JSON.parse(field) : field] = value(depth+1);
        }
        if (html[index] !== ',') break;
        index++;
      }
      if (html[index++] !== end) throw Error('Invalid route data');
    } else {
      const tok = take(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?|null|!0|!1|void 0/y);
      if (!tok) throw Error('Unsupported route value');
      const raw = tok[0];
      out = raw === '!0' ? true : raw === '!1' ? false : raw === 'void 0' ? null :
        JSON.parse(raw.replace(/\\(\\|x3[Cc])/g, (a,b)=>b==='\\' ? a : '\\u003c'));
    }
    if (ref) refs.set(ref[1],out);
    return out;
  }
  return {data:value(0), stamp:Number(marker[1])};
}
const KS = 'https://kirka-stats.lovable.app', HUB = 'https://kirkahub.online/api';
const TRADES = 'https://kirka.lukeskywalk.com';
const regions = ['eu','na','sa','asia','india','oceania'];
const ranked = new Set(['ranked1V1','ranked2V2','rankedSAD']);
function required(ok) { if (!ok) throw Error('Source unavailable'); }
function list(v) { required(Array.isArray(v)); return v; }
function text(v) { return typeof v === 'string' ? v.slice(0,550) : ''; }
function num(v) { return Number.isFinite(v) && v>=0 ? v : null; }
function fields(obj, keys) {
  return Object.fromEntries(keys.split(' ').map(k=>[k,typeof obj?.[k]==='string'?text(obj[k]):num(obj?.[k])]));
}
const norm = v=>text(v).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function profile(p) {
  required(p?.shortId && p?.name);
  return {...fields(p,'name shortId id bio level clan clanId rank role createdAt coins diamonds klo klo1V1 kloPOINT2V2 kloRanked kloSAD totalXp xpSinceLastLevel xpUntilNextLevel'),
    banReported:p.banned===true||p.isBanned===true||p.ban===true||/^BANNED$/i.test(p.role),
    ...fields(p.stats,'games wins kills deaths headshots scores'),body:text(p.activeBodySkin?.name),weapon:text(p.activeWeapon1Skin?.name)};
}
function board(p) {
  return list(p.results).slice(0,1000).map((r,i)=>({position:i+1,...fields(r,'name shortId userId scores klo clanId membersCount')}));
}
function market(prices,archive) {
  const key = r=>JSON.stringify([r.itemName,r.type]);
  const history=new Map(list(archive).map(r=>[key(r),r]));
  const all=new Map([...archive,...list(prices)].map(r=>[key(r),r]));
  return [...all.values()].filter(r=>r.itemName).map(r=>{
    const h=(history.get(key(r))?.history||[]).filter(x=>num(x)>0);
    const prev=h.at(-2),last=h.at(-1);
    return {name:text(r.itemName),...fields(r,'type rarity average bros bolt fate inventory createdAt'),
      min:h.length?Math.min(...h):null,max:h.length?Math.max(...h):null,trend:prev?(last-prev)*100/prev:null};
  });
}
function inventory(items,prices) {
  const groups=new Map();
  for(const p of prices){const k=norm(p.name); if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
  return list(items).slice(0,8000).map(({item,amount})=>{
    const name=text(item?.name),type=text(item?.parent?.name)||text(item?.type),matches=groups.get(norm(name))||[];
    const exact=matches.filter(p=>norm(p.type)===norm(type));
    const match=exact.length===1?exact[0]:matches.length===1?matches[0]:null;
    return {name,type,rarity:text(item?.rarity),amount:num(amount),average:match?.average||null};
  }).filter(x=>x.name);
}
function rooms(rows) {
  return list(rows).filter(r=>r.name!=='LobbyRoom').map(r=>{
    // Published Kirka room-list schema. Unknown layouts fail closed at region level.
    const count=num(r.clients??r.WNMWnwm),meta=r.metadata??r.WnWwwMm;
    required(Number.isSafeInteger(count) && meta && typeof r.name==='string');
    return {mode:text(r.name),map:text(meta.mapName||meta.wWnMNwWm||meta.wWwWmMnN),count,
      id:text(r.roomId||r.WWMNmww)};
  });
}
async function download(url, body) {
  const response=await fetch(url,{method:body?'POST':'GET',redirect:'error',credentials:'omit',
    signal:AbortSignal.timeout(12000),headers:body?{'Content-Type':'application/json'}:{},
    body:body?JSON.stringify(body):undefined});
  required(response.ok);
  const parts=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;required(size<=8*1024*1024);parts.push(chunk);}
  return Buffer.concat(parts).toString('utf8');
}
function createService(read=download,now=Date.now) {
  const cache=new Map(),pending=new Map(),attempts=[],lastRegionalSuccess=new Map();
  const json=async(url,body)=>JSON.parse(await read(url,body));
  const route=async path=>readRoute(await read(KS+path));
  const wrap=(data,source,stamp=now())=>({data,source,stamp});
  const api=(path,body)=>json(HUB+path,body);
  async function load(kind,q) {
    if(kind==='market'){
      const [p,h]=await Promise.all([json(TRADES+'/priceList.json'),json(TRADES+'/finalUpdatedBaseList.json').catch(()=>[])]);
      return wrap(market(p,h),'KirkaTrades');
    }
    if(kind==='servers'){
      const sampled=json(TRADES+'/playerCount.json').then(data=>list(data).filter(x=>Number.isFinite(Date.parse(x.timestamp))).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp))[0]).catch(()=>null);
      const rows=await Promise.all(regions.map(async region=>{
        const start=performance.now();
        try{
          const result=await json('https://'+region+'.kirka.io/matchmake/');
          const elapsed=Math.round(performance.now()-start), published=rooms(result);
          lastRegionalSuccess.set(region,now());
          return {region,rooms:published,httpMs:elapsed,lastSuccess:now()};
        }catch{return {region,rooms:null,httpMs:null,lastSuccess:lastRegionalSuccess.get(region)??null};}
      }));
      const latest=await sampled;
      required(rows.some(r=>r.rooms)||latest);
      return wrap({regions:rows,sample:latest?regions.map(k=>num(latest[k==='oceania'?'oce':k])):null,
        sampledAt:latest?Date.parse(latest.timestamp):null},'Kirka.io · KirkaTrades');
    }
    if(kind==='inventory'){
      const [items,m]=await Promise.all([api('/inventory/user',{id:q,isShortId:q.length===6}),get('market').catch(()=>({data:[]}))]);
      return wrap(inventory(items,m.data),'KirkaHub · KirkaTrades');
    }
    if(kind==='player' && q.length!==6)return wrap(profile(await api('/user/getProfile',{id:q,isShortId:false})),'KirkaHub');
    if(ranked.has(kind)){
      const r=await api('/leaderboard/'+kind);
      return wrap(list(r.results).map((p,i)=>({position:i+1,...fields(p,'name shortId userId scores klo'),...fields(p.user||p,'name shortId'),rating:num(p.klo??p.score??p.scores)})),'KirkaHub');
    }
    const path=kind==='clan'?'/clans/'+encodeURIComponent(q):kind==='player'?'/player/'+encodeURIComponent(q):kind==='clans'?'/clans':'/leaderboard';
    const {data,stamp}=await route(path);required(data);
    if(kind==='clan'){
      required(data.name && Array.isArray(data.members));
      return wrap({...fields(data,'name id description currentClanWarPosition allScores monthScores createdAt discordLink'),members:data.members.map(m=>({...fields(m,'role allScores monthScores createdAt lastSeen'),...fields(m.user,'name shortId level')}))},'KirkaStats',stamp);
    }
    if(kind==='player')return wrap(profile(data),'KirkaStats',stamp);
    return wrap({rows:board(data).slice(0,kind==='clans'?39:1000),rewards:data.rewards?Object.fromEntries(Object.entries(data.rewards).slice(0,100).map(([rank,items])=>[rank,list(items).slice(0,30).map(i=>({amount:num(i.amount),type:text(i.type),item:i.item?{name:text(i.item.name)}:null}))])):null,endsAt:num(data.remainingTime)===null?null:stamp+data.remainingTime},'KirkaStats',stamp);
  }
  async function get(kind,arg=''){
    required(['market','servers','inventory','player','clan','clans','leaderboard',...ranked].includes(kind));
    let q=typeof arg==='string'?arg.trim():'';
    if(kind==='inventory'||kind==='player'){q=q.replace(/^#/,'');required(/^[\w-]{6,64}$/.test(q));if(q.length===6)q=q.toUpperCase();}
    else if(kind==='clan')required(q.length>0&&q.length<=80&&!/[\u0000-\u001f]/.test(q)&&!['.','..'].includes(q));
    else q='';
    const key=kind+':'+q,old=cache.get(key),time=now();
    if(old&&time<old.next){required(old.value);return old.value;}
    if(pending.has(key))return pending.get(key);
    while(attempts.length && time-attempts[0]>=60000)attempts.shift();
    required(pending.size<6 && attempts.length<48);attempts.push(time);
    const ttl=kind==='inventory'?120000:kind==='market'||ranked.has(kind)?60000:30000;
    const job=load(kind,q).then(value=>{cache.set(key,{next:now()+ttl,value});return value;}).catch(()=>{
      const value=old?.value?{...old.value,stale:true}:null;
      cache.set(key,{next:now()+10000,value});required(value);return value;
    }).finally(()=>{pending.delete(key);while(cache.size>100)cache.delete(cache.keys().next().value);});
    pending.set(key,job);return job;
  }
  return {get};
}
module.exports={readRoute,createService,market,inventory,rooms};
