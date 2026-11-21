"""Engine-independent KS Client 1.0.21 UI smoke test in local Chromium.
Not a live test of Windows Electron, CEF, or FPS unlock.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
js=(root/'electron-app/overlay/overlay.js').read_text()
js=js.replace("if (!allowedHosts.has(location.hostname) || location.protocol !== 'https:') return;",'/* Testing offline origin: allow. */')
pacer=(root/'electron-app/overlay/frame_pacer.js').read_text().replace("if (location.protocol !== 'https:' || !['kirka.io', 'www.kirka.io'].includes(location.hostname)) return;",'/* Testing offline origin: allow. */')
with sync_playwright() as play:
 browser=play.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for width,height in [(1280,720),(1600,900),(2560,1440)]:
  page=browser.new_page(viewport={'width':width,'height':height})
  errors=[]
  page.on('dialog',lambda dialog: dialog.accept())
  page.on('pageerror',lambda err: errors.append(str(err)))
  page.set_content('<html><body><canvas width="800" height="600"></canvas></body></html>')
  page.evaluate('''() => {window.__out=[];window.__KS_NATIVE__={post: m=>window.__out.push(m)};const store={'ksclient.settings.alpha':JSON.stringify({language:'hu',showFPS:true,uiScale:100,eyeEnabled:true,eyeContrast:90,shape:'circle',crosshairEnabled:true})};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v},removeItem(k){delete store[k]}}});}''')
  page.add_script_tag(content=pacer)
  page.add_script_tag(content=js)
  extras=(root/'electron-app/overlay/game_extras.js').read_text()
  extras=extras.replace("if(location.protocol!=='https:' || !['kirka.io','www.kirka.io'].includes(location.hostname))return;",'/* Offline integration test */')
  extras=extras.replace("const match=()=>/^\\/(games\\/|hub\\/ranked)/.test(location.pathname);","const match=()=>true;")
  page.add_script_tag(content=extras)
  assert page.evaluate("!!window.__KS_GAME_EXTRAS__")
  workshop=(root/'electron-app/overlay/workshop.js').read_text()
  workshop=workshop.replace("if(location.protocol!=='https:' || !['kirka.io','www.kirka.io'].includes(location.hostname))return;",'/* Offline workshop test */')
  page.add_script_tag(content=workshop)
  assert page.evaluate("!!window.__KS_WORKSHOP__")


  assert not errors,errors
  page.wait_for_function('!!window.__KS_CLIENT__')
  assert page.evaluate("window.__out.some(m=>m.type==='engine-info')")
  page.evaluate('window.__KS_CLIENT__.setEngineInfo("Electron")')
  # A late native status update must be displayed without leaving Loading.
  page.evaluate("window.__KS_CLIENT__.setEngineSwitchStatus('Checking new engine startup')")

  page.evaluate('window.__KS_CLIENT__.open()')
  page.locator('.ks-tab[data-group="Advanced"]').click()
  page.locator('.ks-subtab[data-tab="General"]').click()
  body=page.locator('#ks-body').inner_text()
  assert 'Electron' in body,(width,body[:200])
  assert 'Checking new engine startup' in body
  # Removing the page cap must preserve the independent Chromium startup preference.
  page.evaluate("""() => window.__KS_CLIENT__.setBrowserConfig(
    {gpu:'enabled',angle:'default',devTools:false,contextMenu:false,uncapFps:false},
    {gpu:'enabled',angle:'default',devTools:false,contextMenu:false,uncapFps:false},false,'')""")
  page.locator('.ks-tab[data-group="Graphics"]').click()
  page.locator('.ks-subtab[data-tab="Performance"]').click()
  page.evaluate("""() => {
    const select=document.querySelector('#ks-client-root').shadowRoot.querySelector('[data-setting="fpsLimit"]');
    select.value='0'; select.dispatchEvent(new Event('change',{bubbles:true}));
  }""")
  assert not page.evaluate("window.__out.some(m=>m.type==='browser-save' && m.browser.uncapFps===true)")
  # The dedicated button also works when Unlimited is already selected.
  page.evaluate("""() => window.__KS_CLIENT__.setBrowserConfig(
    {gpu:'enabled',angle:'default',devTools:false,contextMenu:false,uncapFps:false},
    {gpu:'enabled',angle:'default',devTools:false,contextMenu:false,uncapFps:false},false,'')""")
  page.locator('[data-action="enable-unlimited-fps"]').click()
  assert page.evaluate("window.__out.some(m=>m.type==='browser-save' && m.browser.uncapFps===true)")
  assert page.locator('[data-action="browser-restart"]').count()==1
  page.evaluate("""() => window.__KS_CLIENT__.setNativeFpsDiagnostics({
    engine:'Electron',requested:true,activeAtStartup:true,frameRateLimitSwitch:true,
    gpuVsyncSwitch:true,gpuAccelerationRequested:true})""")
  assert 'REQUESTED' in page.locator('#ks-fps-native-diag').inner_text()
  assert page.locator('#ks-fps-callback-diag').count()==1


  page.locator('.ks-tab[data-group="Advanced"]').click()
  page.locator('.ks-subtab[data-tab="General"]').click()

  assert page.get_by_role('button', name='KS saját motorja cooming soon').is_disabled()
  assert not page.evaluate("window.__out.some(m=>m.type==='engine-switch')")
  # A missing native status must not keep the original Requesting banner forever.
  page.evaluate("window.__KS_CLIENT__.setEngineSwitchStatus('Native host reached')")
  assert 'Native host reached' in page.locator('#ks-body').inner_text()

  page.locator('.ks-tab[data-group="Gameplay"]').click()
  page.locator('.ks-subtab[data-tab="Game Integration"]').click()
  assert page.locator('#ks-pointer-status').is_visible()
  assert page.locator('[data-setting="gameKeystrokes"]').count()==1
  page.locator('[data-setting="gameKeystrokes"]').check()
  assert page.evaluate("window.__KS_GAME_EXTRAS__.getStatus().keystrokes")
  assert page.locator('[data-setting="gameStats"]').count()==1
  assert page.locator('[data-setting="gameHitmarker"]').count()==0
  assert page.locator('[data-setting="gameHitmarkerColor"]').count()==0
  assert page.locator('[data-setting="gameHitmarkerSize"]').count()==0
  assert page.locator('[data-setting="gameHitmarkerImage"]').count()==0
  assert page.locator('[data-setting="gameKillfeedColors"]').count()==0
  page.locator('[data-action="game-screenshot"]').click()
  assert page.evaluate("window.__out.some(m=>m.type==='game-screenshot')")
  page.locator('.ks-tab[data-group="Graphics"]').click()
  assert page.locator('.ks-subtab[data-tab="Performance"]').count()==1
  assert page.locator('.ks-subtab[data-tab="Frame Stability"]').count()==1
  page.locator('.ks-tab[data-group="Display"]').click()
  page.locator('.ks-subtab[data-tab="Eye Comfort"]').click()
  page.locator('[data-setting="comfortStillMenus"]').check()
  page.locator('[data-setting="comfortReading"]').check()
  assert page.locator('#ks-screen.no-motion.comfort-reading').count()==1
  page.locator('[data-setting="comfortStillMenus"]').uncheck()
  page.locator('[data-setting="comfortReading"]').uncheck()
  page.locator('.ks-tab[data-group="Workshop"]').click()
  assert page.locator('.ks-subtab[data-tab="Weapon Studio"]').count()==1
  assert page.locator('.ks-subtab[data-tab="Resource Swapper"]').count()==1
  page.locator('.ks-subtab[data-tab="Weapon Studio"]').click()
  page.locator('#ks-wk-weapon-hue').fill('65')
  page.locator('[data-action="wk-weapon-apply"]').click()
  assert page.evaluate("window.__KS_WORKSHOP__.getConfig().weapon.hue===65")
  page.locator('.ks-subtab[data-tab="Resource Swapper"]').click()
  page.locator('#ks-wk-swap-on').check()
  page.locator('[data-action="wk-swap-toggle"]').click()
  assert page.evaluate("window.__out.some(m=>m.type==='resource-save' && m.enabled===true)")
  page.locator('.ks-subtab[data-tab="Inventory & Market"]').click()
  page.locator('#ks-wk-item-name').fill('Test skin')
  page.locator('[data-action="wk-item-save"]').click()
  assert page.evaluate("window.__KS_WORKSHOP__.getConfig().inventory.some(x=>x.item==='Test skin')")
  page.locator('.ks-subtab[data-tab="Plugins"]').click()
  page.locator('#ks-wk-plugin-name').fill('Test plugin')
  page.locator('#ks-wk-plugin-code').fill('ks.message("Ready")')
  page.locator('[data-action="wk-plugin-save"]').click()
  assert page.evaluate("window.__KS_WORKSHOP__.getConfig().plugins.length===1")
  page.locator('[data-action="wk-plugin-run-0"]').click()
  assert page.locator('iframe[title="Isolated local plugin preview"]').count()==1
  page.locator('.ks-tab[data-group="Display"]').click()

  page.locator('.ks-subtab[data-tab="Eye Comfort"]').click()
  assert page.locator('[data-setting="eyeEnabled"]').is_checked()
  page.locator('.ks-subtab[data-tab="Crosshair"]').click()
  assert page.locator('[data-setting="crosshairEnabled"]').count()==1
  page.locator('.ks-tab[data-group="Advanced"]').click()
  page.locator('.ks-subtab[data-tab="General"]').click()
  assert page.locator('.ks-release').first.inner_text().startswith('KS Client Beta 1.0.21')
  assert not errors,(width,errors)
  print('PASS 1.0.21 engine UI',width,height)
  page.close()
 browser.close()
