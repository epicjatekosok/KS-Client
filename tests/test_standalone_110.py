"""Beta 1.0.12 must be a complete, installable offline version, not a 1.0.9 patch."""
from pathlib import Path
import json
import re

root=Path(__file__).resolve().parents[1]
text=lambda f:(root/f).read_text(encoding='utf-8')
package=json.loads(text('electron-app/package.json'))
assert package['version']=='1.0.12-beta'

sign=text('ci/Sign-Release.ps1')
audit=text('ci/Verify-Signing.ps1')
for source in (sign,audit):
    assert "electron-app/package.json" in source, 'Signing must read actual packaged version'
    assert '$setupName="KS-Client-beta-$releaseNumber-Setup.exe"' in source
    assert "KS-Client-beta-1.0.9-Setup.exe" not in source, 'Old installer must not block standalone release'
    assert "^[0-9]+[.][0-9]+[.][0-9]+-beta$" in source
assert "'setup' { @(Join-Path $repo $setupName) }" in sign
assert "'runtime/CEF/KS.Cef.Client.exe',$setupName" in audit
assert 'Get-AuthenticodeSignature' in audit
assert 'Fully Authenticode-signed:' in audit
assert 'KS_SIGNING_PFX_BASE64' in audit

installer=text('installer/main_windows.go')
package_script=text('ci/package_offline.py')
verify=text('ci/verify_offline.py')
publish=text('ci/Publish-Release.ps1')
workflow=text('.github/workflows/windows-build.yml')

assert '//go:embed KS-Client-beta-1.0.12-Portable.zip' in installer
assert 'return installSelection{stable, false, false}' in installer, 'Fresh install must be possible'
assert 'Both prebuilt browser engines are INCLUDED. No build tools or download are needed during setup.' in installer
for file in ('runtime/Electron/electron.exe', 'runtime/CEF/KS.Cef.Client.exe',
             'runtime/CEF/dotnet/dotnet.exe', 'KS-Client.exe',
             'Uninstall-KS-Client.exe'):
    assert file in package_script and file in verify, f'Offline package missing {file}'
assert "verify_engine('Electron','electron.exe')" in package_script
assert "verify_engine('CEF','KS.Cef.Client.exe')" in package_script
assert 'package is missing' in installer

for filename in ('KS-Client-beta-1.0.12-Portable.zip','KS-Client-beta-1.0.12-Setup.exe'):
    assert filename in publish, filename
assert "$tag='v1.0.12-beta'" in publish
assert 'gh release create $tag @publicPaths --repo $publicRepo' in publish
assert "gh release create $tag @paths --repo $publicRepo" not in publish
assert "Public release contains forbidden source archive" in publish
assert 'SHA256SUMS.txt' in publish and 'RELEASE-MANIFEST.json' in publish

assert "go test -timeout 20m -v ." in workflow, 'Installer extraction tests required'
assert "python ci/verify_offline.py" in workflow
assert "./ci/Verify-Signing.ps1" in workflow
print('PASS: Beta 1.0.12 is self-contained; signing selects current release; earlier versions remain untouched')
