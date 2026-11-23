// Foreground time in observable game scenes. Keep aggregate totals independently of recent sessions.
(() => {
  'use strict';
  const runtime = window.__KS_GAME_RUNTIME__;
  if (!runtime || window.__KS_ANALYTICS__) return;
  const key = 'ksclient.analytics.v1';
  const empty = () => ({version:1, days:{}, sessions:[], completed:0, completedMs:0, interrupted:0});
  let data = empty(), warning = '';
  try {
    const previous = JSON.parse(localStorage.getItem(key));
    if (previous && previous.version === 1 && previous.days && Array.isArray(previous.sessions)) data = previous;
  } catch { warning = 'Previous analytics could not be read.'; }
  const session = () => ({start:Date.now(), end:Date.now(), match:0, menu:0});
  let current = session(), last = Date.now(), saved = last, scene = runtime.scene, matchMs = 0;
  let region = 'Unknown', active = !document.hidden && document.hasFocus(), settings = false;
  function dayKey(date) {
    return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
  }
  function flush() {
    const sessions = data.sessions.filter(s => s.start !== current.start);
    if (current.match || current.menu) sessions.push(current);
    data.sessions = sessions.slice(-200);
    try { localStorage.setItem(key, JSON.stringify(data)); saved = Date.now(); }
    catch { warning = 'Analytics storage is full or unavailable. Export your history.'; }
  }
  function tick(now = Date.now()) {
    const elapsed = now-last, kind = settings ? 'menu' : scene === 'match' ? 'match' : scene === 'loading' ? null : 'menu';
    if (active && kind && elapsed > 0 && elapsed <= 90000) {
      current[kind] += elapsed; current.end = now;
      if (kind === 'match') matchMs += elapsed;
      while (last < now) {
        const d = new Date(last), key = dayKey(d);
        d.setHours(24,0,0,0);
        const end = Math.min(now,d.getTime()), amount = end-last;
        const bucket = data.days[key] ||= {menu:0,match:0,regions:{}};
        bucket[kind] += amount;
        if (kind === 'match') bucket.regions[region] = (bucket.regions[region] || 0) + amount;
        last=end;
      }
    }
    last = now;
    if (now-saved >= 30000) flush();
  }
  runtime.on('refresh',() => {
    tick();
    if(scene === 'lobby' || scene === 'servers'){
      const label = document.querySelector('.select-region')?.textContent.trim().toUpperCase();
      if (label && /^(EU|NA|SA|ASIA|INDIA|OCEANIA|OCE)$/.test(label)) region=label;
    }
  });
  runtime.on('scene',e => {
    tick();
    if (scene === 'match' && matchMs) {
      if (e.detail.to === 'results') {data.completed++;data.completedMs+=matchMs;}
      else data.interrupted++;
      matchMs=0;
    }
    scene=e.detail.to; flush();
  });
  function visibility(){tick();active=!document.hidden && document.hasFocus();flush();}
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('blur',visibility);
  window.addEventListener('focus',visibility);
  window.addEventListener('pagehide',()=>{tick();flush();});
  window.addEventListener('ks-settings-visible',e=>{tick();settings=e.detail===true;});
  const duration = ms => Math.floor(ms/3600000)+'h '+Math.floor(ms/60000)%60+'m '+Math.floor(ms/1000)%60+'s';
  function render(acc) {
    tick();flush();
    const days=Object.entries(data.days),regions=new Map(),periods={};
    let match=0,menu=0;
    for(const [date,b] of days){
      match+=b.match;menu+=b.menu;
      for(const [r,time] of Object.entries(b.regions))regions.set(r,(regions.get(r)||0)+time);
      const monday=new Date(date+'T12:00:00');monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
      for(const [group,label] of [['Day',date],['Week',dayKey(monday)],['Month',date.slice(0,7)]]){
        const map=periods[group] ||= new Map();map.set(label,(map.get(label)||0)+b.match);
      }
    }
    const charts=Object.entries(periods).map(([name,map])=>{
      const rows=[...map].sort().slice(-12), max=Math.max(1,...rows.map(r=>r[1]));
      return '<details><summary>'+name+' · active play</summary>'+rows.map(([label,ms])=>'<p>'+acc(label)+' <meter min="0" max="'+max+'" value="'+ms+'"></meter> '+duration(ms)+'</p>').join('')+'</details>';
    }).join('');
    return '<h2 class="ks-title">KS Analytics</h2><div class="ks-card"><p>Active play: '+duration(match)+' · Menus: '+duration(menu)+' · Today: '+duration(data.days[dayKey(new Date())]?.match||0)+'</p><p>Observed match results: '+data.completed+' · Average observed play: '+duration(data.completed?data.completedMs/data.completed:0)+' · Estimated / interrupted visits: '+data.interrupted+'</p>'+charts+
      '<p>'+[...regions].map(([r,t])=>acc(r)+' '+duration(t)).join(' · ')+'</p><details><summary>Recent foreground sessions</summary>'+data.sessions.slice(-30).reverse().map(s=>'<p>'+acc(new Date(s.start).toLocaleString())+' · '+duration(s.match)+' play / '+duration(s.menu)+' menu</p>').join('')+'</details><p>'+acc(warning)+'</p></div>';
  }
  window.__KS_ANALYTICS__=Object.freeze({render,exportData(){tick();flush();return structuredClone(data);},reset(){data=empty();current=session();last=Date.now();matchMs=0;flush();}});
})();
