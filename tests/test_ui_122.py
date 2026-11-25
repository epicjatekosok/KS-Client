"""Offline Chromium verification for the 1.0.0 KS Settings dashboard."""
import json
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
  locales={p.stem:json.loads(p.read_text(encoding='utf8')) for p in (r/'electron-app/locales').glob('*.json')}
  page.evaluate("catalogs => {window.__KS_LOCALES__=catalogs}",locales)
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
  assert info['icons']==7 and info['presets']==6 and info['width']>1100,info
  assert info['bg']=='rgb(8, 10, 14)',info
  for preset,height,smooth in [('Low','720',False),('Medium','1080',True),('High','1440',True),('Ultra','2160',True)]:
   page.locator(f'[data-preset="{preset}"]').click()
   saved=page.evaluate("JSON.parse(localStorage.getItem('ksclient.settings.alpha'))")
   assert (saved['gameResolution'],saved['smoothGameEdges'],saved['fpsLimit'])==(height,smooth,0),saved
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-preset="Low"]').click()""")
  assert page.evaluate("JSON.parse(localStorage.getItem('ksclient.settings.alpha')).qualityProfile")=='Low'
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-cancel').click()""")
  assert not page.evaluate("window.__KS_CLIENT__.isSettingsOpen()")
  assert page.evaluate("JSON.parse(localStorage.getItem('ksclient.settings.alpha')).qualityProfile")=='Native'
  page.evaluate('window.__KS_CLIENT__.open()')
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-preset="High"]').click()""")
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-apply').click()""")
  assert page.evaluate("JSON.parse(localStorage.getItem('ksclient.settings.alpha')).qualityProfile")=='High'
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
  page.locator('.ks-subtab[data-tab="Sharing"]').click()
  language=page.locator('#ks-sidebar-bottom select[data-setting="language"]')
  assert language.is_visible()
  assert language.locator('option[value="de"]').text_content()=='Deutsch'
  assert language.locator('option').count()==15
  assert language.evaluate("el => el.getBoundingClientRect().bottom <= el.closest('#ks-sidebar-bottom').querySelector('.ks-sidebar-foot').getBoundingClientRect().top")
  for width,height in [(800,500),(620,680),(1600,900)]:
   page.set_viewport_size({'width':width,'height':height})
   assert language.evaluate('''el => {
      const a=el.getBoundingClientRect(), b=el.closest('#ks-nav').getBoundingClientRect();
      return a.height>0 && a.top>=b.top && a.bottom<=b.bottom+1;
   }''')

  assert page.locator('#ks-body [data-setting="language"]').count()==0
  picker = language.element_handle()
  page.locator('button[data-group="Interface"]').click()
  assert picker.evaluate("el => el === el.getRootNode().querySelector('#ks-language')")
  language.select_option('de')
  page.locator('button[data-group="Display"]').click()
  page.locator('.ks-subtab[data-tab="Display"]').click()
  assert locales['de']['Game resolution preset'] in page.locator('#ks-body').inner_text()
  assert 'Game resolution preset' not in page.locator('#ks-body').inner_text()
  for code,label in [('de','Einstellungen'),('hi','सेटिंग्स'),('bn','সেটিংস'),('id','Pengaturan'),('ko','설정'),('hu','Beállítások'),('fr','Paramètres'),('es','Configuración'),('pt','Configurações'),('it','Impostazioni'),('ru','Настройки'),('zh','设置'),('ja','設定'),('tr','Ayarlar')]:
   language.select_option(code)
   assert page.locator('#ks-brand-main').text_content()==label
   assert page.locator('#ks-panel').get_attribute('lang')==code
  page.locator('button[data-group="Graphics"]').click()
  page.locator('.ks-subtab[data-tab="Performance"]').click()
  assert 'yeniden başlat' in page.locator('#ks-unlimited-restart-note').text_content()
  page.locator('button[data-group="Interface"]').click()
  page.locator('.ks-subtab[data-tab="Interface"]').click()
  language.select_option('en')
  page.locator('button[data-group="Graphics"]').click()
  page.locator('.ks-subtab[data-tab="Performance"]').click()
  assert 'restart KS Client when you enable Unlimited FPS again' in page.locator('#ks-unlimited-restart-note').text_content()
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
