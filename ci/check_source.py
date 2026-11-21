from pathlib import Path
root=Path(__file__).resolve().parents[1]
a=(root/'electron-app/overlay/overlay.js').read_bytes()
for needle in ['KS saját motorja cooming soon'.encode(),b'Eye Comfort',b'Crosshair']:
 assert needle in a, f'missing expected menu identifier: {needle!r}'
ps=(root/'ci/Prepare-Electron.ps1').read_text()
assert 'SHA256' in ps and 'libEGL.dll' in ps and 'Never require' in ps
assert 'exec.Command(filepath.Join(folder, "KS-Engine-Setup.exe")' not in (root/'installer/main_windows.go').read_text().split('func main()')[1], 'installer still runs user-side engine compilation'
smoke=(root/'ci/Test-Engines.ps1').read_text()
assert "verify_engine('Electron'" in (root/'ci/package_offline.py').read_text()
assert 'ks-smoke-pass.json' in smoke and 'C0000005' in smoke
packager=(root/'ci/package_offline.py').read_text()
assert 'exeSha256' in packager
overlay=(root/'electron-app/overlay/overlay.js').read_text()
assert 'setEngineSwitchStatus' in overlay and 'enable-unlimited-fps' in overlay
assert 'handshakeTimer' in overlay
launcher=(root/'launcher/main_windows.go').read_text()
assert '--ks-switch-token=' in launcher and 'reportSwitchFailure' in launcher
assert 'awaitEngineSwitch' in launcher and 'engine-switch-' in launcher
assert 'switchTimeout' in launcher
electron_host=(root/'electron-app/main.cjs').read_text()
assert 'switchProbe' in electron_host and 'FPS startup flags:' in electron_host
assert 'setNativeFpsDiagnostics' in (root/'electron-app/overlay/overlay.js').read_text()
extra=(root/'electron-app/overlay/game_extras.js').read_text()
assert 'pointerlockchange' in extra and 'gameKeystrokes' in extra
assert 'setPermissionCheckHandler' in electron_host
workshop=(root/'electron-app/overlay/workshop.js').read_text()
assert 'ksWorkshopPlugin' in workshop and "sandbox','allow-scripts" in workshop
assert 'getConfig' in workshop and 'room-save' in workshop and 'item-save' in workshop
assert 'workshopJS' in electron_host and 'case \'resource-save\'' in electron_host
assert 'protocol.handle' in (root/'electron-app/swapper.cjs').read_text()
assert 'executeJavaScript(workshopJS' in electron_host
# Deep integration must share exactly the same modules across both engines.
for name in ('integration_bootstrap.js','integration_core.js','game_runtime.js','render_telemetry.js','webgl_cosmetics.js','advanced_integration.js','freeze_guard.js'):
 bootstrap=(root/'electron-app/overlay'/name).read_text()
 assert "kirka.io" in bootstrap,name+' must be game-origin scoped'
assert "ks:early-integration" in electron_host
assert "ks:early-bundle" in (root/'electron-app/preload.cjs').read_text()
assert 'integrationCoreJS' in electron_host and 'advancedJS' in electron_host and 'graphicsJS' in electron_host and 'gameRuntimeJS' in electron_host and 'drawTelemetryJS' in electron_host
assert 'ks:early-graphics' in electron_host and 'ks:early-freeze' in electron_host
# The core integration now installs all early main-world hooks in one ordered script.
assert "ks:early-bundle" in electron_host
preload=(root/'electron-app/preload.cjs').read_text()
assert "ks:early-bundle" in preload
assert "executeJavaScriptInIsolatedWorld(0" in preload
assert "earlyGameJS=[frameJS,integrationBootJS,drawTelemetryJS,graphicsJS,freezeJS,gameRuntimeJS]" in electron_host
observer=(root/'electron-app/overlay/integration_bootstrap.js').read_text()
graphics=(root/'electron-app/overlay/webgl_cosmetics.js').read_text()
assert "onContext: callback" in observer
assert "shared.onContext" in graphics
assert "tests/test_runtime_integration.py" in (root/'.github/workflows/windows-build.yml').read_text()
assert 'tests/test_game_integration_112.py' in (root/'.github/workflows/windows-build.yml').read_text()
workflow=(root/'.github/workflows/windows-build.yml').read_text()
assert 'needs: [source-check]' in workflow
assert 'actions/upload-artifact@' not in workflow and 'actions/download-artifact@' not in workflow
assert 'tests/test_ci_release_gates.py' in workflow
print('PASS: Beta 1.0.0 source, runtimes and gated offline package')

# KS 1.0.0 single game-state runtime and passive GPU event observer.
assert "window.__KS_GAME_RUNTIME__" in (root/'electron-app/overlay/game_runtime.js').read_text()
assert "window.__KS_RENDER_TELEMETRY__" in (root/'electron-app/overlay/render_telemetry.js').read_text()
assert "shared.on('killfeed'" in (root/'electron-app/overlay/advanced_integration.js').read_text()
assert "runtimeSubscriptions" in (root/'electron-app/overlay/advanced_integration.js').read_text()
assert "render_telemetry.js" in (root/'ci/Prepare-Electron.ps1').read_text()


from io import StringIO
import sys
sys.path.insert(0,str(root/'tools'))
from analyze_presentmon import summarize
sample='Application,ProcessID,SwapChainAddress,DisplayedTime\n'
sample+='electron.exe,42,0xab,5\nelectron.exe,42,0xab,15\nelectron.exe,42,0xab,NA\n'
sample+='electron.exe,43,0xab,100\nelectron.exe,42,0xcd,200\n'
assert summarize(StringIO(sample),42,'0xAB')==dict(samples=2,fps=100,p50_ms=10,p95_ms=15,p99_ms=15,application_fps=None)

sample='Application,ProcessID,SwapChainAddress,DisplayedTime,FrameTime\n'
sample+='electron.exe,42,0xab,5,2\nelectron.exe,42,0xab,15,2\nelectron.exe,42,0xab,NA,2\n'
assert summarize(StringIO(sample),42,'0xAB')['application_fps']==500
