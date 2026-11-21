"""Offline Chromium verification for the 1.0.0 KS Settings dashboard."""
from pathlib import Path
from playwright.sync_api import sync_playwright
r=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for engine in ('Electron',):
  page=browser.new_page(viewport={'width':1600,'height':900})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('dialog',lambda d:d.accept())
  page.set_content('<html><head></head><body><main>Mock Kirka</main><aside style="position:fixed;right:45px;bottom:75px"><a id="game-discord" href="https://discord.gg/other">Discord</a></aside></body></html>')
  page.evaluate("""() => {
   window.__KS_TEST_LOCATION__={hostname:'kirka.io',protocol:'https:',pathname:'/',href:'https://kirka.io/'};
   window.__out=[];window.__KS_NATIVE__={post:m=>window.__out.push(m)};
   const store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)
   }});
  }""")
  js=(r/('electron-app/overlay/overlay.js')).read_text()
  page.add_script_tag(content=js.replace("  'use strict';","  'use strict'; const location=window.__KS_TEST_LOCATION__;",1))
  page.wait_for_function("!!window.__KS_CLIENT__")
  page.evaluate('window.__KS_CLIENT__.open()')
  info=page.evaluate("""() => {
   const s=document.querySelector('#ks-client-root').shadowRoot;
   const p=s.querySelector('#ks-panel'),tabs=[...s.querySelectorAll('#ks-sidebar-groups .ks-tab')];
   return {title:s.querySelector('#ks-brand-main').textContent,groups:tabs.length,
    icons:tabs.filter(x=>x.querySelector('svg')).length,selected:tabs.find(x=>x.classList.contains('active'))?.dataset.group,
    presets:s.querySelectorAll('.ks-graphic-preset').length,width:p.getBoundingClientRect().width,
    bg:getComputedStyle(p).backgroundColor};
  }""")
  assert info['title']=='Settings' and info['groups']==7 and info['selected']=='Graphics',info
  assert info['icons']==7 and info['presets']==3 and info['width']>1100,info
  assert info['bg']=='rgb(8, 10, 14)',info
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-preset="Low"]').click()""")
  assert page.evaluate("JSON.parse(localStorage.getItem('ksclient.settings.alpha')).performancePreset")=='Low'
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-cancel').click()""")
  assert not page.evaluate("window.__KS_CLIENT__.isSettingsOpen()")
  assert page.evaluate("JSON.parse(localStorage.getItem('ksclient.settings.alpha')).performancePreset")=='Balanced'
  page.evaluate('window.__KS_CLIENT__.open()')
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-preset="High Performance"]').click()""")
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-apply').click()""")
  assert page.evaluate("JSON.parse(localStorage.getItem('ksclient.settings.alpha')).performancePreset")=='High Performance'
  page.evaluate('window.__KS_CLIENT__.open()')
  categories={}
  for name in ('Graphics','Display','Gameplay','Workshop','Controls','Interface','Advanced'):
   categories[name]=page.evaluate("""name => {
    const s=document.querySelector('#ks-client-root').shadowRoot;
    s.querySelector('[data-group="'+name+'"]').click();
    return [...s.querySelectorAll('.ks-subtab')].map(x=>x.dataset.tab);
   }""",name)
  assert categories['Graphics']==['Performance','Frame Stability','Browser Graphics','Browser GPU Info']
  assert categories['Display']==['Display','Eye Comfort','Crosshair']
  assert categories['Gameplay']==['Game Integration','Lobby','Friends & Profiles']
  assert categories['Controls']==['Browser Controls']
  assert categories['Advanced']==['General','Updates','Sharing','Diagnostics']
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-discord-menu').click()""")
  assert page.evaluate("window.__out.some(m=>m.type==='discord-community')")
  page.evaluate("""() => window.__KS_CLIENT__.setCommunityStatus('KS Discord invite handed to Windows default browser.')""")
  assert 'default browser' in page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-community-status').textContent""")
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-close').click()""")
  assert not page.evaluate("window.__KS_CLIENT__.isSettingsOpen()")
  assert page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-discord-quick').style.display""")=='inline-flex'
  page.locator('#game-discord').click()
  assert len(page.evaluate("window.__out.filter(m=>m.type==='discord-community')"))>=2
  assert not errors,errors
  page.close()
  print('PASS 1.0.0 full orange gamer UI, categories, presets, Cancel/Apply and Discord',engine)
 browser.close()
