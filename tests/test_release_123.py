"""KS alpha 1.0.16 release regression: Discord IPC scope, visual controls and honest updater."""
from pathlib import Path
r=Path(__file__).resolve().parents[1]
e=(r/'electron-app/main.cjs').read_text()
ui=(r/'electron-app/overlay/overlay.js').read_text()
cef=(r/'cef/overlay/overlay.js').read_text()
up=(r/'launcher/update_windows.go').read_text()
pub=(r/'ci/Publish-Release.ps1').read_text()
assert ui==cef
assert e.index('function openKSDiscord(){') < e.index('function createWindow(){') < e.index('function receiveMessage(')
assert e.count('function openKSDiscord(){')==1
assert "case 'discord-community':openKSDiscord();break;" in e
assert "ipcMain.on('ks:message',(event,raw)=>{" in e
assert "Promise.resolve(shell.openExternal('https://discord.gg/cxP386yGjk'))" in e
assert "if(u.hostname==='discord.gg')" not in e, 'Do not treat arbitrary game popup URLs as KS community'
assert "['discord.gg','discord.com','www.discord.com','discordapp.com'].includes(u.hostname)" not in e, 'Do not hijack Discord OAuth as a community invite'
assert '<button type="button" id="ks-discord-quick" class="ks-quick-btn"' in ui
assert ui.index('id="ks-quick"')<ui.index('id="ks-gear"')<ui.index('id="ks-discord-quick"')
assert '#ks-quick #ks-gear,#ks-quick #ks-discord-quick' in ui
for key in ('ks123-panel-in','ks123-content-in','ks123-pop-in','ks123-glow-in','@media(prefers-reduced-motion:reduce)','#ks-screen.no-motion'):
 assert key in ui,key
assert "Automatic downloads require" not in ui[ui.index("case 'Updates':"):ui.index("case 'General':")]
assert 'Public binary release feed' in ui and 'public KS-Client-Updates repository now contains verified ZIP and EXE releases' in ui
assert "The public KS-Client-Updates release feed was not found" in up or "GitHub update lookup" in up
assert 'epicjatekosok/KS-Client-Updates' in up
assert 'if response.StatusCode==404' in up
assert 'digestPattern' in up and 'validUpdateAsset' in up
assert 'KS_PUBLIC_RELEASE_TOKEN' in pub
assert 'RELEASE_BETA_116_EN.md' in pub and "v1.0.16-beta" in pub
assert 'PUBLIC_UPDATES_SETUP_HU.md' in (r/'START_HERE_HU.md').read_text()
print('PASS: 1.0.16 scope-safe native Discord, consistent controls, accessible animations and honest updater')
