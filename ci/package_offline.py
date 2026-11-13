#!/usr/bin/env python3
"""Pack ONLY prebuilt, locally smoke-tested Windows runtimes (no builds on user PCs)."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
root=Path(__file__).resolve().parents[1]
version='1.1.6'
zipname=f'KS-Client-alpha-{version}-Portable.zip'
zipfile=root/zipname
required=[
 'KS-Client.exe','Uninstall-KS-Client.exe',
 'runtime/Electron/electron.exe','runtime/Electron/resources/app/main.cjs',
 'runtime/CEF/KS.Cef.Client.exe','runtime/CEF/dotnet/dotnet.exe',
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
