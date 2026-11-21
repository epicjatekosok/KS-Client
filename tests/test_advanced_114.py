"""Offline Chromium checks for KS Client 1.1.14 native Kirka UI and WebGL cosmetics.
Do not claim a real Kirka match or native CEF pointer lock is tested here.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
names=("advanced_integration.js","webgl_cosmetics.js","freeze_guard.js")
scripts={}
for name in names:
 a=(root/"electron-app/overlay"/name).read_text(encoding="utf-8")
 b=(root/"cef/overlay"/name).read_text(encoding="utf-8")
 assert a==b, name+" differs between CEF and Electron"
 assert "kirka.io" in a and "location.protocol" in a
 # Only strip the explicit allowlist for the deliberately offline test page.
 guard="if(location.protocol!=='https:'||!['kirka.io','www.kirka.io'].includes(location.hostname)||"
 assert guard in a, name
 if name=="advanced_integration.js":
  a=a.replace(guard+"window.__KS_DEEP__)return;", "if(window.__KS_DEEP__)return;")
 elif name=="webgl_cosmetics.js":
  a=a.replace(guard+"window.__KS_WEBGL_COSMETICS__)return;", "if(window.__KS_WEBGL_COSMETICS__)return;")
 else:
  a=a.replace(guard+"window.__KS_FREEZE_GUARD__)return;", "if(window.__KS_FREEZE_GUARD__)return;")
 scripts[name]=a

with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 page=browser.new_page()
 errors=[]
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.set_content("""<!doctype html><body>
   <div class="interface">Lobby <button id="join-btn">Open Join</button></div>
   <div id="join-modal-modal" style="display:none">
     <input class="input"><button class="btn">Join</button><button class="btn">Spectate</button>
   </div>
   <div class="inventory"><div class="item-card"><img alt="TEST SKIN"></div></div>
   <canvas id="game" width="200" height="100"></canvas>
 </body>""")
 page.evaluate("""() => {
    const store={};
    Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:key=>store[key]??null,setItem:(key,val)=>{store[key]=String(val)},
      removeItem:key=>{delete store[key]}
    }});
    window.__KS_INTEGRATION__={getStatus:()=>({scene:'lobby'})};
    window.__out=[];
    window.__KS_NATIVE__={post:x=>window.__out.push(x)};
    window.__clicks={join:0,spectate:0};
    document.querySelector('#join-btn').onclick=()=>document.querySelector('#join-modal-modal').style.display='block';
    document.querySelector('#join-modal-modal .btn').onclick=()=>window.__clicks.join++;
    document.querySelector('#join-modal-modal .btn:last-child').onclick=()=>window.__clicks.spectate++;
  }""")
 page.add_script_tag(content=scripts["advanced_integration.js"])
 assert page.evaluate("!!window.__KS_DEEP__")
 assert page.evaluate("window.__KS_DEEP__.getSnapshot().inventory.visibleCount===1")
 assert page.evaluate("window.__KS_DEEP__.getSnapshot().market.visibleCount===0")
 assert page.evaluate("window.__KS_DEEP__.getSnapshot().scene==='lobby'")
 assert page.evaluate("window.__KS_DEEP__.join('https://evil.example/games/x',false)")==False
 assert page.evaluate("window.__KS_DEEP__.join('https://kirka.io/games/test',true)")==True
 assert page.evaluate("window.__clicks.spectate") == 1
 assert page.evaluate("window.__clicks.join") == 0
 assert page.evaluate("window.__KS_DEEP__.join('https://kirka.io/games/test',false)")==True
 assert page.evaluate("window.__clicks.join") == 1
 page.evaluate("""() => {
   const mock={
     texImage2D(){},
     uniformMatrix4fv(_loc,_tr,data){window.__matrix=[...data];}
   };
   window.__mockGL=mock;
   window.__matrixOriginal=mock.uniformMatrix4fv;
   HTMLCanvasElement.prototype.getContext=function(kind){return kind==='webgl'?mock:null;};
   localStorage.setItem('ksclient.webgl.v114',JSON.stringify({
     enabled:true,assetURL:'',skinURL:'',matrixSignature:'1.000,1.000,1.000,0.100,0.200,0.300',
     offsetX:0.25,offsetY:0,offsetZ:0,scale:110
   }));
 }""")
 page.add_script_tag(content=scripts["webgl_cosmetics.js"])
 assert page.evaluate("document.querySelector('#game').getContext('webgl')===window.__mockGL")
 page.evaluate("""() => {
   const v=new Float32Array(16);v[0]=v[5]=v[10]=v[15]=1;v[12]=.1;v[13]=.2;v[14]=.3;
   window.__mockGL.uniformMatrix4fv({},false,v);
 }""")
 # The signature is exact to 3 decimal places and applies only to the opted-in game canvas.
 assert page.evaluate("window.__KS_WEBGL_COSMETICS__.getStatus().contexts===1")
 assert page.evaluate("window.__KS_WEBGL_COSMETICS__.getStatus().matrixTransforms===1")
 assert page.evaluate("Math.abs(window.__matrix[12]-.35)<.000001")
 page.evaluate("""() => {
   localStorage.removeItem('ksclient.webgl.v114');window.__KS_WEBGL_COSMETICS__.refresh();
 }""")
 assert page.evaluate('window.__mockGL.uniformMatrix4fv===window.__matrixOriginal')
 page.add_script_tag(content=scripts["freeze_guard.js"])
 assert page.evaluate("window.__KS_FREEZE_GUARD__.getStatus().enabled===false")
 assert not errors,errors
 browser.close()
print("PASS: 1.1.14 native Join/Spectate, sanitized inventory, WebGL transform and optional freeze guard")
