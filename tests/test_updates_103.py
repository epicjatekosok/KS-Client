"""Beta 1.0.7: timeout and release-verification regression (source/offline)."""
from pathlib import Path
import re

root=Path(__file__).resolve().parents[1]
electron=(root/'electron-app/main.cjs').read_text(encoding='utf8')
native=(root/'launcher/update_windows.go').read_text(encoding='utf8')
tests=(root/'launcher/update_windows_test.go').read_text(encoding='utf8')
publish=(root/'ci/Publish-Release.ps1').read_text(encoding='utf8')

assert "timeout:lookup?48000:20000" in electron, 'Automatic check deadline must outlive GitHub retry'
assert "lookup=args.includes('--ks-update-check')" in electron
assert "error.code==='ETIMEDOUT'" in electron
assert "GitHub update lookup took too long" in electron
assert "Timeout:18*time.Second" in native
for overlay in ('electron-app/overlay/overlay.js',):
 assert '},55000);' in (root/overlay).read_text(encoding='utf8'), 'UI must outlive a bounded native retry'
assert "releases?per_page=20" in native, 'Do not fetch huge release history for one check'
assert "time.Sleep(350*time.Millisecond)" in native
assert "io.LimitReader(response.Body,3*1024*1024)" in native
assert "errors.As(err,&networkError)" in native
assert "response.StatusCode==403||response.StatusCode==429" in native
for safety in ['validUpdateAsset','digestPattern','expectedURL','https://github.com/',
               'sha256.New()','updateMaxBytes','compareVersion(v,current)<=0',
               'CheckRedirect']:
 assert safety in native, safety
assert 'v1.0.31-beta' in tests and 'v1.0.31-beta' in tests
assert "v1.0.31-beta" in publish and "RELEASE_BETA_131_EN.md" in publish
assert "epicjatekosok/KS-Client-Updates" in native
print('PASS: Beta 1.0.7 bounded retry, longer UI deadline, exact SHA-256-pinned release selection')
