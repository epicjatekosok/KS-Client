"""Offline contract tests for Kirka Game Runtime 2.0 and passive draw telemetry.
Does not simulate live Kirka network, server rules, or CEF pointer-lock physics.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
files=('game_runtime.js','render_telemetry.js')
scripts={}
for name in files:
    a=(root/'electron-app/overlay'/name).read_text(encoding='utf8')
    b=(root/'cef/overlay'/name).read_text(encoding='utf8')
    assert a==b,name+' differs across engines'
    scripts[name]=a

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://kirka.io/games/test', lambda route:route.fulfill(status=200,content_type='text/html',
        body='''<!DOCTYPE html><body>
        <div class="game-interface"><canvas id="game"></canvas></div>
        <div class="ui-cell kill"><span class="cell-value">2</span></div>
        <div class="kill-bar-cont"></div><div class="ach-cont"></div>
        </body>'''))
    page.goto('https://kirka.io/games/test')
    page.add_script_tag(content=scripts['game_runtime.js'])
    assert page.evaluate("window.__KS_GAME_RUNTIME__?.getStatus().scene === 'match'")
    assert page.evaluate("window.__KS_GAME_RUNTIME__.getSnapshot().stats.kills") == 2
    assert page.evaluate("window.__KS_GAME_RUNTIME__.getStatus().feedWatchers")==2
    page.evaluate("""() => {
       window.ksEvents=[];
       window.__KS_GAME_RUNTIME__.on('*',e=>window.ksEvents.push(e));
       const bar=document.querySelector('.kill-bar-cont');
       const item=document.createElement('div');item.className='kill-bar-item';
       item.textContent='ALICE defeated BOB';bar.appendChild(item);
       document.querySelector('.ui-cell.kill .cell-value').textContent='3';
       window.__KS_GAME_RUNTIME__.refresh();
    }""")
    page.wait_for_timeout(80)
    assert page.evaluate("window.__KS_GAME_RUNTIME__.getSnapshot().stats.kills")==3
    assert page.evaluate("window.ksEvents.filter(e=>e.type==='killfeed').length")==1
    assert page.evaluate("window.ksEvents.some(e=>e.type==='stats' && e.detail.kills===3)")
    assert page.evaluate("window.__KS_GAME_RUNTIME__.getStatus().compatibility.supported.match")
    assert page.evaluate("window.__KS_GAME_RUNTIME__.getStatus().compatibility.missing.length")==0
    page.evaluate("""() => {
      window.seenSnapshot=null;
      window.__KS_GAME_RUNTIME__.on('stats',()=>window.seenSnapshot=window.__KS_GAME_RUNTIME__.getSnapshot().stats.kills);
      document.querySelector('.cell-value').textContent='';
      window.__KS_GAME_RUNTIME__.refresh();
    }""")
    assert page.evaluate("window.seenSnapshot===null && window.__KS_GAME_RUNTIME__.getSnapshot().stats.kills===null")
    page.evaluate("document.querySelector('.game-interface').hidden=true;window.__KS_GAME_RUNTIME__.refresh()")
    assert page.evaluate("window.__KS_GAME_RUNTIME__.scene==='loading'")
    # Browser SPA scene transitions detach scoped watchers, not leak them.
    page.evaluate("""() => {
      history.pushState({},'', '/');
      document.body.innerHTML='<div class="interface">Lobby</div>';
      window.__KS_GAME_RUNTIME__.refresh();
    }""")
    assert page.evaluate("window.__KS_GAME_RUNTIME__.getStatus().scene==='lobby'")
    assert page.evaluate("window.__KS_GAME_RUNTIME__.getStatus().feedWatchers===0")
    assert page.evaluate("window.__KS_GAME_RUNTIME__.getSnapshot().stats.kills===null")
    # Passive graphics telemetry requires an existing shared registry and never
    # invokes canvas.getContext() or changes any draw arguments.
    page.evaluate("""() => {
      window.glDraws=0;
      window.gl={
        drawArrays(){window.glDraws++},
        drawElements(){window.glDraws++},
        drawArraysInstanced(){window.glDraws++},
        drawElementsInstanced(){window.glDraws++},
        bindTexture(){},clear(){},uniformMatrix4fv(){}
      };
      window.originalDraw=window.gl.drawArrays;
      const canvas=document.createElement('canvas');canvas.id='game';
      document.body.appendChild(canvas);
      window.__KS_RENDER_OBSERVER__={
        onContext:fn=>{fn(window.gl,canvas,'webgl2');return ()=>{};},
        getStatus:()=>({trackedContexts:1})
      };
    }""")
    page.add_script_tag(content=scripts['render_telemetry.js'])
    assert page.evaluate("window.gl.drawArrays===window.originalDraw")
    page.evaluate("window.__KS_RENDER_TELEMETRY__.setActive(true)")
    assert page.evaluate("window.__KS_RENDER_TELEMETRY__?.getStatus().attached===1")
    page.evaluate("""() => {
      window.gl.drawArrays(4,0,3);window.gl.drawElements(4,6,0,0);
      window.gl.bindTexture(3553,{});
      window.gl.clear(16384);
    }""")
    assert page.evaluate("window.__KS_RENDER_TELEMETRY__.getStatus().drawCalls")==2
    assert page.evaluate("window.__KS_RENDER_TELEMETRY__.getStatus().textureBinds")==1
    assert page.evaluate("window.__KS_RENDER_TELEMETRY__.getStatus().clearCalls")==1
    assert page.evaluate("window.glDraws")==2
    page.evaluate("window.__KS_RENDER_TELEMETRY__.stop()")
    assert page.evaluate("window.gl.drawArrays===window.originalDraw")
    page.evaluate("window.__KS_GAME_RUNTIME__.stop()")
    assert page.evaluate("window.__KS_GAME_RUNTIME__.getStatus().feedWatchers")==0
    assert not errors,errors
    browser.close()
print('PASS KS 1.1.16: shared scenes, HUD, exact one killfeed event, compatibility, WebGL restoration')
