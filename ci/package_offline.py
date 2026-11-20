#!/usr/bin/env python3
"""Pack ONLY prebuilt, locally smoke-tested Windows runtimes (no builds on user PCs)."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json
root=Path(__file__).resolve().parents[1]
version='1.0.17'
zipname=f'KS-Client-beta-{version}-Portable.zip'
zipfile=root/zipname
def verify_engine(name, exe_name):
 folder=root/'runtime'/name
 exe=folder/exe_name
 marker=folder/'ks-smoke-pass.json'
 if not exe.is_file() or not marker.is_file():raise SystemExit(f'{name}: missing smoke-test marker; refusing release')
 data=json.loads(marker.read_text(encoding='utf-8-sig'))
 digest=hashlib.sha256(exe.read_bytes()).hexdigest()
 if not (data.get('version')=='1.0.17' and data.get('engine')==name and data.get('exeName')==exe_name and data.get('runner')=='windows' and data.get('result')=='PASS' and data.get('exeSha256')==digest):
  raise SystemExit(f'{name}: test marker does not match executable')
 return folder
verify_engine('Electron','electron.exe')
cef=verify_engine('CEF','KS.Cef.Client.exe')
for framework in ('Microsoft.NETCore.App','Microsoft.WindowsDesktop.App'):
 folder=cef/'dotnet'/'shared'/framework
 if not folder.is_dir() or not any(p.is_dir() and p.name.startswith('10.') for p in folder.iterdir()):
  raise SystemExit(f'CEF missing local .NET 10 framework: {framework}')
required=[
 'KS-Client.exe','Uninstall-KS-Client.exe',
 'runtime/Electron/electron.exe','runtime/Electron/resources/app/main.cjs',
 'runtime/Electron/resources/app/assets/loading.html','runtime/Electron/resources/app/assets/ks-logo.png','runtime/Electron/resources/app/overlay/native_login_gate.js','runtime/Electron/resources/app/overlay/workshop.js','runtime/Electron/resources/app/overlay/integration_core.js','runtime/Electron/resources/app/overlay/game_runtime.js','runtime/Electron/resources/app/overlay/render_telemetry.js','runtime/Electron/resources/app/overlay/integration_bootstrap.js','runtime/Electron/resources/app/overlay/webgl_cosmetics.js','runtime/Electron/resources/app/overlay/advanced_integration.js','runtime/Electron/resources/app/overlay/freeze_guard.js','runtime/Electron/resources/app/swapper.cjs',
 'runtime/CEF/assets/ks-logo.png','runtime/CEF/overlay/native_login_gate.js','runtime/CEF/overlay/workshop.js','runtime/CEF/overlay/game_extras.js','runtime/CEF/overlay/integration_core.js','runtime/CEF/overlay/game_runtime.js','runtime/CEF/overlay/render_telemetry.js','runtime/CEF/overlay/cef_input_probe.js','runtime/CEF/overlay/integration_bootstrap.js','runtime/CEF/overlay/webgl_cosmetics.js','runtime/CEF/overlay/advanced_integration.js','runtime/CEF/overlay/freeze_guard.js',
 'runtime/CEF/KS.Cef.Client.exe','runtime/CEF/dotnet/dotnet.exe',
 'runtime/CEF/libcef.dll','runtime/CEF/CefSharp.BrowserSubprocess.exe',
 'runtime/CEF/ks-smoke-pass.json','runtime/Electron/ks-smoke-pass.json',
]
for rel in required:
 p=root/rel
 if not p.is_file() or p.stat().st_size==0: raise SystemExit(f'Missing/empty build dependency: {rel}')
with ZipFile(zipfile,'w',ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
 for rel in ['KS-Client.exe','Uninstall-KS-Client.exe','README_EN.md','LICENSE']:
  z.write(root/rel,rel)
 for name in ['Electron','CEF']:
  for file in sorted((root/'runtime'/name).rglob('*')):
   if file.is_file(): z.write(file,file.relative_to(root).as_posix())
with ZipFile(zipfile) as z:
 bad=z.testzip()
 if bad: raise SystemExit(f'ZIP CRC failure: {bad}')
 for rel in required:
  if rel not in z.namelist(): raise SystemExit(f'Missing from ZIP: {rel}')
(root/'installer'/zipname).write_bytes(zipfile.read_bytes())
print('Offline portable candidate:',zipfile,'bytes:',zipfile.stat().st_size)
print('SHA256:',hashlib.sha256(zipfile.read_bytes()).hexdigest())
