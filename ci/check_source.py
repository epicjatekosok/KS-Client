from pathlib import Path
root=Path(__file__).resolve().parents[1]
a=(root/'electron-app/overlay/overlay.js').read_bytes()
b=(root/'cef/overlay/overlay.js').read_bytes()
assert a==b,'CEF/Electron overlay implementations diverged'
for needle in [b'engine-switch',b'Eye Comfort',b'Crosshair']:
 assert needle in a, f'missing expected menu identifier: {needle!r}'
ps=(root/'ci/Prepare-Electron.ps1').read_text()
assert 'SHA256' in ps and 'libEGL.dll' in ps and 'Never require' in ps
assert 'exec.Command(filepath.Join(folder, "KS-Engine-Setup.exe")' not in (root/'installer/main_windows.go').read_text().split('func main()')[1], 'installer still runs user-side engine compilation'
# CEF must have the local host and both .NET 10 runtime components.
cef_build=(root/'ci/Build-CEF.ps1').read_text()
assert '-Runtime $kind' in cef_build and "windowsdesktop" in cef_build and "dotnet" in cef_build
assert 'AppHostDotNetSearch=AppRelative' in cef_build
for value in ('dotnet.exe','Microsoft.NETCore.App','Microsoft.WindowsDesktop.App','CefSharp.BrowserSubprocess.exe'):
 assert value in cef_build,value
smoke=(root/'ci/Test-Engines.ps1').read_text()
assert 'ks-smoke-pass.json' in smoke and 'C0000005' in smoke
packager=(root/'ci/package_offline.py').read_text()
assert "verify_engine('Electron'" in packager and "verify_engine('CEF'" in packager
assert 'exeSha256' in packager
overlay=(root/'electron-app/overlay/overlay.js').read_text()
assert 'setEngineSwitchStatus' in overlay and 'enable-unlimited-fps' in overlay
assert 'handshakeTimer' in overlay
launcher=(root/'launcher/main_windows.go').read_text()
assert '--ks-switch-token=' in launcher and 'reportSwitchFailure' in launcher
cef_host=(root/'cef/ClientForm.cs').read_text()
assert 'SignalSwitchReady' in cef_host and 'SwitchToElectron' in cef_host
electron_host=(root/'electron-app/main.cjs').read_text()
assert 'signalSwitchReady' in electron_host and 'switchEngine' in electron_host
workflow=(root/'.github/workflows/windows-build.yml').read_text()
assert 'needs: [source-check, electron, cef]' in workflow
assert 'tests/test_ci_release_gates.py' in workflow
print('PASS: alpha 1.1.8 source, runtimes and gated offline package')
