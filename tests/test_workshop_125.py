"""Production modules, Chromium sandbox and visible-only Kirka-shaped fixtures."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
base=Path(__file__).resolve().parents[1]/'electron-app/overlay'
html="""<div class="inventory"><div class="item"><span class="name">Gold rifle</span></div></div>
<div class="market"><div class="listing"><b class="name">Gold rifle</b><b class="price">25 coins</b></div></div>
<div class="friends"><div class="friend is-online"><b class="nickname">Delta</b><a href="/profile/Delta">Profile</a></div></div>
<label>FPS limit<select><option>60</option><option>180 FPS</option></select></label>"""
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    p=browser.new_page()
    p.route('https://kirka.io/**',lambda r:r.fulfill(body=html,content_type='text/html'))
    p.goto('https://kirka.io/')
    p.evaluate("""() => {localStorage.setItem('ksclient.settings.alpha',JSON.stringify({fpsLimit:180}));
      window.__KS_NATIVE__={post:()=>{}}}""")
    for n in ['frame_pacer','game_runtime','overlay','advanced_integration','workshop','webgl_cosmetics']:
        p.add_script_tag(content=(base/(n+'.js')).read_text())
    p.evaluate('window.__KS_CLIENT__.open()')
    p.locator('[data-action="native-game-cap"]').click()
    assert p.locator('body > label select').input_value()=='180 FPS'
    p.locator('.ks-tab[data-group="Workshop"]').click()
    p.locator('[data-tab="Inventory & Market"]').click()
    expect(p.locator('#ks-visible-inventory')).to_contain_text('Gold rifle')
    expect(p.locator('#ks-live-market')).to_contain_text('25 coins')
    p.locator('.listing .price').evaluate("n=>n.textContent='15 coins'")
    expect(p.locator('#ks-price-history svg')).to_have_count(1)
    p.locator('#ks-wk-query').fill('missing')
    p.locator('[data-action="wk-filter"]').click()
    expect(p.locator('#ks-live-market')).not_to_contain_text('Gold rifle')
    assert p.evaluate('window.__KS_DEEP__.friendsSnapshot().entries[0].state')=='online'
    assert p.evaluate('window.__KS_DEEP__.friendsSnapshot().entries[0].profile')=='/profile/Delta'
    p.locator('[data-tab="Plugins"]').click()
    p.locator('#ks-wk-plugin-name').fill('Test')
    p.locator('#ks-wk-plugin-code').fill('ks.snapshot().then(s=>ks.panel("Árvíz "+s.settingsOpen));ks.on("settings",open=>ks.panel("Panel "+open));')
    p.locator('#ks-wk-plugin-v2').check()
    p.locator('[data-action="wk-plugin-save"]').click()
    p.locator('[data-action="wk-plugin-run-0"]').click()
    expect(p.locator('body > output')).to_contain_text('Árvíz true')
    p.evaluate('window.__KS_CLIENT__.close()')
    expect(p.locator('body > output')).to_have_text('Panel false')
    p.evaluate('window.__KS_CLIENT__.open()')
    p.locator('[data-action="wk-plugin-toggle-0"]').click()
    expect(p.locator('body > output')).to_have_count(0)
    p.locator('[data-tab="Weapon Studio"]').click()
    p.locator('#ks-wk-gl-source').fill('https://kirka.io/assets/textures/rifle.png')
    p.locator('#ks-wk-gl-name').fill('Local rifle')
    import base64
    png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
    p.locator('#ks-wk-gl-file').set_input_files({'name':'local.png','mimeType':'image/png','buffer':png})
    p.locator('#ks-wk-gl-enabled').check()
    p.locator('[data-action="wk-gl-bind"]').click()
    p.wait_for_function("window.__KS_WEBGL_COSMETICS__.getStatus().readyMappings===1")
    assert p.evaluate("JSON.parse(localStorage.getItem('ksclient.webgl.v114')).slots[0].name")=='Local rifle'
    p.locator('[data-action="wk-gl-reset"]').click()
    assert not p.evaluate('window.__KS_WEBGL_COSMETICS__.getStatus().enabled')
    browser.close()
