"""KS Client 1.0.10 regressions: preserve both engine overlays and release contracts."""
from pathlib import Path
r=Path(__file__).resolve().parents[1]
a=(r/'electron-app/overlay/overlay.js').read_text(encoding='utf8')
b=(r/'cef/overlay/overlay.js').read_text(encoding='utf8')
x=(r/'electron-app/overlay/game_extras.js').read_text(encoding='utf8')
y=(r/'cef/overlay/game_extras.js').read_text(encoding='utf8')
assert a==b, 'Electron and CEF settings overlays diverged'
assert x==y, 'Electron and CEF optional game stats diverged'
assert "showFPS: false" in a
assert "fpsPosition: 'top-left'" in a
assert "state.fpsPosition === 'top-left' ? '68px'" in a
assert '<span class="ks-quick-label">Settings</span>' not in a
assert 'id="ks-gear"' in a
assert "$('ks-quick').style.display = 'flex';" in a
assert 'ensureOverlayMounted' in a
assert "overlayBodyObserver.observe(document.body,{childList:true})" in a
assert '__KS_CLIENT__' in a
assert 'Kirka HUD data not exposed as HTML' not in x
assert "shown.length?'block':'none'" in x
assert "shown.join(' · ')" in x
assert 'gameKeystrokes' in x and 'gameStats' in x
assert '1.0.10' in (r/'electron-app/main.cjs').read_text()
assert '1.0.10' in (r/'launcher/main_windows.go').read_text()
assert '1.0.10' in (r/'installer/main_windows.go').read_text()
assert 'v1.0.10-beta' in (r/'ci/Publish-Release.ps1').read_text()
assert 'RELEASE_BETA_109_EN.md' in (r/'ci/Publish-Release.ps1').read_text()
print('PASS: KS 1.0.10 persistent gear, disabled FPS default, optional HUD and release contract')
