"""Exercise real texture uploads and framebuffer pixels in an isolated Kirka-shaped Chromium page."""
from pathlib import Path
from playwright.sync_api import sync_playwright

scripts = Path(__file__).resolve().parents[1] / 'electron-app/overlay'
with sync_playwright() as pw:
    browser = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page()
    page.route('https://kirka.io/**', lambda route: route.fulfill(content_type='text/html', body="""
        <canvas id="game" width="4" height="4"></canvas>
        <div class="list-weapons"><div class="weapon-cont"><div class="bottom is-selected">Selected</div>
        <b class="weapon-name">Test weapon</b><img width="20" height="20" src="/assets/textures/test.svg"></div></div>
        <div class="friends"><div class="list" style="height:30px;overflow:auto"></div></div>"""))
    page.route('**/texture.b3fc7981.webp', lambda r: r.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>'))
    page.route('**/test.svg', lambda r: r.fulfill(content_type='image/svg+xml',
        body='<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>'))
    page.goto('https://kirka.io/')
    page.evaluate("localStorage.setItem('ksclient.webgl.v114',JSON.stringify({discover:true}))")
    page.add_script_tag(content=(scripts/'webgl_cosmetics.js').read_text())
    page.evaluate("""async () => {
        const c=document.querySelector('#game'), g=c.getContext('webgl2');
        if(!g)throw Error('WebGL2 unavailable');
        const img=document.querySelector('img');await img.decode();
        const tex=g.createTexture();g.bindTexture(g.TEXTURE_2D,tex);
        window.upload=()=>g.texImage2D(g.TEXTURE_2D,0,g.RGBA,4,4,0,g.RGBA,g.UNSIGNED_BYTE,img);
        window.upload();
        const fb=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,fb);
        g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,tex,0);
        window.pixel=()=>{const px=new Uint8Array(4);g.readPixels(0,0,1,1,g.RGBA,g.UNSIGNED_BYTE,px);return [...px]};
    }""")
    assert page.evaluate('pixel()') == [255,0,0,255]
    assert page.evaluate('__KS_WEBGL_COSMETICS__.verifiedPreview()').endswith('/test.svg')
    assert page.evaluate('__KS_WEBGL_COSMETICS__.selectedWeapon()') == 'Test weapon'
    page.evaluate("""() => {
        const c=document.createElement('canvas');c.width=c.height=4;
        const ctx=c.getContext('2d');ctx.fillStyle='#00ff00';ctx.fillRect(0,0,4,4);
        localStorage.setItem('ksclient.webgl.v114', JSON.stringify({enabled:true,discover:true,
          assetURL:__KS_WEBGL_COSMETICS__.verifiedPreview(),skinURL:c.toDataURL('image/webp',1)}));
        __KS_WEBGL_COSMETICS__.refresh();
    }""")
    page.wait_for_function('__KS_WEBGL_COSMETICS__.getStatus().ready')
    page.evaluate('upload()')
    red,green,blue,alpha=page.evaluate('pixel()')
    assert green>245 and red<10 and blue<10 and alpha==255
    assert page.evaluate('__KS_WEBGL_COSMETICS__.getStatus().textureReplacements')==1
    page.evaluate("""async () => {
        document.querySelector('.weapon-name').textContent='SCAR';
        const img=new Image();img.src='/assets/img/texture.b3fc7981.webp';await img.decode();
        const gl=document.querySelector('#game').getContext('webgl2');
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
        const preview=document.querySelector('.weapon-cont img');preview.src='/thumbnail-only'; 
    }""")
    assert page.evaluate('__KS_WEBGL_COSMETICS__.verifiedPreview()').endswith('texture.b3fc7981.webp')
    assert page.evaluate('__KS_WEBGL_COSMETICS__.compatibility().replacementsForTexture')==0
    page.evaluate("document.querySelector('.weapon-name').textContent='Unknown'")
    assert page.evaluate('__KS_WEBGL_COSMETICS__.verifiedPreview()')==''
    page.add_script_tag(content=(scripts/'advanced_integration.js').read_text())
    page.evaluate("""() => {
        const list=document.querySelector('.friends .list');
        for(let i=0;i<125;i++)list.insertAdjacentHTML('beforeend','<div class="friend"><b class="nickname">P'+i+'</b><span class="friend-id">#'+i+'</span></div>');
        list.style.height='400px';list.scrollTop=10;
    }""")
    assert '125 friends' in page.evaluate('__KS_DEEP__.scanFriends()')
    assert page.evaluate("document.querySelector('.friends .list').scrollTop")==10
    page.evaluate("document.querySelector('.friend').remove()")
    assert page.evaluate("__KS_DEEP__.friendsSnapshot().entries.find(x=>x.id==='#0').observedEarlier")
    page.evaluate("document.querySelector('.friends').remove()")
    assert page.evaluate('__KS_DEEP__.friendsSnapshot().entries.length')==0
    browser.close()
