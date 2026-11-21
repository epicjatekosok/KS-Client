"""Production modules, Chromium sandbox and visible-only Kirka-shaped fixtures."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
base=Path(__file__).resolve().parents[1]/'electron-app/overlay'
html="""<div class="inventory"><div class="item"><span class="name">Gold rifle</span></div></div>
<div class="market"><div class="listing"><b class="name">Gold rifle</b><b class="price">25 coins</b></div></div>
<div class="friends"><div class="friend is-online"><b class="nickname">Delta</b><a href="/profile/Delta">Profile</a></div></div>
<label>FPS limit<select><option>60</option><option>180 FPS</option></select></label>"""
with sync_playwright() as pw:
    browser=pw.chromium.launch(args=['--enable-unsafe-swiftshader'])
    p=browser.new_page()
    p.route('https://kirka.io/**',lambda r:r.fulfill(body=html,content_type='text/html'))
    p.goto('https://kirka.io/')
    p.evaluate("""() => {localStorage.setItem('ksclient.settings.alpha',JSON.stringify({fpsLimit:180}));
      window.__KS_NATIVE__={post:()=>{}}}""")
    for n in ['frame_pacer','game_runtime','overlay','advanced_integration','workshop','webgl_cosmetics']:
        p.add_script_tag(content=(base/(n+'.js')).read_text())
    p.evaluate('window.__KS_CLIENT__.open()')
    p.locator('.ks-tab[data-group="Graphics"]').click()
    p.locator('[data-tab="Performance"]').click()
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
    png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8v5SBgYGBiYGBgYGBAQAU2QGo4jF1qQAAAABJRU5ErkJggg==')
    p.locator('#ks-wk-gl-file').set_input_files({'name':'local.png','mimeType':'image/png','buffer':png})
    p.locator('#ks-wk-gl-enabled').check()
    p.locator('[data-action="wk-gl-bind"]').click()
    p.wait_for_function("window.__KS_WEBGL_COSMETICS__.getStatus().readyMappings===1")
    assert p.evaluate("JSON.parse(localStorage.getItem('ksclient.webgl.v114')).slots[0].name")=='Local rifle'
    # Read the pixel of the actual GPU texture upload and check an unmatched source.
    p.route('**/assets/textures/*.png',lambda r:r.fulfill(body=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAC0lEQVR4nGNgQAYAAA4AAamRc7EAAAAASUVORK5CYII='),content_type='image/png'))
    pixels=p.evaluate("""async () => {
      const canvas=document.body.appendChild(document.createElement('canvas'));canvas.id='game';
      const gl=canvas.getContext('webgl');if(!gl)throw Error('WebGL unavailable');
      const pixel=async src=>{
        const img=new Image();img.src=src;await img.decode();
        const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
        const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
        const rgba=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
        gl.deleteFramebuffer(fb);gl.deleteTexture(tex);return [...rgba];
      };return [await pixel('/assets/textures/rifle.png'),await pixel('/assets/textures/other.png')];
    }""")
    assert pixels[0][0]>200 and pixels[0][1]>100 and pixels[0][2]<75,pixels
    assert pixels[1]==[0,0,0,255],pixels
    p.locator('[data-action="wk-gl-reset"]').click()
    assert not p.evaluate('window.__KS_WEBGL_COSMETICS__.getStatus().enabled')
    browser.close()
