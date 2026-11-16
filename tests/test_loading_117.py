"""Test the real local loading HTML and a trusted CEF-like canvas click.
The second check mocks a bridge; it does NOT prove native CefSharp pointer lock.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
file=root/'electron-app/assets/loading.html'
assert file.is_file()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page()
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(file.resolve().as_uri())
 assert page.locator('.logo').count()==1
 assert page.locator('.logo').evaluate('(img)=> img.complete && img.naturalWidth>0')
 assert 'KS CLIENT' in page.locator('.title').inner_text()
 assert page.locator('.track .moving').count()==1
 assert '1.1.18' in page.locator('.version').inner_text()
 assert page.evaluate("getComputedStyle(document.querySelector('.moving')).animationName")=='load'
 assert not errors,errors

 page.route('https://kirka.io/games/ks-test', lambda route:route.fulfill(status=200,content_type='text/html',body=
  '<!doctype html><html><body><canvas id="game" style="width:640px;height:480px" width="640" height="480"></canvas></body></html>'))
 page.goto('https://kirka.io/games/ks-test')
 page.evaluate("""() => {
   window.__ksMessages=[];
   window.CefSharp={PostMessage:(raw)=>window.__ksMessages.push(JSON.parse(raw))};
   window.__ksRequested=0;
   HTMLCanvasElement.prototype.requestPointerLock=function(){window.__ksRequested++;return Promise.resolve()};
 }""")
 extras=(root/'electron-app/overlay/game_extras.js').read_text(encoding='utf8')
 page.add_script_tag(content=extras)
 page.locator('canvas#game').click(position={'x':150,'y':150})
 assert page.evaluate('window.__ksRequested')>=1, 'Real canvas click must attempt lock in CEF mode'
 assert page.evaluate("window.__ksMessages.some(m=>m.type==='game-input-diagnostics' && m.message==='gesture')")
 assert not errors,errors
 browser.close()
print('PASS: KS logo animated splash and trusted Kirka canvas Pointer Lock request')
