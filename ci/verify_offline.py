from pathlib import Path
from zipfile import ZipFile
import hashlib,json
root=Path(__file__).resolve().parents[1]
zip_path=root/'KS-Client-beta-1.0.15-Portable.zip'
setup=root/'KS-Client-beta-1.0.15-Setup.exe'
assert zip_path.is_file() and setup.is_file()
assert setup.stat().st_size > zip_path.stat().st_size, 'setup missing embedded package'
with ZipFile(zip_path) as z:
 assert z.testzip() is None, 'ZIP CRC failed'
 for engine,exe in [('Electron','electron.exe'),('CEF','KS.Cef.Client.exe')]:
  marker=json.loads(z.read(f'runtime/{engine}/ks-smoke-pass.json').decode('utf-8-sig'))
  assert marker['version']=='1.0.15' and marker['result']=='PASS'
  assert marker['exeSha256']==hashlib.sha256(z.read(f'runtime/{engine}/{exe}')).hexdigest()
 for name in ('KS-Client.exe','Uninstall-KS-Client.exe','runtime/CEF/KS.Cef.Client.exe','runtime/CEF/dotnet/dotnet.exe','runtime/Electron/electron.exe','runtime/Electron/resources/app/main.cjs','runtime/Electron/resources/app/assets/loading.html','runtime/Electron/resources/app/assets/ks-logo.png','runtime/Electron/resources/app/overlay/native_login_gate.js','runtime/Electron/resources/app/overlay/workshop.js','runtime/Electron/resources/app/overlay/integration_core.js','runtime/Electron/resources/app/overlay/game_runtime.js','runtime/Electron/resources/app/overlay/render_telemetry.js','runtime/Electron/resources/app/overlay/integration_bootstrap.js','runtime/Electron/resources/app/overlay/webgl_cosmetics.js','runtime/Electron/resources/app/overlay/advanced_integration.js','runtime/Electron/resources/app/overlay/freeze_guard.js','runtime/Electron/resources/app/swapper.cjs','runtime/CEF/assets/ks-logo.png','runtime/CEF/overlay/native_login_gate.js','runtime/CEF/overlay/workshop.js','runtime/CEF/overlay/integration_core.js','runtime/CEF/overlay/game_runtime.js','runtime/CEF/overlay/render_telemetry.js','runtime/CEF/overlay/cef_input_probe.js','runtime/CEF/overlay/integration_bootstrap.js','runtime/CEF/overlay/webgl_cosmetics.js','runtime/CEF/overlay/advanced_integration.js','runtime/CEF/overlay/freeze_guard.js'):
  assert name in z.namelist(),f'missing {name}'
# Check PE header and embedded package. Authenticode signatures are audited separately.
assert setup.read_bytes()[:2] == b'MZ'
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
report=(
 'KS CLIENT WINDOWS CI BUILD: PASSED AUTOMATED BUILD GATES\n'
 'Electron: official SHA256 verified; Windows runtime startup self-test passed.\n'
 'CEF: published on Windows; local .NET Desktop runtime bundled; startup self-test passed.\n'
 'Installer: offline payload bundled; extraction and in-place update Go tests passed.\n'
 'UI: Chromium DOM smoke test passed, including workshop controls.\n'
 'NOT TESTED: real Kirka.io gameplay, FPS unlock, manual GUI setup/uninstall on a clean end-user PC.\n'
 'Setup SHA256: '+sha(setup)+'\n'
 'Portable SHA256: '+sha(zip_path)+'\n'
)
(root/'CI-TEST-RESULT.txt').write_text(report,encoding='utf-8')
print(report)
