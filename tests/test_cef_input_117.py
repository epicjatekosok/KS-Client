"""KS 1.1.17 CEF mouse regression: game-owned requests before fallback.
Offline Chromium cannot validate WinForms native lock/camera movement.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
cef=(root/'cef/ClientForm.cs').read_text(encoding='utf8')
program=(root/'cef/Program.cs').read_text(encoding='utf8')
display=(root/'cef/KSGameCursorHandler.cs').read_text(encoding='utf8')
extras=(root/'cef/overlay/game_extras.js').read_text(encoding='utf8')
electron=(root/'electron-app/overlay/game_extras.js').read_text(encoding='utf8')
overlay=(root/'cef/overlay/overlay.js').read_text(encoding='utf8')
probe=(root/'cef/overlay/cef_input_probe.js').read_text(encoding='utf8')
assert extras==electron, "Do not regress the working Electron game input"
assert overlay==(root/'electron-app/overlay/overlay.js').read_text(encoding='utf8')
assert 'ActivateBrowserOnCreation=true' in cef, "CEF must create an activatable child HWND"
assert 'CefRuntimeStyle.Chrome' in program and '--ks-cef-alloy' in program
assert 'Cursor.Hide()' not in cef and 'Cursor.Show()' not in cef
assert 'NativeCursor.SetCursor' not in cef and 'NativeCursor.SetFocus' not in cef
assert 'new KSGameCursorHandler' not in cef, "Don't swallow native cursor changes"
assert 'return true' not in display, "Native default cursor lifecycle must not be intercepted"
assert 'PermissionRequestType.PointerLock' in cef
assert "const cefInputCompatibility=typeof window.CefSharp?.PostMessage==='function'" in overlay
assert "canvas:not(#game)" in overlay
assert "isSettingsOpen: () => Boolean(open)" in overlay
assert "window.addEventListener('click'" in extras
assert "pointerdown',event" in extras
assert "window.__KS_CEF_INPUT__?.getStatus?.()" in extras
assert "requestPointerLock()" in extras

with sync_playwright() as playwright:
  browser=playwright.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page()
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('https://kirka.io/games/ks-input-probe', lambda route:route.fulfill(
    status=200,content_type='text/html',body='<!doctype html><body><canvas id="game" width="640" height="400" style="width:640px;height:400px"></canvas></body>'))
  def init(cef_bridge=True):
    page.goto('https://kirka.io/games/ks-input-probe')
    page.evaluate("""(withCEF) => {
      window.__requests=0;
      window.__messages=[];
      if(withCEF)window.CefSharp={PostMessage:(raw)=>window.__messages.push(JSON.parse(raw))};
      Element.prototype.requestPointerLock=function(){window.__requests++;return Promise.resolve()};
    }""",cef_bridge)
    if cef_bridge:page.add_script_tag(content=probe)
  # The Kirka game requested pointer lock itself during pointerdown.
  # KS must not make a second request on the same trusted click.
  init()
  page.evaluate("""() => document.querySelector('#game').addEventListener('pointerdown',
    function(e){if(e.isTrusted)this.requestPointerLock()})""")
  page.add_script_tag(content=extras)
  page.locator('canvas#game').click(position={'x':170,'y':120})
  assert page.evaluate('window.__requests')==1, 'Duplicate request after native game input'
  assert page.evaluate("window.__KS_CEF_INPUT__.getStatus().attempts")==1
  assert page.evaluate("window.__KS_GAME_EXTRAS__.getStatus().lockRequests")==0
  # No game listener. KS only falls back on the final CLICK, never pointerdown.
  init()
  page.add_script_tag(content=extras)
  canvas=page.locator('canvas#game')
  point=canvas.bounding_box()
  x=point['x']+100;y=point['y']+100
  page.mouse.move(x,y)
  page.mouse.down()
  assert page.evaluate('window.__requests')==0, 'Pointerdown capture must not steal user gesture'
  page.mouse.up()
  assert page.evaluate('window.__requests')==1
  assert page.evaluate("window.__KS_GAME_EXTRAS__.getStatus().lockRequests")==1
  assert page.evaluate("window.__messages.some(m=>m.type==='game-input-diagnostics' && m.message==='fallback')")
  assert page.evaluate("window.__KS_CEF_INPUT__.getStatus().attempts")==1
  # Electron does not use the extra CEF-specific capture fallback at all.
  init(cef_bridge=False)
  page.add_script_tag(content=extras)
  page.locator('canvas#game').click(position={'x':160,'y':110})
  assert page.evaluate('window.__requests')==0, 'Working Electron path must remain game-owned'
  # Simulate the original eye-comfort settings and ensure #game filters are
  # excluded ONLY for CEF, while the filter preview/settings still work.
  init()
  page.evaluate("""() => {
    localStorage.setItem('ksclient.settings.alpha',
      JSON.stringify({eyeEnabled:true,eyePreset:'Warm',eyeWarmth:35}));
  }""")
  page.add_script_tag(content=overlay)
  assert page.evaluate("window.__KS_CLIENT__?.isSettingsOpen?.()===false")
  filter_css=page.locator('#ks-client-eye-filter').text_content()
  assert 'canvas:not(#game)' in filter_css,filter_css
  assert page.locator('canvas#game').evaluate("(el)=>getComputedStyle(el).filter")=='none'
  page.evaluate('window.__KS_CLIENT__.open()')
  assert page.evaluate('window.__KS_CLIENT__.isSettingsOpen()===true')
  page.evaluate('window.__KS_CLIENT__.close()')
  assert not errors, errors
  browser.close()
print('PASS KS 1.1.17: CEF game-first pointer lock, click-only fallback, no Electron regression, eye filter isolated')
