"""KS alpha 1.0.18 menu/Discord/CEF frame race source contracts."""
from pathlib import Path
r=Path(__file__).resolve().parents[1]
a=(r/'electron-app/overlay/overlay.js').read_text()
assert a==(r/'cef/overlay/overlay.js').read_text()
for text in ('KS · ${CLIENT_VERSION}','ks-graphic-preset-grid','ks-foot-actions','restoreSettingsSnapshot()','groupIcon=key','setCommunityStatus','ks-discord-quick','ks-discord-menu'):
 assert text in a,text
for group in ('Graphics','Display','Gameplay','Workshop','Controls','Interface','Advanced'):
 assert "key:'"+group+"'" in a,group
assert a.count('data-action="performance-preset"')>=1
assert "gameHitmarker" not in a[a.index("case 'Game Integration':"):a.index("case 'Performance':")]
el=(r/'electron-app/main.cjs').read_text()
assert "shell.openExternal('https://discord.gg/cxP386yGjk')" in el
assert "win.webContents.setWindowOpenHandler(" not in el and "guardMainNavigation" not in el, 'Game uses native Electron window/navigation'
cef=(r/'cef/ClientForm.cs').read_text()
early=(r/'cef/EarlyIntegrationHandler.cs').read_text()
helper=(r/'cef/ClientCommunityLinks.cs').read_text()
assert 'browser.LifeSpanHandler =' not in cef, 'CEF uses native Chromium popups'
assert 'ClientCommunityLinks.IsDiscordTarget(request.Url)' in cef
assert 'var sourceUrl=e.Frame.Url;' in cef
assert 'Receive(msg, sourceUrl)' in cef
assert 'Receive(msg, e.Frame.Url)' not in cef
assert 'catch(ObjectDisposedException)' in cef and 'e.Frame.IsValid' in cef
assert 'frame.IsValid' in early and 'catch(ObjectDisposedException)' in early
assert 'OnBeforePopup(' not in helper and 'UseShellExecute=true' in helper
assert 'https://discord.gg/cxP386yGjk' in helper
for f in ('launcher/main_windows.go','installer/main_windows.go','cef/Program.cs','electron-app/main.cjs','ci/Publish-Release.ps1'):
 assert '1.0.18' in (r/f).read_text(),f
assert 'RELEASE_BETA_118_EN.md' in (r/'ci/Publish-Release.ps1').read_text()
print('PASS 1.0.18 dashboard, immutable native Discord invite, disposed CEF IFrame protection')
