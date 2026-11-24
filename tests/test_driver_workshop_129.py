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
    page.evaluate("document.querySelector('.weapon-name').textContent='AR-9'")
    assert page.evaluate('__KS_WEBGL_COSMETICS__.bindingSource()').endswith('texture.1794de31.webp')
    assert page.evaluate('__KS_WEBGL_COSMETICS__.verifiedPreview()')==''
    page.evaluate("document.querySelector('.weapon-name').textContent='Unknown'")
    assert page.evaluate('__KS_WEBGL_COSMETICS__.verifiedPreview()')==''
    page.evaluate(r"""() => {
        const g=document.querySelector('#game').getContext('webgl2'), program=g.createProgram();
        for(const [kind,source] of [[g.VERTEX_SHADER,'#version 300 es\nin vec4 p; uniform mat4 pose; void main(){gl_Position=pose*p;}'],
                                    [g.FRAGMENT_SHADER,'#version 300 es\nprecision mediump float; out vec4 c; void main(){c=vec4(1.);}']]){
           const shader=g.createShader(kind);g.shaderSource(shader,source);g.compileShader(shader);
           if(!g.getShaderParameter(shader,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(shader));
           g.attachShader(program,shader);
        }
        g.linkProgram(program);g.useProgram(program);
        const loc=g.getUniformLocation(program,'pose'), original=new Float32Array(16);
        original[0]=original[5]=original[10]=original[15]=1;
        window.poseValue=()=>{g.uniformMatrix4fv(loc,false,original);return [...g.getUniform(program,loc)]};
        const config={enabled:true,weaponPoses:[{name:'SCAR',signature:'1.000,1.000,1.000,0.000,0.000,0.000',scale:120,x:25,rz:90}]};
        document.querySelector('.weapon-name').textContent='SCAR';
        localStorage.setItem('ksclient.webgl.v114',JSON.stringify(config));__KS_WEBGL_COSMETICS__.refresh();
    }""")
    transformed=page.evaluate('poseValue()')
    assert abs(transformed[1]-1.2)<.0001 and abs(transformed[12]-.25)<.0001
    page.evaluate("document.querySelector('.weapon-name').textContent='Other'")
    unchanged=page.evaluate('poseValue()')
    assert unchanged[0]==1 and unchanged[1]==0 and unchanged[12]==0
    page.evaluate(r"""async () => {
        const g=document.querySelector('#game').getContext('webgl2'), canvas=g.canvas;
        canvas.width=canvas.height=32;g.viewport(0,0,32,32);g.bindFramebuffer(g.FRAMEBUFFER,null);
        document.querySelector('.weapon-name').textContent='SCAR';
        const source='https://kirka.io/assets/img/texture.b3fc7981.webp';
        localStorage.setItem('ksclient.webgl.v114',JSON.stringify({enabled:true,weaponPoses:[
          {name:'SCAR',auto:true,source,x:50,scale:100}]}));__KS_WEBGL_COSMETICS__.refresh();
        window.__KS_GAME_RUNTIME__={getStatus:()=>({scene:'match'})};
        window.testLock=true;Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>testLock?canvas:null});
        const pr=g.createProgram();
        for(const [kind,src] of [[g.VERTEX_SHADER,'#version 300 es\nuniform mat4 modelViewMatrix; void main(){gl_Position=modelViewMatrix*vec4(0.,0.,0.,1.);gl_PointSize=3.;}'],
           [g.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;uniform sampler2D map;out vec4 c;void main(){c=vec4(texture(map,vec2(.5)).r,1.,0.,1.);}']]){
           const sh=g.createShader(kind);g.shaderSource(sh,src);g.compileShader(sh);g.attachShader(pr,sh);
        }
        g.linkProgram(pr);if(!g.getProgramParameter(pr,g.LINK_STATUS))throw Error(g.getProgramInfoLog(pr));
        g.useProgram(pr);
        const loc=g.getUniformLocation(pr,'modelViewMatrix'),sampler=g.getUniformLocation(pr,'map');
        g.uniform1i(sampler,0);g.activeTexture(g.TEXTURE0);const texture=g.createTexture();
        g.bindTexture(g.TEXTURE_2D,texture);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);
        const img=new Image();img.src=source;await img.decode();
        g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,img);
        const identity=new Float32Array(16);identity[0]=identity[5]=identity[10]=identity[15]=1;
        window.drawForeground=(split=true)=>{
          g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
          g.uniformMatrix4fv(loc,false,identity);g.drawArrays(g.POINTS,0,1);
          if(split)g.clear(g.DEPTH_BUFFER_BIT);
          g.uniformMatrix4fv(loc,false,identity);g.drawArrays(g.POINTS,0,1);
          const px=new Uint8Array(4);g.readPixels(24,16,1,1,g.RGBA,g.UNSIGNED_BYTE,px);
          return [px[1],g.getUniform(pr,loc)[12]];
        };
    }""")
    assert page.evaluate('drawForeground()')==[255,0]
    assert page.evaluate('__KS_WEBGL_COSMETICS__.compatibility().automaticForegroundDraws')==1
    assert page.evaluate('drawForeground(false)')==[0,0]
    assert page.evaluate('testLock=false;drawForeground()')==[0,0]
    page.evaluate("delete window.__KS_GAME_RUNTIME__")
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
    page.evaluate("""() => {
        const list=document.querySelector('.friends .list'), nav=document.createElement('nav');
        nav.className='pagination';nav.innerHTML='<button rel="prev">Previous</button><button rel="next">Next</button>';
        list.after(nav);window.fpage=1;
        function render(){
            list.innerHTML='<div class="friend"><b class="nickname">Friend '+fpage+'</b><span class="friend-id">#'+fpage+'</span></div>';
            nav.firstChild.disabled=fpage===0;nav.lastChild.disabled=fpage===2;
        }
        nav.firstChild.onclick=()=>{fpage--;render()};nav.lastChild.onclick=()=>{fpage++;render()};render();
    }""")
    assert '3 friends' in page.evaluate('__KS_DEEP__.scanFriends()')
    assert page.evaluate('fpage')==1
    page.evaluate("document.querySelector('.friends').remove()")
    assert page.evaluate('__KS_DEEP__.friendsSnapshot().entries.length')==0
    browser.close()
