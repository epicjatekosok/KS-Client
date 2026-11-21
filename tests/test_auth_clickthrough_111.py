"""Native Kirka login button tests. No account, secrets, or live provider used."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
for engine in ('Electron',):
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True)
  page=browser.new_page(viewport={'width':1280,'height':800})
  page.set_content("""<!doctype html><html><body>
  <section id="kirka-login-window" style="position:absolute;top:25%;left:45%;width:340px;padding:18px;background:#171717">
    <button id="google-provider" type="button">Google</button>
    <button id="discord-provider" type="button">Discord</button>
    <form id="email-signin">
      <label>Email <input id="email" type="email" autocomplete="username"></label>
      <label>Password <input id="password" type="password" autocomplete="current-password"></label>
      <button id="email-submit" type="submit">Sign in</button>
    </form>
  </section>
  <a href="https://discord.gg/cxP386yGjk" id="community-invite">KS community</a>
  </body></html>""")
  page.evaluate("""() => {
    window.__KS_TEST_LOCATION__={hostname:'kirka.io',protocol:'https:',pathname:'/',href:'https://kirka.io/'};
    window.__clicks={google:0,discord:0,submit:0};
    window.__KS_NATIVE__={post:message=>{window.__sent=message}};
    const storage=new Map();
    Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),
      removeItem:k=>storage.delete(k)
    }});
    document.querySelector('#google-provider').addEventListener('click',()=>window.__clicks.google++);
    document.querySelector('#discord-provider').addEventListener('click',()=>window.__clicks.discord++);
    document.querySelector('#email-signin').addEventListener('submit',e=>{
      e.preventDefault();window.__clicks.submit++;
    });
  }""")
  script=(root/('electron-app/overlay/overlay.js')).read_text(encoding='utf8')
  page.add_script_tag(content=script.replace("  'use strict';","  'use strict'; const location=window.__KS_TEST_LOCATION__;",1))
  page.wait_for_function('!!window.__KS_CLIENT__')
  # The KS shadow host must have zero hit-test area. Only its own visible
  # buttons (gear, KS Discord, open Settings) may opt back into pointer events.
  assert page.evaluate("""() => {
    const root=document.querySelector('#ks-client-root'),r=root.getBoundingClientRect();
    return r.width===0 && r.height===0 && getComputedStyle(root).pointerEvents==='none';
  }"""),'KS full-screen host must not overlay Kirka login'
  # Real Playwright pointer clicks trigger Chromium's trusted click path.
  page.locator('#google-provider').click(timeout=5000)
  page.locator('#discord-provider').click(timeout=5000)
  page.locator('#email').fill('not-a-real-user@example.invalid')
  page.locator('#password').fill('synthetic-fake-data-only')
  page.locator('#email-submit').click(timeout=5000)
  counts=page.evaluate('window.__clicks')
  assert counts=={'google':1,'discord':1,'submit':1},(engine,counts)
  assert not page.evaluate("window.__KS_CLIENT__.isSettingsOpen()"),'Provider click must not open KS Settings'
  assert not page.evaluate("""() => !!document.querySelector('#ks-client-root')
   .shadowRoot.querySelector('#ks-quick-account-dialog')"""),'No fake token import dialog'
  browser.close()
  print('PASS '+engine+': Kirka Google, Discord, and email/password native click and submit events reach game handlers')
