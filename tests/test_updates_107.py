"""KS Client Beta 1.0.24 native-first, regression-safe dual-engine updater."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
electron=(root/'electron-app/main.cjs').read_text(encoding='utf-8')
overlay=(root/'electron-app/overlay/overlay.js').read_text(encoding='utf-8')
loader=(root/'electron-app/assets/loading.html').read_text(encoding='utf-8')
native=(root/'launcher/update_windows.go').read_text(encoding='utf-8')
publish=(root/'ci/Publish-Release.ps1').read_text(encoding='utf-8')
tests=(root/'launcher/update_windows_test.go').read_text(encoding='utf-8')
assert "const version = \"1.0.24\"" in (root/'launcher/main_windows.go').read_text()
assert '"version": "1.0.24-beta"' in (root/'electron-app/package.json').read_text()
assert 'BETA 1.0.24' in loader
smoke=(root/'ci/Test-Engines.ps1').read_text()
assert "$releaseVersion = '1.0.24'" in smoke
assert 'KS · ${CLIENT_VERSION}' in overlay and "v:'Beta 1.0.24'" in overlay and "v:'Beta 1.0.9'" in overlay
assert "v:'Beta 1.0.6'" in overlay, 'All older release history must remain'
assert 'ks-workshop-experimental' in overlay and 'auth-import-session' in overlay
# Both native hosts check as soon as a real game window opens, before waiting for Kirka.io.
assert 'if(nativeUpdatePreferences.automatic)' in electron
assert 'checkKSUpdate(nativeUpdatePreferences.channel,true,nativeUpdatePreferences.autoDownload)' in electron
assert electron.index('if(nativeUpdatePreferences.automatic)')<electron.index('navigate(GAME);')
assert 'startSplash();' in electron and 'CHECKING UPDATES' in electron
assert 'startup-update-status' in loader and 'startup-update-status' in electron
# The existing localStorage settings are synchronized but not replaced. No account token crosses native IPC.
assert "notify('update-config',prefs)" in overlay
assert "case 'update-config'" in electron
assert 'updater-preferences.json' in electron
assert 'lastNativeUpdateStatus' in electron
assert 'nativeUpdatePreferences.autoDownload' in electron
assert 'ks-update-notice' in overlay and 'pointer-events:none' in overlay
# Preserve manual checks and signed-hash pinning: no silent install and no untrusted update URLs.
assert 'data-action="update-check"' in overlay and 'data-action="update-install"' in overlay
assert 'validUpdateAsset' in native and 'sha256.New()' in native
assert 'https://api.github.com/repos/' in native and 'digestPattern' in native
assert 'CheckRedirect' in native and 'waitForExitedPID' in native
assert 'v1.0.24-beta' in tests and 'v1.0.24-beta' in tests
assert 'v1.0.24-beta' in publish and 'RELEASE_BETA_124_EN.md' in publish
assert 'gh release create $tag @publicPaths --repo $publicRepo' in publish
assert 'gh release create $tag @paths --repo $publicRepo' not in publish
print('PASS Beta 1.0.24 native startup lookup, optional prefetch, settings, dual-engine UI, manual/verified updates')
