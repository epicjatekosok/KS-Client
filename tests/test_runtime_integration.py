"""Integration foundation regression: shared early WebGL registry and safe replay.
Only offline Chromium behavior is tested; CEF pointer lock needs real Windows Kirka.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
files = ("integration_bootstrap.js", "webgl_cosmetics.js", "advanced_integration.js")
src = {}
for name in files:
    electron = (root / "electron-app/overlay" / name).read_text(encoding="utf-8")
    cef = (root / "cef/overlay" / name).read_text(encoding="utf-8")
    assert electron == cef, name + " diverged between browser engines"
    src[name] = electron

guard = "if (location.protocol !== 'https:' || !['kirka.io', 'www.kirka.io'].includes(location.hostname)) return;"
boot = src["integration_bootstrap.js"]
assert guard in boot
boot = boot.replace(guard, "/* Synthetic local origin, offline test only */")
graphics = src["webgl_cosmetics.js"]
guard_graphics = "if(location.protocol!=='https:'||!['kirka.io','www.kirka.io'].includes(location.hostname)||window.__KS_WEBGL_COSMETICS__)return;"
assert guard_graphics in graphics
graphics = graphics.replace(guard_graphics, "if(window.__KS_WEBGL_COSMETICS__)return;")
deep = src["advanced_integration.js"]
guard_deep = "if(location.protocol!=='https:'||!['kirka.io','www.kirka.io'].includes(location.hostname)||window.__KS_DEEP__)return;"
assert guard_deep in deep
deep = deep.replace(guard_deep, "if(window.__KS_DEEP__)return;")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_content("""<!doctype html><body><div class="interface">Lobby</div>
      <canvas id="game" width="200" height="100"></canvas></body>""")
    page.evaluate("""() => {
       const storage = {};
       Object.defineProperty(window, 'localStorage', {configurable:true,value:{
          getItem:k=>storage[k]??null,
          setItem:(k,v)=>{storage[k]=String(v)},
          removeItem:k=>{delete storage[k]}
       }});
       window.__contextCalls=0;
       window.__gl = {
         texImage2D(...args){ window.__lastTextureArgs=args; },
         uniformMatrix4fv(location, transpose, data){ window.__matrix=[...data]; }
       };
       window.__originalMatrix=window.__gl.uniformMatrix4fv;
       const previous=HTMLCanvasElement.prototype.getContext;
       HTMLCanvasElement.prototype.getContext=function(kind,...rest){
         window.__contextCalls++;
         if (kind === 'webgl') return window.__gl;
         return Reflect.apply(previous, this, [kind,...rest]);
       };
       window.__KS_INTEGRATION__={getStatus:()=>({scene:window.__scene||'lobby'}),on:(e,fn)=>{
          window.__sceneCallback=fn;return()=>{window.__sceneCallback=null};
       }};
       localStorage.setItem('ksclient.webgl.v114', JSON.stringify({
         enabled:true,assetURL:'',skinURL:'',matrixSignature:'1.000,1.000,1.000,0.100,0.200,0.300',
         scale:110,offsetX:.25,offsetY:0,offsetZ:0
       }));
    }""")
    page.add_script_tag(content=boot)
    assert page.evaluate("window.__KS_RENDER_OBSERVER__?.getStatus().installed === true")
    page.evaluate("document.querySelector('#game').getContext('webgl')")
    assert page.evaluate("window.__contextCalls") == 1
    assert page.evaluate("window.__KS_RENDER_OBSERVER__.getStatus().trackedContexts") == 1

    page.evaluate("window.__replayA=0;window.__KS_RENDER_OBSERVER__.onContext(()=>window.__replayA++)")
    assert page.evaluate("window.__replayA") == 1
    page.evaluate("window.__replayB=0;window.__KS_RENDER_OBSERVER__.onContext(()=>window.__replayB++)")
    assert page.evaluate("window.__replayA") == 1, "second subscriber must not re-notify the first"
    assert page.evaluate("window.__replayB") == 1

    # Late cosmetic attachment must receive the already-created WebGL object
    # without calling getContext again (which could change canvas options).
    page.add_script_tag(content=graphics)
    assert page.evaluate("window.__KS_WEBGL_COSMETICS__?.getStatus().hookup === 'shared'")
    assert page.evaluate("window.__KS_WEBGL_COSMETICS__.getStatus().contexts") == 1
    assert page.evaluate("window.__contextCalls") == 1

    page.evaluate("""() => {
       const m=new Float32Array(16);
       m[0]=m[5]=m[10]=m[15]=1;
       m[12]=.1;m[13]=.2;m[14]=.3;
       window.__gl.uniformMatrix4fv({},false,m);
    }""")
    assert page.evaluate("window.__KS_WEBGL_COSMETICS__.getStatus().matrixTransforms") == 1
    assert page.evaluate("Math.abs(window.__matrix[12]-.35) < .000001")

    page.evaluate("window.__KS_WEBGL_COSMETICS__.restore()")
    assert page.evaluate("window.__gl.uniformMatrix4fv === window.__originalMatrix"), "render state must restore exact original method"

    # A scene transition should detach old feeds, not accumulate observers.
    page.evaluate("""() => {
       window.__scene='match';
       const feed=document.createElement('div');feed.className='kill-bar-cont';
       const achievements=document.createElement('div');achievements.className='ach-cont';
       document.body.append(feed,achievements);
    }""")
    page.add_script_tag(content=deep)
    assert page.evaluate("window.__KS_DEEP__?.getStatus().observers") == 2
    page.evaluate("""() => {
       window.__scene='lobby';
       window.__sceneCallback?.();
    }""")
    assert page.evaluate("window.__KS_DEEP__.getStatus().observers") == 0
    page.evaluate("window.__KS_DEEP__.destroy()")
    assert page.evaluate("window.__KS_DEEP__.getStatus().observers") == 0
    assert not errors, errors
    page.close()
    browser.close()
print("PASS: single WebGL observer, replay, no GPU re-creation, shared graphics, scene cleanup")
