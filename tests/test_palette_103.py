"""Beta 1.0.9 UI regression: complete palettes and advanced visual-only extras."""
from pathlib import Path
from playwright.sync_api import sync_playwright

r=Path(__file__).resolve().parents[1]
js=(r/'electron-app/overlay/overlay.js').read_text(encoding='utf8')
assert js==(r/'cef/overlay/overlay.js').read_text(encoding='utf8')
palettes=['Amber','Ember','Ice','Forest','Violet','Midnight','Ocean','Crimson','Cyber',
          'Rose','Sand','Monochrome','Copper']
for name in palettes:
 assert name+':{accent:' in js, name
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for engine in ('Electron','CEF'):
  page=browser.new_page(viewport={'width':1450,'height':910})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content('<html><body><div>Kirka Game</div></body></html>')
  page.evaluate("""() => {
    window.__KS_TEST_LOCATION__={hostname:'kirka.io',protocol:'https:',pathname:'/',href:'https://kirka.io/'};
    window.__KS_NATIVE__={post:()=>{}};
    const store=new Map();window.__store=store;
    Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:key=>store.get(key)||null,setItem:(key,v)=>store.set(key,v),
      removeItem:key=>store.delete(key)
    }});
  }""")
  text=js.replace("  'use strict';","  'use strict'; const location=window.__KS_TEST_LOCATION__;",1)
  page.add_script_tag(content=text)
  page.wait_for_function("!!window.__KS_CLIENT__")
  page.evaluate('window.__KS_CLIENT__.open()')
  page.evaluate("""() => {
    const root=document.querySelector('#ks-client-root').shadowRoot;
    root.querySelector('[data-group="Interface"]').click();
    root.querySelector('[data-tab="Appearance"]').click();
  }""")
  def data():
   return page.evaluate("""() => {
    const root=document.querySelector('#ks-client-root').shadowRoot;
    const saved=JSON.parse(window.__store.get('ksclient.settings.alpha'));
    return {saved,paletteTiles:root.querySelectorAll('[data-palette]').length,
      panelBg:getComputedStyle(root.querySelector('#ks-panel')).backgroundColor,
      radius:getComputedStyle(root.querySelector('#ks-panel')).borderRadius,
      style:root.querySelector('#ks-visual-extras')?.textContent||'',
      version:root.querySelector('#ks-badge').textContent};
   }""")
  before=data()
  assert before['version']=='KS · 1.0.9',before
  assert before['paletteTiles']==13,before
  original={key:before['saved'][key] for key in
    ['gameStats','gameAutoMouseCapture','showFPS','fpsLimit','uiScale','gameQuickJoin']}
  page.evaluate("""() => {
    const root=document.querySelector('#ks-client-root').shadowRoot;
    root.querySelector('[data-palette="Ocean"]').click();
  }""")
  after=data()
  assert after['saved']['themePreset']=='Ocean',after
  for key,color in [('customAccent','#39d0ce'),('customBackground','#09191c'),
                    ('customPanel','#142f33'),('customText','#e4ffff'),
                    ('customMuted','#91bec2')]:
   assert after['saved'][key]==color,(engine,key,after['saved'][key])
  assert after['panelBg']=='rgb(9, 25, 28)',after
  page.evaluate("""() => {
    const root=document.querySelector('#ks-client-root').shadowRoot;
    const choose=(key,value)=>{
      const el=root.querySelector('[data-setting="'+key+'"]');
      if(!el)throw new Error('Missing appearance input '+key);
      el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    };
    choose('themeSurface','Neon');
    choose('themePattern','Grid');
    choose('themeDensity','Spacious');
    choose('themeGlow','70');
    choose('themeRadius','19');
  }""")
  customized=data()
  assert customized['saved']['themeSurface']=='Neon',customized
  assert customized['saved']['themePattern']=='Grid',customized
  assert customized['saved']['themeDensity']=='Spacious',customized
  assert customized['saved']['themeGlow']==70,customized
  assert customized['saved']['themeRadius']==19,customized
  assert 'radial-gradient' not in customized['style'] or 'linear-gradient' in customized['style']
  assert 'Grid' not in customized['radius'] and customized['radius']=='25px',customized
  assert 'background-image:' in customized['style'] and 'padding-top:16px' in customized['style'],customized
  for key,expected in original.items():
   assert customized['saved'][key]==expected,(engine,key)
  page.evaluate("""() => {
    const root=document.querySelector('#ks-client-root').shadowRoot;
    root.querySelector('[data-palette="Amber"]').click();
  }""")
  assert data()['saved']['customAccent']=='#f0aa35'
  assert data()['saved']['customBackground']=='#0d1015'
  # Editing one of the 5 palette swatches must switch to Custom without
  # discarding any gameplay controls or forcing a full client reload.
  page.evaluate("""() => {
    const root=document.querySelector('#ks-client-root').shadowRoot;
    const input=root.querySelector('[data-setting="customPanel"]');
    input.value='#253040';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }""")
  assert data()['saved']['themePreset']=='Custom'
  assert data()['saved']['customPanel']=='#253040'
  assert not errors,(engine,errors)
  page.close()
  print('PASS: Beta 1.0.9 13 palettes + extra appearance without changing gameplay',engine)
 browser.close()
