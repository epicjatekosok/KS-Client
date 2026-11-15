"""Offline integration regression test for KS Client 1.1.12.
Does not claim to test live Kirka.io, Windows CEF or native pointer lock.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
files = ["integration_bootstrap.js", "integration_core.js"]
for name in files:
    electron = (root / "electron-app" / "overlay" / name).read_text(encoding="utf-8")
    cef = (root / "cef" / "overlay" / name).read_text(encoding="utf-8")
    assert electron == cef, f"CEF/Electron {name} diverged"

boot = (root / "electron-app/overlay/integration_bootstrap.js").read_text(encoding="utf-8")
core = (root / "electron-app/overlay/integration_core.js").read_text(encoding="utf-8")
origin_check = "if (location.protocol !== 'https:' || !['kirka.io', 'www.kirka.io'].includes(location.hostname)) return;"
assert origin_check in boot and origin_check in core
boot = boot.replace(origin_check, "/* Offline test origin */")
core = core.replace(origin_check, "/* Offline test origin */")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_content("""<!doctype html><body>
        <div id="app"><div class="interface">Lobby</div></div>
        <canvas id="game" width="300" height="180"></canvas>
    </body>""")
    page.add_script_tag(content=boot)
    assert page.evaluate("!!window.__KS_RENDER_OBSERVER__")
    assert page.evaluate("document.querySelector('#game').getContext('2d') !== null")
    page.add_script_tag(content=core)
    page.wait_for_function("window.__KS_INTEGRATION__?.getStatus().scene === 'lobby'")
    assert page.evaluate("window.__KS_INTEGRATION__.safeRoom('https://kirka.io/games/abc') !== null")
    assert page.evaluate("window.__KS_INTEGRATION__.safeRoom('https://evil.example/games/abc') === null")
    assert page.evaluate("window.__KS_INTEGRATION__.safeRoom('javascript:alert(1)') === null")
    page.evaluate("""() => {
        const app = document.getElementById('app');
        app.innerHTML = '<div class="desktop-game-interface"></div>' +
           '<div class="script-ui"><div class="ui-row"><div class="ui-cell kill"><span class="cell-value">3</span></div></div></div>' +
           '<div class="kill-bar-cont"></div>';
        window.__KS_INTEGRATION__.refresh();
    }""")
    page.wait_for_function("window.__KS_INTEGRATION__?.getStatus().scene === 'match'")
    assert page.locator('[data-ks-integration="stats"]').count() == 1
    assert "KS K: 3" in page.locator('[data-ks-integration="stats"]').inner_text()
    page.evaluate("""() => {
        document.getElementById('app').innerHTML = '<div class="interface">Lobby</div>';
        window.__KS_INTEGRATION__.refresh();
    }""")
    assert page.locator('[data-ks-integration="stats"]').count() == 0
    assert not errors, errors
    page.close()
    browser.close()
print("PASS: KS 1.1.12 offline deep integration regressions")
