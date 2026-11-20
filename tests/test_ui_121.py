"""KS alpha 1.0.19: partial diagnostics must never break the gear or settings."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]

def run(browser,engine):
    page=browser.new_page(viewport={'width':1280,'height':760})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('<!doctype html><html><head></head><body><main>Mock Kirka lobby</main></body></html>')
    page.evaluate("""() => {
      window.__KS_TEST_LOCATION__={hostname:'kirka.io',protocol:'https:',pathname:'/',href:'https://kirka.io/'};
      window.__out=[];
      window.__KS_NATIVE__={post:msg=>window.__out.push(msg)};
      const store=new Map([['ksclient.settings.alpha',JSON.stringify({
        gameHitmarker:true,gameHitmarkerColor:'#ff0000',gameHitmarkerSize:30,
        gameHitmarkerImage:'https://example.org/icon.png',gameKillfeedColors:true,
        gameKeystrokes:true,gameStats:true
      })]]);
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),
        removeItem:k=>store.delete(k)
      }});
    }""")
    src=(root/('cef/overlay/overlay.js' if engine=='CEF' else 'electron-app/overlay/overlay.js')).read_text(encoding='utf8')
    page.add_script_tag(content=src.replace("  'use strict';","  'use strict'; const location=window.__KS_TEST_LOCATION__;",1))
    page.evaluate("window.__KS_CLIENT__.setDiagnostics({browserRAM:103,engine:'CEF',sampling:'Partial native sample'})")
    # A previously throwing .toFixed(undefined) must not prevent either engine's
    # fixed gear from reopening settings after long sessions.
    for _ in range(8):
        page.evaluate("window.__KS_CLIENT__.open()")
        assert page.evaluate("""() => {
          const s=document.querySelector('#ks-client-root').shadowRoot;
          return window.__KS_CLIENT__.isSettingsOpen() && s.querySelector('#ks-dimmer').classList.contains('visible');
        }""")
        page.evaluate("window.__KS_CLIENT__.close()")
        assert not page.evaluate("window.__KS_CLIENT__.isSettingsOpen()")
    page.evaluate("""() => {
      const s=document.querySelector('#ks-client-root').shadowRoot;
      s.querySelector('#ks-gear').click();
      s.querySelector('[data-group="Advanced"]').click();
      s.querySelector('[data-tab="Diagnostics"]').click();
    }""")
    numbers=page.evaluate("""() => {
      const s=document.querySelector('#ks-client-root').shadowRoot;
      return ['ks-browser-cpu','ks-client-cpu','ks-browser-ram','ks-client-ram','ks-browser-processes'].map(id=>s.getElementById(id).textContent);
    }""")
    assert numbers==['—','—','103 MB','—','—'],numbers
    page.evaluate("""() => window.__KS_CLIENT__.setDiagnostics({
      engine:'Electron',browserCPU:14.8,clientCPU:2.7,
      browserRAM:420.2,clientRAM:110.5,browserProcesses:7,sampling:'Native sample'
    })""")
    numbers=page.evaluate("""() => {
      const s=document.querySelector('#ks-client-root').shadowRoot;
      return ['ks-browser-cpu','ks-client-cpu','ks-browser-ram','ks-client-ram','ks-browser-processes'].map(id=>s.getElementById(id).textContent);
    }""")
    assert numbers==['14.8%','2.7%','420 MB','111 MB','7'],numbers
    page.evaluate("window.__KS_CLIENT__.close()")
    # SPA body replacement during weapon selection must preserve the gear.
    page.evaluate("document.body.innerHTML='<main><canvas width=640 height=360></canvas></main>'")
    page.wait_for_timeout(220)
    assert page.evaluate("document.querySelector('#ks-client-root')?.parentElement===document.body")
    page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-gear').click()""")
    assert page.evaluate("window.__KS_CLIENT__.isSettingsOpen()")
    page.evaluate("""() => {
      const s=document.querySelector('#ks-client-root').shadowRoot;
      s.querySelector('[data-group="Gameplay"]').click();
      s.querySelector('[data-tab="Game Integration"]').click();
    }""")
    controls=page.evaluate("""() => {
      const s=document.querySelector('#ks-client-root').shadowRoot;
      return {
        hits:s.querySelectorAll('[data-setting*="Hitmarker"],[data-setting="gameKillfeedColors"]').length,
        keystrokes:!!s.querySelector('[data-setting="gameKeystrokes"]'),
        stats:!!s.querySelector('[data-setting="gameStats"]'),
        saved:JSON.parse(localStorage.getItem('ksclient.settings.alpha'))
      };
    }""")
    assert controls['hits']==0 and controls['keystrokes'] and controls['stats'],controls
    assert controls['saved']['gameKeystrokes'] is True,controls
    assert 'gameHitmarker' not in controls['saved'] and 'gameKillfeedColors' not in controls['saved'],controls
    page.evaluate("""() => {
      const s=document.querySelector('#ks-client-root').shadowRoot;
      s.querySelector('[data-group="Advanced"]').click();
      s.querySelector('[data-tab="Updates"]').click();
      s.querySelector('[data-action="update-check"]').click();
      window.__KS_CLIENT__.setUpdateStatus({state:'unavailable',message:'Public feed not published',current:'1.0.19'});
      s.querySelector('[data-action="update-open-release"]').click();
    }""")
    assert page.evaluate("""() => window.__out.some(msg=>msg.type==='update-open-release')""")
    assert page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-update-status').textContent.includes('Public feed not published')""")
    assert not errors,errors
    page.close()
    print('PASS: alpha 1.0.19 stable gear, diagnostics, profile migration, update UI',engine)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for engine in ('Electron','CEF'):run(browser,engine)
    browser.close()
