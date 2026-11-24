"""KS Beta 1.0.30 browser smoke: matching HUD/close, Experimental Workshop and update buttons."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for engine in ('Electron',):
  page=browser.new_page(viewport={'width':1380,'height':820})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content('<html><head></head><body><main>Kirka demo</main></body></html>')
  page.evaluate("""() => {
   window.__KS_TEST_LOCATION__={hostname:'kirka.io',protocol:'https:',pathname:'/',href:'https://kirka.io/'};
   window.__out=[];window.__KS_NATIVE__={post:m=>window.__out.push(m)};
   const db=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v),removeItem:k=>db.delete(k)
   }});
  }""")
  js=(root/('electron-app/overlay/overlay.js')).read_text()
  page.add_script_tag(content=js.replace("  'use strict';","  'use strict'; const location=window.__KS_TEST_LOCATION__;",1))
  page.wait_for_function('!!window.__KS_CLIENT__')
  page.evaluate('window.__KS_CLIENT__.open()')
  # Google main-frame navigation must show local account recovery without switching Settings tabs.
  selected_before=page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-group].active')?.getAttribute('data-group')""")
  page.evaluate('window.__KS_CLIENT__.openAccountHelp()')
  account_text=page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-quick-account-dialog').textContent""")
  assert 'Google' in account_text and 'Kirka session' in account_text,account_text[:240]
  assert page.evaluate("""() => !!document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-quick-account-dialog input[type=password][maxlength="8192"]')""")
  assert page.evaluate("""() => !!document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-quick-account-dialog [data-account-consent]')""")
  selected_after=page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-group].active')?.getAttribute('data-group')""")
  assert selected_before==selected_after, 'Google click must not navigate Settings'
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-quick-account-dialog [data-account-dismiss]').click()""")
  assert not page.evaluate("""() => !!document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-quick-account-dialog')""")
  assert not page.evaluate("""() => !!document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-action="auth-open-browser"]')""")
  info=page.evaluate("""() => {
   const s=document.querySelector('#ks-client-root').shadowRoot;
   const fps=getComputedStyle(s.querySelector('#ks-fps')),close=getComputedStyle(s.querySelector('#ks-close'));
   return {fpsBorder:fps.borderRadius,fpsFont:fps.fontFamily,fpsBackground:fps.backgroundColor,
    closeBorder:close.borderRadius,closeBackground:close.backgroundColor,
    defaultFps:s.querySelector('#ks-fps').style.display,version:s.querySelector('#ks-badge').textContent,
    workshopBadge:!!s.querySelector('[data-group="Workshop"] .ks-experimental-badge')};
  }""")
  assert info['defaultFps']=='none',info
  assert info['fpsBorder']=='10px' and info['closeBorder']=='10px',info
  assert info['fpsBackground']==info['closeBackground'],info
  assert info['version']=='KS · 1.0.30' and info['workshopBadge'],info
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-group="Workshop"]').click()""")
  assert page.evaluate("""() => {
   const s=document.querySelector('#ks-client-root').shadowRoot;
   return s.querySelector('.ks-workshop-experimental').textContent.includes('EXPERIMENTAL');
  }""")
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-group="Advanced"]').click()""")
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-tab="Updates"]').click()""")
  assert 'Beta (recommended)' in page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-body').textContent""")
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-action="update-check"]').click()""")
  assert page.evaluate("window.__out.some(m=>m.type==='update-check'&&m.channel==='beta')")
  page.evaluate("""() => window.__KS_CLIENT__.setUpdateStatus({
   state:'available',channel:'beta',current:'1.0.30',version:'1.0.30-beta',
   message:'New verified beta available',bytes:424000000
  })""")
  assert page.evaluate("""() => !!document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-action="update-install"]')""")
  page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-action="update-open-release"]').click()""")
  assert page.evaluate("window.__out.some(m=>m.type==='update-open-release')")
  assert not errors,errors
  page.close()
  print('PASS KS Beta 1.0.30 HUD, Experimental Workshop, check/install/manual update',engine)
 browser.close()
