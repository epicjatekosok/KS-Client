"""KS Client 1.1.21: validate native updater trust boundary and preserved common UI."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
ui=(root/'electron-app/overlay/overlay.js').read_text(encoding='utf8')
assert ui==(root/'cef/overlay/overlay.js').read_text(encoding='utf8')
assert "{key:'Client', icon:'⚙', items:['General','Updates','Sharing','Diagnostics']}" in ui
for field in ('autoCheckUpdates: true','autoDownloadUpdates: false',"updateChannel: 'alpha'",'data-action="update-check"','data-action="update-install"','setUpdateStatus: status =>'):
 assert field in ui,field
assert "showFPS: false" in ui, 'FPS must remain disabled on new profiles'
assert "ensureOverlayMounted()" in ui, 'Kirka SPA settings must remain persistent'
e=(root/'electron-app/main.cjs').read_text(encoding='utf8')
c=(root/'cef/ClientForm.cs').read_text(encoding='utf8')
for word in ('update-check','update-install','update-prefetch'):
 assert word in e,word
assert 'update-check' in c and 'update-install' in c and 'LaunchUpdateHelper' in c
assert 'dialog.showMessageBox' in e and 'MessageBox.Show(this' in c
launcher=(root/'launcher/main_windows.go').read_text(encoding='utf8')
up=(root/'launcher/update_windows.go').read_text(encoding='utf8')
assert 'handleUpdateCLI(os.Args[1:])' in launcher
assert 'epicjatekosok/KS-Client-Updates' in up and 'sha256.New()' in up
assert 'validUpdateAsset' in up and 'waitForExitedPID' in up
assert 'KS_PUBLIC_RELEASE_TOKEN' in (root/'ci/Publish-Release.ps1').read_text(encoding='utf8')
assert 'safeUpdateTarget' in (root/'installer/main_windows.go').read_text(encoding='utf8')
print('PASS: KS 1.1.21 updater bridge, dual-engine UI, strict public feed, no removed features')
