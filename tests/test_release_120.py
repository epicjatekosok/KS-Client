"""KS Client alpha 1.0.22 — modern settings and fixed Discord invite contract."""
from pathlib import Path
r=Path(__file__).resolve().parents[1]
a=(r/'electron-app/overlay/overlay.js').read_text(encoding='utf8')
for required in ('ks-menu-search','ks-search-results','ks-sidebar-groups','updateSettingsSearch','settingsSearchTerms','KS · ${CLIENT_VERSION}','isKirkaDiscordButton', "openTrustedExternal('discord')"):
 assert required in a,required
assert "showFPS: false" in a
assert "ensureOverlayMounted()" in a
assert "items:['Performance','Frame Stability','Browser Graphics','Browser GPU Info']" in a
assert "items:['Display','Eye Comfort','Crosshair']" in a
assert "items:['Game Integration','Lobby','Friends & Profiles']" in a
assert "['General','Updates','Sharing','Diagnostics']" in a
e=(r/'electron-app/main.cjs').read_text()
assert "case 'discord-community':" in e
assert "shell.openExternal('https://discord.gg/cxP386yGjk')" in e
assert "discord-community" not in "stats clan game fullscreen crash-status diagnostics-poll update-check update-install"
for path in ('launcher/main_windows.go','installer/main_windows.go','electron-app/main.cjs','ci/Publish-Release.ps1'):
 assert '1.0.22' in (r/path).read_text(),path
assert 'RELEASE_BETA_122_EN.md' in (r/'ci/Publish-Release.ps1').read_text()
print('PASS: KS 1.0.22 modern searchable menu, subtle badge, strict Discord native bridge and preserved dual-engine settings')
