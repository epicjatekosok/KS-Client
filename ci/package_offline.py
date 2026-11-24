#!/usr/bin/env python3
"""Pack ONLY prebuilt, locally smoke-tested Windows runtimes (no builds on user PCs)."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json
root=Path(__file__).resolve().parents[1]
version='1.0.29'
zipname=f'KS-Client-beta-{version}-Portable.zip'
zipfile=root/zipname
def verify_engine(name, exe_name):
 folder=root/'runtime'/name
 exe=folder/exe_name
 marker=folder/'ks-smoke-pass.json'
 if not exe.is_file() or not marker.is_file():raise SystemExit(f'{name}: missing smoke-test marker; refusing release')
 data=json.loads(marker.read_text(encoding='utf-8-sig'))
 digest=hashlib.sha256(exe.read_bytes()).hexdigest()
 if not (data.get('version')=='1.0.29' and data.get('engine')==name and data.get('exeName')==exe_name and data.get('runner')=='windows' and data.get('result')=='PASS' and data.get('exeSha256')==digest):
  raise SystemExit(f'{name}: test marker does not match executable')
 return folder
verify_engine('Electron','KSClientGame.exe')
required=[
 'runtime/Electron/ks-smoke-pass.json','runtime/Electron/resources/app/overlay/frame_pacer.js','runtime/Electron/resources/app/overlay/overlay.js','runtime/Electron/resources/app/overlay/game_extras.js',
 'KS-Client.exe','Uninstall-KS-Client.exe',
 'runtime/Electron/KSClientGame.exe','runtime/Electron/KSDriverLimit.exe','runtime/Electron/LICENSE','runtime/Electron/LICENSES.chromium.html','runtime/Electron/resources/app/main.cjs','runtime/Electron/resources/app/game-resolution.cjs',
 'runtime/Electron/resources/app/assets/loading.html','runtime/Electron/resources/app/assets/ks-logo.png','runtime/Electron/resources/app/overlay/native_login_gate.js','runtime/Electron/resources/app/overlay/workshop.js','runtime/Electron/resources/app/overlay/integration_core.js','runtime/Electron/resources/app/overlay/game_runtime.js','runtime/Electron/resources/app/overlay/render_telemetry.js','runtime/Electron/resources/app/overlay/integration_bootstrap.js','runtime/Electron/resources/app/overlay/webgl_cosmetics.js','runtime/Electron/resources/app/overlay/advanced_integration.js','runtime/Electron/resources/app/overlay/freeze_guard.js','runtime/Electron/resources/app/swapper.cjs','runtime/Electron/resources/app/kirka-stats.cjs','runtime/Electron/resources/app/overlay/kirka_stats.js','runtime/Electron/resources/app/resource-packs.cjs',
]
for rel in required:
 p=root/rel
 if not p.is_file() or p.stat().st_size==0: raise SystemExit(f'Missing/empty build dependency: {rel}')
with ZipFile(zipfile,'w',ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
 for rel in ['KS-Client.exe','Uninstall-KS-Client.exe','README_EN.md','LICENSE','THIRD_PARTY_NOTICES.md','tools/Measure-KSClient.ps1','tools/analyze_presentmon.py','WORKSHOP_125.md']:
  z.write(root/rel,rel)
 for file in sorted((root/'runtime'/'Electron').rglob('*')):
  if file.is_file(): z.write(file,file.relative_to(root).as_posix())
with ZipFile(zipfile) as z:
 bad=z.testzip()
 if bad: raise SystemExit(f'ZIP CRC failure: {bad}')
 for rel in required:
  if rel not in z.namelist(): raise SystemExit(f'Missing from ZIP: {rel}')
(root/'installer'/zipname).write_bytes(zipfile.read_bytes())
print('Offline portable candidate:',zipfile,'bytes:',zipfile.stat().st_size)
print('SHA256:',hashlib.sha256(zipfile.read_bytes()).hexdigest())
