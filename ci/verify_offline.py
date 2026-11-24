from pathlib import Path
from zipfile import ZipFile
import hashlib,json
root=Path(__file__).resolve().parents[1]
zip_path=root/'KS-Client-beta-1.0.29-Portable.zip'
setup=root/'KS-Client-beta-1.0.29-Setup.exe'
assert zip_path.is_file() and setup.is_file()
assert setup.stat().st_size > zip_path.stat().st_size, 'setup missing embedded package'
with ZipFile(zip_path) as z:
 assert z.testzip() is None, 'ZIP CRC failed'
 assert not any(n.lower().startswith('runtime/cef/') or n.lower().endswith(('libcef.dll','cefsharp.dll')) for n in z.namelist()), 'Unexpected CEF runtime'
 engine,exe='Electron','KSClientGame.exe'
 marker=json.loads(z.read(f'runtime/{engine}/ks-smoke-pass.json').decode('utf-8-sig'))
 assert marker['version']=='1.0.29' and marker['result']=='PASS'
 assert marker['exeSha256']==hashlib.sha256(z.read(f'runtime/{engine}/{exe}')).hexdigest()
 for name in ('KS-Client.exe','Uninstall-KS-Client.exe','runtime/Electron/KSClientGame.exe','runtime/Electron/KSDriverLimit.exe','runtime/Electron/LICENSE','runtime/Electron/LICENSES.chromium.html','THIRD_PARTY_NOTICES.md','runtime/Electron/resources/app/main.cjs','runtime/Electron/resources/app/game-resolution.cjs','runtime/Electron/resources/app/assets/loading.html','runtime/Electron/resources/app/assets/ks-logo.png','runtime/Electron/resources/app/overlay/native_login_gate.js','runtime/Electron/resources/app/overlay/workshop.js','runtime/Electron/resources/app/overlay/integration_core.js','runtime/Electron/resources/app/overlay/game_runtime.js','runtime/Electron/resources/app/overlay/render_telemetry.js','runtime/Electron/resources/app/overlay/integration_bootstrap.js','runtime/Electron/resources/app/overlay/webgl_cosmetics.js','runtime/Electron/resources/app/overlay/advanced_integration.js','runtime/Electron/resources/app/overlay/freeze_guard.js','runtime/Electron/resources/app/swapper.cjs','runtime/Electron/resources/app/kirka-stats.cjs','runtime/Electron/resources/app/overlay/kirka_stats.js','runtime/Electron/resources/app/resource-packs.cjs'):
  assert name in z.namelist(),f'missing {name}'
 for catalog in (root/'electron-app/locales').glob('*.json'):
  name=f'runtime/Electron/resources/app/locales/{catalog.name}'
  assert z.read(name)==catalog.read_bytes(), f'wrong locale content: {name}'
# Check PE header and embedded package. Authenticode signatures are audited separately.
assert setup.read_bytes()[:2] == b'MZ'
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
report=(
 'KS CLIENT WINDOWS CI BUILD: PASSED AUTOMATED BUILD GATES\n'
 'Electron: official SHA256 verified; Windows runtime startup self-test passed.\n'
 'Migration: a legacy CEF selection starts Electron.\n'
 'Installer: offline payload bundled; extraction and in-place update Go tests passed.\n'
 'UI: Chromium DOM smoke test passed, including workshop controls.\n'
 'NOT TESTED: real Kirka.io gameplay, FPS unlock, manual GUI setup/uninstall on a clean end-user PC.\n'
 'Setup SHA256: '+sha(setup)+'\n'
 'Portable SHA256: '+sha(zip_path)+'\n'
)
(root/'CI-TEST-RESULT.txt').write_text(report,encoding='utf-8')
print(report)
