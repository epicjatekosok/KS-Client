"""KS Client Beta 1.0.1 — visual parity, track-aware updater and public release safety."""
from pathlib import Path
r=Path(__file__).resolve().parents[1]
ui=(r/'electron-app/overlay/overlay.js').read_text(encoding='utf-8')
assert ui==(r/'cef/overlay/overlay.js').read_text(encoding='utf-8'), "Both engines must keep identical Beta UI"
extras=(r/'electron-app/overlay/game_extras.js').read_text(encoding='utf-8')
assert extras==(r/'cef/overlay/game_extras.js').read_text(encoding='utf-8')
for key in ('showFPS: false','autoCheckUpdates: true','autoDownloadUpdates: true',"updateChannel: 'beta'",
            'KS · 1.0.1', "v:'Beta 1.0.1'", "v:'Beta 1.0.0'",'ks-experimental-badge','ks-workshop-experimental',
            'EXPERIMENTAL · BETA',"data-action=\"update-check\"","data-action=\"update-install\""):
 assert key in ui,key
assert 'background:rgba(14,13,13,.92)!important' in ui
assert '#ks-fps,#ks-break-reminder,#ks-community-status' in ui
assert '#ks-panel #ks-close' in ui
assert "case 'Updates':" in ui and 'Beta (recommended)' in ui
assert 'KS-Client-Updates repository now contains verified ZIP and EXE releases' in ui
for key in ('#stats{','#keys{','.key.down{','border-radius:10px','rgba(255,157,24,.60)'):
 assert key in extras,key
electron=(r/'electron-app/main.cjs').read_text()
cef=(r/'cef/ClientForm.cs').read_text()
assert 'https://github.com/epicjatekosok/KS-Client-Updates/releases' in electron
assert 'https://github.com/epicjatekosok/KS-Client-Updates/releases' in cef
assert "['alpha','beta','stable'].includes(raw.channel)" in electron
assert 'm.Channel=="alpha"?"alpha":"beta"' in cef
go=(r/'launcher/update_windows.go').read_text()
for key in ('-alpha|-beta','trackPriority','releaseTrack','updateMode="beta"','channel=="beta"&&v.track=="alpha"','compareVersion(v,current)<=0'):
 assert key in go,key
assert 'sha256.New()' in go and 'validUpdateAsset' in go and 'waitForExitedPID' in go
assert 'const version = "1.0.1"' in (r/'launcher/main_windows.go').read_text()
assert 'const releaseTrack = "beta"' in (r/'launcher/main_windows.go').read_text()
installer=(r/'installer/main_windows.go').read_text()
assert '//go:embed KS-Client-beta-1.0.1-Portable.zip' in installer
assert 'Beta 1.0.1' in installer and '1.0.1' in (r/'cef/Program.cs').read_text()
pub=(r/'ci/Publish-Release.ps1').read_text()
for key in ('v1.0.1-beta','KS-Client-beta-1.0.1-Setup.exe','KS_PUBLIC_RELEASE_TOKEN',
            'v1.1.24-alpha','KS-Client-alpha-1.1.24-Setup.exe','ALPHA_TO_BETA_BRIDGE_HU.md',
            'PASS: Alpha 1.1.23 can discover'):
 assert key in pub,key
assert 'RELEASE_BETA_101_HU.md' in pub
assert "'release':'beta'" in (r/'ci/make_release_manifest.py').read_text().replace('"',"'")
print('PASS: KS Beta 1.0.1 styling, saved settings, verified beta updates and Alpha compatibility bridge')
