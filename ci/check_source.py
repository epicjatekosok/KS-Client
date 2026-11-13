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
# Prevent regressions of the CEF Windows build failure: Desktop alone does not
# provide the expected local dotnet.exe host. The published apphost must prefer
# its own bundled runtime, including when launched without the Go launcher.
cef_build=(root/'ci/Build-CEF.ps1').read_text()
assert '-Runtime dotnet' in cef_build and '-Runtime windowsdesktop' in cef_build, 'CEF must bundle base and Desktop runtimes'
assert cef_build.index('-Runtime dotnet') < cef_build.index('-Runtime windowsdesktop'), 'Install the base runtime first'
assert '-p:AppHostDotNetSearch=AppRelative' in cef_build, 'CEF apphost must use an app-relative runtime'
assert '-p:AppHostRelativeDotNet=dotnet' in cef_build, 'CEF apphost must point at the bundled dotnet directory'
for required in ('dotnet.exe','Microsoft.NETCore.App','Microsoft.WindowsDesktop.App'):
 assert required in cef_build, f'CEF runtime completeness check missing: {required}'
print('PASS: shared overlay, basic menus, offline installer and CEF local runtime source checks')
