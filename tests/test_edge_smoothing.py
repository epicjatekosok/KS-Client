"""Check real WebGL attributes on the game canvas and protect other canvases."""
from pathlib import Path
from playwright.sync_api import sync_playwright
script=(Path(__file__).resolve().parents[1]/'electron-app/overlay/integration_bootstrap.js').read_text()
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(args=['--no-sandbox','--enable-unsafe-swiftshader'])
    for enabled in (True, False):
        page=browser.new_page()
        page.route('https://kirka.io/**',lambda r:r.fulfill(content_type='text/html',body='<canvas id="game"></canvas><canvas id="other"></canvas>'))
        page.goto('https://kirka.io/')
        page.evaluate("(enabled)=>localStorage.setItem('ksclient.settings.alpha',JSON.stringify({smoothGameEdges:enabled}))",enabled)
        page.add_script_tag(content=script)
        values=page.evaluate("""() => {
          const options=Object.freeze({antialias:false,alpha:false,stencil:true});
          const attrs=id=>document.querySelector(id).getContext('webgl',options).getContextAttributes();
          return [attrs('#game'),attrs('#other'),window.__KS_RENDER_OBSERVER__.getStats()];
        }""")
        assert values[0]['antialias']==enabled and values[2]['antialiasReported']==enabled,values
        assert values[1]['antialias'] is False and values[0]['alpha'] is False and values[0]['stencil'] is True
        page.close()
    browser.close()
print('PASS: native WebGL game edge smoothing on/off and unrelated canvas unchanged')
