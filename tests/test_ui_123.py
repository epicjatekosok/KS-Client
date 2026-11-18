"""Both Chromium engines: matched Settings/Discord buttons, animated interactions and motion opt-out."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
def check(browser,engine):
  page=browser.new_page(viewport={'width':1500,'height':850})
  errors=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  page.set_content('<html><head></head><body><main>Kirka lobby</main></body></html>')
  page.evaluate("""() => {
    window.__KS_TEST_LOCATION__={hostname:'kirka.io',protocol:'https:',pathname:'/',href:'https://kirka.io/'};
    window.__sent=[];
    window.__KS_NATIVE__={post:message=>window.__sent.push(message)};
    const storage=new Map();
    Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),
      removeItem:k=>storage.delete(k)}});
  }""")
  src=(root/('cef/overlay/overlay.js' if engine=='CEF' else 'electron-app/overlay/overlay.js')).read_text(encoding='utf-8')
  page.add_script_tag(content=src.replace("  'use strict';","  'use strict'; const location=window.__KS_TEST_LOCATION__;",1))
  page.wait_for_function('!!window.__KS_CLIENT__')
  data=page.evaluate("""() => {
    const s=document.querySelector('#ks-client-root').shadowRoot;
    const gear=s.querySelector('#ks-gear'),discord=s.querySelector('#ks-discord-quick');
    const g=getComputedStyle(gear),d=getComputedStyle(discord);
    return {sameParent:gear.parentElement===discord.parentElement,
      parentId:gear.parentElement.id,
      gearHeight:gear.getBoundingClientRect().height,
      discordHeight:discord.getBoundingClientRect().height,
      border:[g.borderTopColor,d.borderTopColor],
      bg:[g.backgroundColor,d.backgroundColor],
      radius:[g.borderRadius,d.borderRadius],
      shadow:[g.boxShadow,d.boxShadow],
      visible:d.display,version:s.querySelector('#ks-badge').textContent,
      interactive:parseFloat(g.transitionDuration)>0
    };
  }""")
  assert data['sameParent'] and data['parentId']=='ks-quick',data
  assert data['visible'] in ('flex','inline-flex'),data  # Flex-item display is blockified by Chromium
  assert data['gearHeight']==data['discordHeight']==36,data
  for field in ('border','bg','radius','shadow'):
    assert data[field][0]==data[field][1],(field,data)
  assert data['interactive'] and data['version']=='KS · 1.0.7',data
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-gear').click()""")
  anim=page.evaluate("""() => {
    const s=document.querySelector('#ks-client-root').shadowRoot;
    return {panel:getComputedStyle(s.querySelector('#ks-panel')).animationName,
      content:getComputedStyle(s.querySelector('#ks-body .ks-title')).animationName,
      category:getComputedStyle(s.querySelector('.ks-tab')).transitionDuration,
      reduced:s.querySelector('#ks-screen').classList.contains('no-motion')};
  }""")
  assert 'ks123-panel-in' in anim['panel'] and 'ks123-content-in' in anim['content'],anim
  assert float(anim['category'].split(',')[0].strip().replace('s',''))>0 and not anim['reduced'],anim
  page.evaluate("""() => {
    const s=document.querySelector('#ks-client-root').shadowRoot;
    const cb=s.querySelector('[data-setting="uiAnimations"]');
    if(!cb)throw new Error('UI Animations setting missing');
    cb.checked=false;cb.dispatchEvent(new Event('change',{bubbles:true}));
  }""")
  reduced=page.evaluate("""() => {
    const s=document.querySelector('#ks-client-root').shadowRoot;
    return {flag:s.querySelector('#ks-screen').classList.contains('no-motion'),
      panel:getComputedStyle(s.querySelector('#ks-panel')).animationName,
      tab:getComputedStyle(s.querySelector('.ks-tab')).transitionDuration};
  }""")
  assert reduced['flag'] and reduced['panel']=='none' and reduced['tab']=='0s',reduced
  page.evaluate("""() => {
    const s=document.querySelector('#ks-client-root').shadowRoot;
    const cb=s.querySelector('[data-setting="uiAnimations"]');
    cb.checked=true;cb.dispatchEvent(new Event('change',{bubbles:true}));
    s.querySelector('#ks-discord-menu').click();
  }""")
  assert page.evaluate("window.__sent.some(m=>m.type==='discord-community')")
  page.evaluate("""() => {
    const s=document.querySelector('#ks-client-root').shadowRoot;
    s.querySelector('[data-group="Advanced"]').click();
    s.querySelector('[data-tab="Updates"]').click();
    window.__KS_CLIENT__.setUpdateStatus({state:'unavailable',message:'Public repository missing: KS-Client-Updates'});
  }""")
  assert 'Public repository missing' in page.evaluate("""() =>
    document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-update-status').textContent""")
  assert 'public KS-Client-Updates repository now contains verified ZIP and EXE releases' in page.evaluate("""() =>
    document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-body').textContent""")
  assert not errors,errors
  page.close()
  print('PASS: KS alpha 1.0.7 UI button visual parity, menu animations, reduced motion, Discord and updater',engine)
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  for engine in ('Electron','CEF'):check(browser,engine)
  browser.close()
