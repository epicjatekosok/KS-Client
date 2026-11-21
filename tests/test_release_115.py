"""KS 1.1.15: release, brand, mouse and signing contract checks."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
cef=(root/'cef/ClientForm.cs').read_text(encoding='utf8')
pointer=(root/'cef/KSGameCursorHandler.cs').read_text(encoding='utf8')
extras=(root/'electron-app/overlay/game_extras.js').read_text(encoding='utf8')
electron=(root/'electron-app/main.cjs').read_text(encoding='utf8')
pacer=(root/'electron-app/overlay/frame_pacer.js').read_text(encoding='utf8')
registry=(root/'electron-app/overlay/integration_bootstrap.js').read_text(encoding='utf8')
installer=(root/'installer/main_windows.go').read_text(encoding='utf8')
workflow=(root/'.github/workflows/windows-build.yml').read_text(encoding='utf8')
package=(root/'ci/package_offline.py').read_text(encoding='utf8')
assert '1.1.15' in electron
assert '1.1.15' in (root/'ci/Build-Setup.ps1').read_text(encoding='utf8')
assert '1.1.15-Windows-CI-PASSED' in workflow
assert 'new KSLoadingPanel' in cef
assert 'startSplash()' in electron and 'assets' in electron and 'loading.html' in electron
assert (root/'electron-app/assets/ks-logo.png').is_file()
assert (root/'cef/assets/ks-logo.png').is_file()
assert (root/'electron-app/assets/loading.html').is_file()
assert 'requestPointerLock' in extras and "game-input-diagnostics" in extras
assert 'cef()' in extras and 'state.gameAutoMouseCapture' in extras
assert 'SetPointerLockState(true)' in cef
assert 'GetWindowHandle()' in cef
assert 'SetCursor(IntPtr.Zero)' in pointer
assert '__KS_RENDER_OBSERVER__' not in pacer, 'Duplicate frame-pacer registry would steal the main WebGL hook'
assert 'onContext: callback' in registry and 'getStats: () =>' in registry
assert '"-EncodedCommand"' not in installer, 'Installer must not run opaque encoded PowerShell'
assert 'KS_SIGNING_PFX_BASE64' in workflow and 'Verify-Signing.ps1' in workflow
assert 'SIGNING-STATUS.txt' in workflow
assert "Get-AuthenticodeSignature" in (root/'ci/Verify-Signing.ps1').read_text(encoding='utf8')
assert 'runtime/Electron/resources/app/assets/loading.html' in package
assert 'runtime/CEF/assets/ks-logo.png' in package
print('PASS: KS 1.1.15 brand assets, real capture wiring, signing gate and release names')
