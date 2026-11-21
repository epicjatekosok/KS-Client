"""KS alpha 1.0.24 source contracts for CEF/Electron stability and updates."""
from pathlib import Path
r=Path(__file__).resolve().parents[1]
a=(r/'electron-app/overlay/overlay.js').read_text(encoding='utf8')
extras=(r/'electron-app/overlay/game_extras.js').read_text(encoding='utf8')
for invalid in ("data-setting=\"gameHitmarker", "data-setting=\"gameKillfeedColors", "toggleRow('Colored killfeed'"):
 assert invalid not in a, invalid
assert "ks-hitmarker-css" not in extras and "refreshKillfeed()" not in extras
assert "stats:!!state.gameStats" in extras and "gameKeystrokes" in extras
assert "function updateDiagnosticsUI()" in a and "Number.isFinite(value)" in a
assert "setDiagnostics: d => {if(d && typeof d==='object')" in a
assert "finally {" in a and "$('ks-dimmer')?.classList.toggle('visible',open)" in a
assert "update-open-release" in a and "Update check timed out" in a
assert "app.getAppMetrics()" in (r/'electron-app/main.cjs').read_text()
assert "process.getCPUUsage()" in (r/'electron-app/main.cjs').read_text()
assert "Timeout:18*time.Second" in (r/'launcher/update_windows.go').read_text()
assert "KS_PUBLIC_RELEASE_TOKEN" in (r/'ci/Publish-Release.ps1').read_text()
assert 'v1.0.24-beta' in (r/'ci/Publish-Release.ps1').read_text()
assert 'RELEASE_BETA_124_EN.md' in (r/'ci/Publish-Release.ps1').read_text()
print('PASS: 1.0.24 both engines, diagnostics, Electron-first and honest update feed')
