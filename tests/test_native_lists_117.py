"""Exercise the shared controls on offline Kirka-shaped native lists."""
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

scripts = Path(__file__).resolve().parents[1] / 'electron-app' / 'overlay'
friends = """<div class="friends"><div class="list">
<div class="friend is-online"><b class="nickname">Árvíz</b><span class="friend-id">#AB12</span>
<span class="online">In game <a href="/games/a">Room</a></span></div>
<div class="friend"><b class="nickname">Beta</b></div>
</div></div>"""
servers = """<div class="servers"><div class="list">
<div class="server is-locked">Castle</div><div class="server">Forest</div>
<div class="server" hidden>Game-hidden</div></div></div>"""

with sync_playwright() as pw:
    browser = pw.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page()
    page.route('https://kirka.io/**', lambda r: r.fulfill(body=friends, content_type='text/html'))
    page.goto('https://kirka.io/')
    page.evaluate("""() => {
      window.calls=[]; window.shots=[];
      window.__KS_NATIVE__={post: m=>{if(m.type==='game-screenshot')shots.push(m)}};
      window.__KS_DEEP__={join:(url,spec)=>calls.push([url,spec])};
    }""")
    for filename in ['game_runtime.js', 'integration_core.js', 'overlay.js']:
        page.add_script_tag(content=(scripts / filename).read_text())
    search = page.get_by_role('searchbox')
    search.fill('arviz')
    rows = page.locator('.friend')
    expect(rows.nth(1)).to_be_hidden()
    search.fill('#ab12')
    expect(rows.first).to_be_visible()
    page.locator('.online a').evaluate("(a)=>a.href='/games/b'")
    page.locator('[data-ks-spectate]').click()
    assert page.evaluate('calls') == [['https://kirka.io/games/b', True]]
    rows.first.evaluate("r=>r.classList.remove('is-online')")
    expect(page.locator('[data-ks-spectate]')).to_have_count(0)
    search.fill('beta')
    page.locator('.friend .nickname').last.evaluate("e=>e.textContent='Gamma'")
    expect(rows.last).to_be_hidden()
    search.fill('')
    expect(rows.last).to_be_visible()

    page.locator('.friends').evaluate('(node,html)=>node.outerHTML=html', servers)
    page.evaluate('window.__KS_GAME_RUNTIME__.refresh()')
    locked = page.get_by_role('checkbox', name='Hide locked rooms')
    locked.check()
    rooms = page.locator('.server')
    expect(rooms.first).to_be_hidden()
    rooms.first.evaluate("r=>r.classList.remove('is-locked')")
    expect(rooms.first).to_be_visible()
    search.fill('castle')
    expect(rooms.nth(1)).to_be_hidden()
    page.evaluate("""() => {
      const key='ksclient.settings.alpha', prefs=JSON.parse(localStorage.getItem(key));
      prefs.gameListFilters=false;localStorage.setItem(key,JSON.stringify(prefs));
      window.__KS_INTEGRATION__.refresh();
    }""")
    expect(search).to_have_count(0)
    expect(rooms.nth(1)).to_be_visible()
    expect(rooms.last).to_be_hidden()
    page.keyboard.press('F2')
    assert page.evaluate('shots.length') == 0

    page.evaluate("""() => {
      const key='ksclient.settings.alpha', prefs=JSON.parse(localStorage.getItem(key));
      prefs.gameScreenshotKey=true;localStorage.setItem(key,JSON.stringify(prefs));
    }""")
    page.reload()
    page.evaluate("window.shots=[];window.__KS_NATIVE__={post:m=>{if(m.type==='game-screenshot')shots.push(m)}}")
    page.add_script_tag(content=(scripts / 'overlay.js').read_text())
    page.keyboard.down('F2')
    page.keyboard.down('F2')
    page.keyboard.up('F2')
    assert page.evaluate('shots.length') == 1
    page.evaluate("document.body.appendChild(document.createElement('input')).focus()")
    page.keyboard.press('F2')
    page.evaluate('window.__KS_CLIENT__.open()')
    page.keyboard.press('F2')
    assert page.evaluate('shots.length') == 1
    browser.close()
