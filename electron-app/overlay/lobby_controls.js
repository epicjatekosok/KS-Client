// Mount KS controls in Kirka's native lobby and settings navigation.
(() => {
  'use strict';
  if (!['https://kirka.io','https://www.kirka.io'].includes(location.origin) ||
      !window.__KS_CLIENT__ || document.getElementById('ks-lobby-controls-style')) return;
  const style = document.createElement('style');
  style.id = 'ks-lobby-controls-style';
  style.textContent = `
    .settings-and-socicons [data-ks-native-slot] {display:none!important}
    .settings-and-socicons .ks-lobby-control,.settings-holder .ks-settings-entry {
      font:700 18px/1.1 system-ui,sans-serif;cursor:pointer;color:#fff5dd;
      background:#191b23;border:2px solid #aa7429;border-radius:9px;display:inline-flex;
      justify-content:center;align-items:center;gap:9px;padding:8px 12px;min-width:0;
    }
    .settings-and-socicons .ks-lobby-control {align-self:stretch}
    .settings-and-socicons .ks-settings-control {width:66px;flex-shrink:0;color:#ffbf54}
    .settings-and-socicons .ks-community-control {margin-left:8px;flex:1;background:#302348;border-color:#a289e4;color:#f3edff;white-space:nowrap}
    .ks-lobby-control svg {width:26px;height:26px;flex:none}
    .settings-holder .ks-settings-entry {align-self:stretch;font-size:1rem;padding:0 .6rem;white-space:nowrap}
    .ks-lobby-control:hover,.ks-settings-entry:hover {filter:brightness(1.22)}
    .ks-lobby-control:focus-visible,.ks-settings-entry:focus-visible {outline:3px solid #ffbf54;outline-offset:-3px}
  `;
  document.head.append(style);
  const icons = {
    settings:'<path d="M4 6h7m4 0h5M4 12h2m4 0h10M4 18h10m4 0h2"/><circle cx="13" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
    community:'<path d="M4 4h16v12H11l-5 4v-4H4z"/><path d="M8 9h1m3 0h1m3 0h1"/>'
  };
  function button(kind, tab=false) {
    const b=document.createElement('button');
    b.type='button';
    b.className=tab?'ks-settings-entry':'ks-lobby-control ks-'+kind+'-control';
    b.dataset.ksEntry=tab?'tab':kind;
    if(!tab)b.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+icons[kind]+'</svg>';
    if(tab || kind==='community')b.append(tab?'KS Client':'KS Discord');
    b.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      if(kind==='community')window.__KS_CLIENT__.openCommunity();
      else window.__KS_CLIENT__.open();
    });
    return b;
  }
  function bindSlot(bar, source, kind) {
    let b=bar.querySelector('[data-ks-entry="'+kind+'"]');
    if(!b)b=button(kind);
    // Keep Vue's own links in place so remounts and the stock gear remain intact.
    source.dataset.ksNativeSlot=kind;
    if(source.previousElementSibling!==b)source.before(b);
    return b;
  }
  function refresh() {
    const bar=document.querySelector('.settings-and-socicons');
    if(bar){
      const groups=[...bar.querySelectorAll('.soc-group')];
      // Some game builds wrap the entire button in a navigation link.
      const control=el=>el?.closest('a,button') && bar.contains(el.closest('a,button'))?el.closest('a,button'):el;
      const description=el=>[el.textContent,el.getAttribute('href'),el.closest('a')?.getAttribute('href'),
        el.title,el.getAttribute('aria-label'),el.querySelector('use')?.getAttribute('href'),
        el.querySelector('img')?.getAttribute('src')].filter(Boolean).join(' ');
      const client=groups.find(el=>/download|client|letölt/i.test(description(el)));
      const social=groups.find(el=>el!==client&&/discord/i.test(description(el))) ||
        (groups.length===2&&client?groups.find(el=>el!==client):null);
      if(client && social && control(client)!==control(social)){
        bindSlot(bar,control(client),'community');bindSlot(bar,control(social),'settings');
      }
    }
    const header=document.querySelector('.settings-holder .tab-header,.settings-holder [role="tablist"]');
    if(header&&!header.querySelector('[data-ks-entry="tab"]'))header.append(button('settings',true));
    for(const b of document.querySelectorAll('[data-ks-entry]')){
      const key=b.dataset.ksEntry==='community'?'Open KS Client Discord in default browser':'Open KS Client settings';
      const label=window.__KS_CLIENT__.translate(key);
      if(b.title!==label){b.title=label;b.setAttribute('aria-label',label);}
    }
  }
  refresh();
  window.__KS_GAME_RUNTIME__?.on('refresh',event=>{if(event.detail?.scene!=='match')refresh();});
  window.addEventListener('ks-language-changed',refresh);
})();
