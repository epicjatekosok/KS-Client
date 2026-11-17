"""Mocked Chromium UI: all existing groups remain; search and Discord routing work."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
def test_engine(browser,engine):
  page=browser.new_page(viewport={'width':1280,'height':800})
  page.set_content('<!doctype html><html><head></head><body><main>Mock Kirka lobby</main><aside style="position:fixed;right:40px;bottom:40px;z-index:1"><a id="discord-original" href="https://discord.gg/other">Discord</a><button id="join-community" aria-label="Join our Discord">Join</button><button id="other-action">Other game button</button></aside></body></html>')
  page.evaluate("""() => {
    window.__KS_TEST_LOCATION__={hostname:'kirka.io',protocol:'https:',pathname:'/',href:'https://kirka.io/'};
    window.__out=[];
    window.__KS_NATIVE__={post:m=>window.__out.push(m)};
    const store=new Map();
    Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
  }""")
  source=(root/('cef/overlay/overlay.js' if engine=='CEF' else 'electron-app/overlay/overlay.js')).read_text(encoding='utf8').replace("  'use strict';","  'use strict'; const location=window.__KS_TEST_LOCATION__;",1)
  page.add_script_tag(content=source)
  page.wait_for_timeout(150)
  page.evaluate('window.__KS_CLIENT__.open()')
  assert page.locator('#ks-client-root').count()==1
  assert page.evaluate("""() => {
    const s=document.querySelector('#ks-client-root').shadowRoot;
    return s.querySelectorAll('#ks-sidebar-groups .ks-tab').length;
  }""")==7
  assert page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-badge').textContent""")=='KS · 1.0.3'
  badge=page.evaluate("""() => {
    const b=document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-badge');
    const s=getComputedStyle(b);
    return {bottom:s.bottom,left:s.left,opacity:s.opacity,pointerEvents:s.pointerEvents};
  }""")
  assert badge=={'bottom':'5px','left':'7px','opacity':'0.36','pointerEvents':'none'},badge
  page.evaluate("""() => {
    const s=document.querySelector('#ks-client-root').shadowRoot;
    const i=s.querySelector('#ks-menu-search');i.value='keystrokes';i.dispatchEvent(new Event('input',{bubbles:true}));
  }""")
  assert page.evaluate("""() => {
    const s=document.querySelector('#ks-client-root').shadowRoot;
    return s.querySelector('#ks-search-results [data-tab="Game Integration"]')!==null && s.querySelector('#ks-sidebar-groups').hidden;
  }""")
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-search-results [data-tab="Game Integration"]').click()""")
  assert page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-tab="Game Integration"]').classList.contains('active')""")
  page.evaluate('window.__KS_CLIENT__.close()')
  assert page.evaluate('window.__KS_CLIENT__.isSettingsOpen()') is False
  assert page.evaluate("getComputedStyle(document.querySelector('#ks-client-root')).pointerEvents")=='none'
  page.locator('#discord-original').click()
  page.locator('#join-community').click()
  page.locator('#other-action').click()
  out=page.evaluate('window.__out.filter(m=>m.type==="discord-community")')
  assert len(out)==2,out
  assert page.evaluate("document.location.href")== 'about:blank'
  page.close()
  print('PASS alpha 1.0.3 Chromium UI + Discord',engine)
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  for engine in ('Electron','CEF'):test_engine(browser,engine)
  browser.close()
