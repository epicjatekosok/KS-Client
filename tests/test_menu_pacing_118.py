"""Real Chromium WebGL work and menu transitions on an offline fixture."""
from pathlib import Path
from playwright.sync_api import sync_playwright

scripts = Path(__file__).resolve().parents[1] / 'electron-app' / 'overlay'
with sync_playwright() as pw:
    browser = pw.chromium.launch(args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    page = browser.new_page()
    page.route('https://kirka.io/**', lambda route: route.fulfill(
        content_type='text/html', body='<div class="interface">Lobby</div><div class="crosshair-cont"><i class="crosshair-dot">+</i></div><canvas id="game" width="32" height="32"></canvas>'))
    page.goto('https://kirka.io/')
    page.evaluate("""() => {
      localStorage.setItem('ksclient.settings.alpha',JSON.stringify({fpsLimit:180,showFPS:true,crosshairEnabled:true}));
      window.__KS_NATIVE__={post:()=>{}};
    }""")
    for filename in ['frame_pacer.js', 'game_runtime.js', 'overlay.js']:
        page.add_script_tag(content=(scripts / filename).read_text())
    page.evaluate("""() => {
      const gl=document.querySelector('canvas#game').getContext('webgl');
      if(!gl)throw Error('Fixture needs WebGL');
      window.draws=0;
      function gameFrame(){
        gl.clearColor((draws%2),0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);draws++;
        window.gameRequest=requestAnimationFrame(gameFrame);
      }
      window.gameRequest=requestAnimationFrame(gameFrame);
    }""")
    def sample():
        return page.evaluate("""async () => {
          const start=performance.now(), before=draws;
          await new Promise(resolve=>setTimeout(resolve,1500));
          return (draws-before)*1000/(performance.now()-start);
        }""")
    # The OS and CI load can reduce throughput. Check real application work and the ceiling.
    cross=page.locator('#ks-crosshair')
    assert not cross.is_visible()
    assert page.locator(".crosshair-dot").is_visible()
    fixed = sample()
    assert 0 < fixed <= 185, fixed
    page.evaluate("""() => {
      const prefs={gpu:'enabled',angle:'default',uncapFps:true};
      window.__KS_CLIENT__.setBrowserConfig(prefs,prefs,true,'');
    }""")
    assert page.evaluate('window.__KS_FRAME_PACER__.getStats().effectiveLimit') == 60
    page.evaluate('window.__KS_CLIENT__.open()')
    page.locator('.ks-subtab[data-tab="Frame Stability"]').click()
    assert page.evaluate('window.__KS_FRAME_PACER__.getStats().effectiveLimit') == 30
    menu = sample()
    assert 0 < menu <= 32, menu
    page.evaluate("""() => {
      window.__KS_CLIENT__.close();
      document.querySelector('.interface').className='desktop-game-interface';
      window.__KS_GAME_RUNTIME__.refresh();
    }""")
    assert page.evaluate('window.__KS_FRAME_PACER__.getStats().effectiveLimit') == 180
    assert page.evaluate('window.__KS_FRAME_PACER__.getStats().nativeWakes') > 0
    assert cross.is_visible()
    assert not page.locator(".crosshair-dot").is_visible()
    page.evaluate("document.querySelector('canvas').style.cssText='position:fixed;left:43.5px;top:19px;width:407px;height:221px'")
    def centered():
        page.wait_for_function('''() => {
          const a=document.querySelector('canvas').getBoundingClientRect();
          const b=document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-crosshair svg').getBoundingClientRect();
          return Math.abs(a.left+a.width/2+2/devicePixelRatio-b.left-b.width/2)<.05 && Math.abs(a.top+a.height/2-b.top-b.height/2)<.05;
        }''')
    centered()
    page.evaluate("document.querySelector('canvas').style.width='406px'")
    centered()
    page.evaluate("document.querySelector('.desktop-game-interface').className='interface';window.__KS_GAME_RUNTIME__.refresh()")
    assert not cross.is_visible()
    assert page.locator(".crosshair-dot").is_visible()
    print(f'Chromium WebGL clears/s on fixture: fixed {fixed:.1f}, Settings {menu:.1f}')
    browser.close()
