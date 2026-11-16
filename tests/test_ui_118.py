"""Mock browser regression: settings persist after SPA body replacement; optional HUD hides empty data."""
from pathlib import Path
from playwright.sync_api import sync_playwright
r=Path(__file__).resolve().parents[1]
def run(browser,engine):
  page=browser.new_page(viewport={'width':1280,'height':720})
  errors=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  page.set_content('<!doctype html><html><head><title>Mock Kirka</title></head><body><div>Lobby</div></body></html>')
  page.evaluate("""() => {
    window.__KS_TEST_LOCATION__={hostname:'kirka.io',protocol:'https:',pathname:'/'};
    const db=new Map([['ksclient.settings.alpha',JSON.stringify({gameStats:true})]]);
    Object.defineProperty(window,'localStorage',{value:{getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v),removeItem:k=>db.delete(k)},configurable:true});
    const original=Element.prototype.attachShadow;
    Element.prototype.attachShadow=function(opts){return original.call(this,this.id==='ks-game-extras'?{...opts,mode:'open'}:opts);};
  }""")
  if engine=='CEF':page.evaluate('window.CefSharp={PostMessage:()=>{}}')
  folder=r/('cef/overlay' if engine=='CEF' else 'electron-app/overlay')
  for file in ('overlay.js','game_extras.js'):
    source=(folder/file).read_text(encoding='utf8').replace("  'use strict';","  'use strict'; const location=window.__KS_TEST_LOCATION__;",1)
    page.add_script_tag(content=source)
  page.wait_for_timeout(200)
  initial=page.evaluate("""() => {
    const s=document.querySelector('#ks-client-root').shadowRoot;
    return [s.querySelector('#ks-gear').textContent.trim(),s.querySelector('#ks-fps').style.display,s.querySelector('#ks-quick').style.display,s.querySelector('#ks-brand-main').textContent];
  }""")
  assert initial==['⚙','none','flex','Settings'],initial
  page.evaluate("window.__KS_TEST_LOCATION__.pathname='/games/test';document.body.innerHTML='<main id=game><canvas width=800 height=600></canvas></main>'")
  page.wait_for_timeout(350)
  assert page.evaluate("document.querySelector('#ks-client-root')?.parentElement===document.body")
  assert page.evaluate("document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-quick').style.display==='flex'")
  page.evaluate('window.__KS_CLIENT__.open()')
  assert page.evaluate('window.__KS_CLIENT__.isSettingsOpen()')
  page.evaluate('window.__KS_CLIENT__.close()')
  page.wait_for_timeout(1650)
  empty=page.evaluate("""() => {const el=document.querySelector('#ks-game-extras')?.shadowRoot?.querySelector('#stats');return [el?.textContent,el?.style.display];}""")
  assert empty==['','none'],empty
  page.evaluate("""document.body.insertAdjacentHTML('beforeend','<div class="ui-cell kill"><span class="cell-value">4</span></div>')""")
  page.wait_for_timeout(1650)
  shown=page.evaluate("""() => {const el=document.querySelector('#ks-game-extras')?.shadowRoot?.querySelector('#stats');return [el?.textContent,el?.style.display];}""")
  assert 'Kills: 4' in shown[0] and shown[1]=='block',shown
  assert not errors,errors
  page.close()
  print('PASS: KS 1.1.22 mock Kirka UI',engine)
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  for engine in ('Electron','CEF'):run(browser,engine)
  browser.close()
