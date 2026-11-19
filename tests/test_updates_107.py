"""KS Client Beta 1.0.12 native-first, regression-safe dual-engine updater."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
electron=(root/'electron-app/main.cjs').read_text(encoding='utf-8')
cef=(root/'cef/ClientForm.cs').read_text(encoding='utf-8')
overlay=(root/'electron-app/overlay/overlay.js').read_text(encoding='utf-8')
assert overlay==(root/'cef/overlay/overlay.js').read_text(encoding='utf-8')
loader=(root/'electron-app/assets/loading.html').read_text(encoding='utf-8')
cef_loader=(root/'cef/KSLoadingPanel.cs').read_text(encoding='utf-8')
native=(root/'launcher/update_windows.go').read_text(encoding='utf-8')
publish=(root/'ci/Publish-Release.ps1').read_text(encoding='utf-8')
tests=(root/'launcher/update_windows_test.go').read_text(encoding='utf-8')
assert "const version = \"1.0.12\"" in (root/'launcher/main_windows.go').read_text()
assert '"version": "1.0.12-beta"' in (root/'electron-app/package.json').read_text()
assert 'BETA 1.0.12' in loader and 'BETA 1.0.12' in cef_loader
assert '1.0.12' in (root/'cef/Program.cs').read_text()
assert '<Version>1.0.12</Version>' in (root/'cef/KS.Cef.Client.csproj').read_text()
smoke=(root/'ci/Test-Engines.ps1').read_text()
assert "$releaseVersion = '1.0.12'" in smoke and 'cef-1.0.12.log' in smoke
assert 'Application.Run(smokeContext)' in (root/'cef/Program.cs').read_text(), 'Real CEF startup must use a native WinForms message pump'
assert 'KS · 1.0.12' in overlay and "v:'Beta 1.0.12'" in overlay and "v:'Beta 1.0.9'" in overlay
assert "v:'Beta 1.0.6'" in overlay, 'All older release history must remain'
assert 'ks-workshop-experimental' in overlay and 'auth-import-session' in overlay
# Both native hosts check as soon as a real game window opens, before waiting for Kirka.io.
assert 'if(nativeUpdatePreferences.automatic)' in electron
assert 'checkKSUpdate(nativeUpdatePreferences.channel,true,nativeUpdatePreferences.autoDownload)' in electron
assert electron.index('if(nativeUpdatePreferences.automatic)')<electron.index('navigate(GAME);')
assert 'if(!switchProbe && nativeUpdaterPrefs.Automatic)' in cef
assert 'CheckKSUpdate(nativeUpdaterPrefs.Channel,true,nativeUpdaterPrefs.AutoDownload)' in cef
assert 'startSplash();' in electron and 'CHECKING UPDATES' in cef and 'CHECKING UPDATES' in electron
assert 'startup-update-status' in loader and 'startup-update-status' in electron
# The existing localStorage settings are synchronized but not replaced. No account token crosses native IPC.
assert "notify('update-config',prefs)" in overlay
assert "case 'update-config'" in electron and 'case "update-config"' in cef
assert 'updater-preferences.json' in electron and 'updater-preferences.json' in cef
assert 'lastNativeUpdateStatus' in electron and 'lastNativeUpdateStatus' in cef
assert 'nativeUpdatePreferences.autoDownload' in electron and 'nativeUpdaterPrefs.AutoDownload' in cef
assert 'ks-update-notice' in overlay and 'pointer-events:none' in overlay
# Preserve manual checks and signed-hash pinning: no silent install and no untrusted update URLs.
assert 'data-action="update-check"' in overlay and 'data-action="update-install"' in overlay
assert 'validUpdateAsset' in native and 'sha256.New()' in native
assert 'https://api.github.com/repos/' in native and 'digestPattern' in native
assert 'CheckRedirect' in native and 'waitForExitedPID' in native
assert 'v1.0.13-beta' in tests and 'v1.0.13-beta' in tests
assert 'v1.0.13-beta' in publish and 'RELEASE_BETA_112_EN.md' in publish
assert 'gh release create $tag @publicPaths --repo $publicRepo' in publish
assert 'gh release create $tag @paths --repo $publicRepo' not in publish
print('PASS Beta 1.0.12 native startup lookup, optional prefetch, settings, dual-engine UI, manual/verified updates')
