#!/usr/bin/env python3
"""Package the already-built alpha 1.1.6 Windows EXEs, sources and installer payload.
The setup executable must be rebuilt after running this script since it embeds
installer/KS-Client-alpha-1.1.6-Portable.zip.
"""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from hashlib import sha256
root=Path(__file__).resolve().parents[1]
out=root.parent
version='1.1.6'
portable=out/f'KS-Client-alpha-{version}-Portable.zip'
source=out/f'KS-Client-alpha-{version}-Source.zip'
core=['KS-Client.exe','KS-Engine-Setup.exe','Uninstall-KS-Client.exe','Install-Engines.cmd','Install-Engines.ps1','README_EN.md','CHANGELOG_EN.md','BUILD-STATUS.md','Verify-Installed.ps1','LICENSE']
folders=['electron-app','cef']
with ZipFile(portable,'w',ZIP_DEFLATED,compresslevel=8) as z:
 for relative in core:
  f=root/relative; assert f.exists(),f;z.write(f,relative)
 for folder in folders:
  for f in (root/folder).rglob('*'):
   if f.is_file() and not any(x in f.parts for x in ('node_modules','bin','obj','runtime')):
    z.write(f,str(f.relative_to(root)))
embedded=root/'installer'/portable.name
embedded.write_bytes(portable.read_bytes())
with ZipFile(source,'w',ZIP_DEFLATED,compresslevel=8) as z:
 for folder in ['electron-app','cef','installer','uninstaller','launcher','engine-setup','ksui','tools','tests']:
  for f in (root/folder).rglob('*'):
   if f.is_file() and not any(x in f.parts for x in ('node_modules','bin','obj','runtime','__pycache__')) and f.suffix not in ('.zip','.exe','.pyc'):
    z.write(f,str(f.relative_to(root)))
 for name in ['Install-Engines.cmd','Install-Engines.ps1','Build-Windows.cmd','Build-Launcher.cmd','README_EN.md','CHANGELOG_EN.md','BUILD-STATUS.md','Verify-Installed.ps1','LICENSE']:
  z.write(root/name,name)
print('Portable:',portable,portable.stat().st_size)
print('Source:',source,source.stat().st_size)
print('Embedded installer payload:',embedded,embedded.stat().st_size)
