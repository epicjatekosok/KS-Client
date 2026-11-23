"""KS 1.0.28: release, brand, mouse and signing contract checks."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
extras=(root/'electron-app/overlay/game_extras.js').read_text(encoding='utf8')
electron=(root/'electron-app/main.cjs').read_text(encoding='utf8')
pacer=(root/'electron-app/overlay/frame_pacer.js').read_text(encoding='utf8')
registry=(root/'electron-app/overlay/integration_bootstrap.js').read_text(encoding='utf8')
installer=(root/'installer/main_windows.go').read_text(encoding='utf8')
workflow=(root/'.github/workflows/windows-build.yml').read_text(encoding='utf8')
package=(root/'ci/package_offline.py').read_text(encoding='utf8')
assert '1.0.28' in electron
assert '1.0.28' in (root/'ci/Build-Setup.ps1').read_text(encoding='utf8')
assert 'Publish verified ZIP and EXE directly to GitHub Releases' in workflow
assert 'startSplash()' in electron and 'assets' in electron and 'loading.html' in electron
assert (root/'electron-app/assets/ks-logo.png').is_file()
assert (root/'electron-app/assets/loading.html').is_file()
assert 'pointerlockchange' in extras and 'relativeMoves' in extras
assert '__KS_RENDER_OBSERVER__' not in pacer, 'Duplicate frame-pacer registry would steal the main WebGL hook'
assert 'onContext: callback' in registry and 'getStats: () =>' in registry
assert '"-EncodedCommand"' not in installer, 'Installer must not run opaque encoded PowerShell'
assert 'KS_SIGNING_PFX_BASE64' in workflow and 'Verify-Signing.ps1' in workflow
assert 'SIGNING-STATUS.txt' in workflow
assert "Get-AuthenticodeSignature" in (root/'ci/Verify-Signing.ps1').read_text(encoding='utf8')
assert 'runtime/Electron/resources/app/assets/loading.html' in package
print('PASS: KS 1.0.28 brand assets, real capture wiring, signing gate and release names')

assert (root/'electron-app/overlay/game_runtime.js').is_file()
assert (root/'electron-app/overlay/render_telemetry.js').is_file()
assert "gameRuntimeJS" in electron and "drawTelemetryJS" in electron
workflow=(root/'.github/workflows/windows-build.yml').read_text()
assert 'ci/Publish-Release.ps1' in workflow and 'ci/make_release_manifest.py' in workflow
assert "contents: write" in workflow
assert 'SHA256SUMS.txt' in workflow and 'RELEASE-MANIFEST.json' in workflow
print("PASS: Beta 1.0.28 release provenance, game runtime and direct assets")


# The standalone GitHub Release must use its own 1.0.28 QA documentation.
assert "RELEASE_BETA_128_EN.md" in (root/'ci/Publish-Release.ps1').read_text(encoding='utf8')
