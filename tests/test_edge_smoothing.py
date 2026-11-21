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
        sampling=page.evaluate("""() => {
          const gl=document.querySelector('#game').getContext('webgl');
          const ext=gl.getExtension('EXT_texture_filter_anisotropic');
          if(!ext)return null;
          function sample(filter){
            const tex=gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D,tex);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,4,4,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
            gl.generateMipmap(gl.TEXTURE_2D);
            const value=gl.getTexParameter(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT);
            gl.deleteTexture(tex);
            return value;
          }
          return [sample(gl.LINEAR_MIPMAP_LINEAR),sample(gl.NEAREST_MIPMAP_NEAREST),
            Math.min(4,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)),gl.getError()];
        }""")
        if sampling:
            linear,nearest,supported,error=sampling
            assert (linear,nearest,error)==(supported if enabled else 1,1,0)
            print(f'WebGL smoothing={enabled}: antialias={values[0]["antialias"]}, linear={linear}x, nearest={nearest}x')
        page.close()
    browser.close()
print('PASS: native WebGL game edge smoothing on/off and unrelated canvas unchanged')
