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
assert 'awaitEngineSwitch' in launcher and 'engine-switch-' in launcher
assert 'switchTimeout' in launcher
cef_host=(root/'cef/ClientForm.cs').read_text()
assert 'SignalSwitchReady' in cef_host and 'SwitchToElectron' in cef_host
assert 'Shown +=' in cef_host and 'Keys.Control|Keys.Alt|Keys.E' in cef_host
assert 'ks-bridge-probe' in cef_host and '__ksclient_internal_switch_electron__' in cef_host
assert 'JavascriptMessageReceived' in cef_host
electron_host=(root/'electron-app/main.cjs').read_text()
assert 'signalSwitchReady' in electron_host and 'switchEngine' in electron_host
assert 'switchProbe' in electron_host and 'FPS startup flags:' in electron_host
assert "input.alt && input.key.toLowerCase()==='c'" in electron_host
assert 'setNativeFpsDiagnostics' in (root/'electron-app/overlay/overlay.js').read_text()
assert 'Test-Switching.ps1' in (root/'.github/workflows/windows-build.yml').read_text()
assert 'Test-CEF-Bridge.ps1' in (root/'.github/workflows/windows-build.yml').read_text()
extra=(root/'electron-app/overlay/game_extras.js').read_text()
assert extra==(root/'cef/overlay/game_extras.js').read_text()
assert 'requestPointerLock' in extra and 'gameKeystrokes' in extra
assert 'setPermissionCheckHandler' in electron_host
assert 'ClientGamePermissionHandler' in cef_host
assert 'game-screenshot' in electron_host and 'game-screenshot' in cef_host
assert 'game-join' in electron_host and 'game-join' in cef_host
workshop=(root/'electron-app/overlay/workshop.js').read_text()
assert workshop==(root/'cef/overlay/workshop.js').read_text()
assert 'ksWorkshopPlugin' in workshop and "sandbox','allow-scripts" in workshop
assert 'getConfig' in workshop and 'room-save' in workshop and 'item-save' in workshop
assert 'workshopJS' in electron_host and 'case \'resource-save\'' in electron_host
assert 'KSResourceSwap.Match' in cef_host and 'case "resource-save"' in cef_host
assert 'ResourceHandler.FromFilePath' in (root/'cef/ResourceSwap.cs').read_text()
assert 'protocol.handle' in (root/'electron-app/swapper.cjs').read_text()
assert 'executeJavaScript(workshopJS' in electron_host
# Deep integration must share exactly the same modules across both engines.
for name in ('integration_bootstrap.js','integration_core.js','game_runtime.js','render_telemetry.js','webgl_cosmetics.js','advanced_integration.js','freeze_guard.js'):
 bootstrap=(root/'electron-app/overlay'/name).read_text()
 assert bootstrap==(root/'cef/overlay'/name).read_text(),name+' differs between engines'
 assert "kirka.io" in bootstrap,name+' must be game-origin scoped'
assert "ks:early-integration" in electron_host
assert "ks:early-bundle" in (root/'electron-app/preload.cjs').read_text()
assert 'RenderProcessMessageHandler' in cef_host and 'KSEarlyIntegrationHandler' in cef_host
assert (root/'cef/EarlyIntegrationHandler.cs').is_file()
assert 'ExecuteJavaScriptAsync(graphics)' in cef_host
assert 'ExecuteJavaScriptAsync(advanced)' in cef_host
assert 'ExecuteJavaScriptAsync(gameRuntime)' in cef_host
assert 'ExecuteJavaScriptAsync(drawTelemetry)' in cef_host
assert 'ExecuteJavaScriptAsync(integrationCore)' in cef_host
assert 'ExecuteJavaScriptAsync(integrationBoot)' in cef_host
assert 'integrationCoreJS' in electron_host and 'advancedJS' in electron_host and 'graphicsJS' in electron_host and 'gameRuntimeJS' in electron_host and 'drawTelemetryJS' in electron_host
assert 'ks:early-graphics' in electron_host and 'ks:early-freeze' in electron_host
# The core integration now installs all early main-world hooks in one ordered script.
assert "ks:early-bundle" in electron_host
preload=(root/'electron-app/preload.cjs').read_text()
assert "ks:early-bundle" in preload
assert "executeJavaScriptInIsolatedWorld(0" in preload
assert "earlyGameJS=[frameJS,integrationBootJS,drawTelemetryJS,graphicsJS,freezeJS,gameRuntimeJS]" in electron_host
cef_early=(root/'cef/EarlyIntegrationHandler.cs').read_text()
assert "new KSEarlyIntegrationHandler(earlyGameJS)" in cef_host
assert "frame.ExecuteJavaScriptAsync(earlyGameJS)" in cef_early
assert "e.Frame.ExecuteJavaScriptAsync(earlyGameJS)" in cef_host
observer=(root/'electron-app/overlay/integration_bootstrap.js').read_text()
graphics=(root/'electron-app/overlay/webgl_cosmetics.js').read_text()
assert "onContext: callback" in observer
assert "shared.onContext" in graphics
assert "tests/test_runtime_integration.py" in (root/'.github/workflows/windows-build.yml').read_text()
assert 'tests/test_game_integration_112.py' in (root/'.github/workflows/windows-build.yml').read_text()
workflow=(root/'.github/workflows/windows-build.yml').read_text()
assert 'needs: [source-check, electron, cef]' in workflow
assert 'tests/test_ci_release_gates.py' in workflow
print('PASS: alpha 1.1.19 source, runtimes and gated offline package')

# KS 1.1.19 single game-state runtime and passive GPU event observer.
assert "window.__KS_GAME_RUNTIME__" in (root/'electron-app/overlay/game_runtime.js').read_text()
assert "window.__KS_RENDER_TELEMETRY__" in (root/'electron-app/overlay/render_telemetry.js').read_text()
assert "shared.on('killfeed'" in (root/'electron-app/overlay/advanced_integration.js').read_text()
assert "runtimeSubscriptions" in (root/'electron-app/overlay/advanced_integration.js').read_text()
assert "render_telemetry.js" in (root/'ci/Prepare-Electron.ps1').read_text()
assert "render_telemetry.js" in (root/'ci/Build-CEF.ps1').read_text()

# Native CEF input is Chromium-owned after 1.1.19 (no fake cursor capture).
cef_program=(root/'cef/Program.cs').read_text()
cef_probe=(root/'cef/overlay/cef_input_probe.js').read_text()
assert 'CefRuntimeStyle.Chrome' in cef_program and '--ks-cef-alloy' in cef_program
assert 'ActivateBrowserOnCreation=true' in cef_host
assert 'Cursor.Hide()' not in cef_host and 'NativeCursor.SetCursor' not in cef_host
assert 'KSGameCursorHandler(' not in cef_host
assert 'cefInputProbe' in cef_host and 'cef_input_probe.js' in cef_host
assert 'proto.requestPointerLock=passThrough' in cef_probe
assert 'overlay\\cef_input_probe.js' in (root/'ci/Build-CEF.ps1').read_text()
assert 'tests/test_cef_input_117.py' in workflow
print('PASS: KS 1.1.19 CEF focus, pointer-lock, and eye-filter source invariants')
