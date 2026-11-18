"""Beta 1.0.6: English release notes, fitting splash and dynamic setup version."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
loading=(root/'electron-app/assets/loading.html').read_text(encoding='utf-8')
main=(root/'electron-app/main.cjs').read_text(encoding='utf-8')
cef=(root/'cef/KSLoadingPanel.cs').read_text(encoding='utf-8')
setup=(root/'installer/main_windows.go').read_text(encoding='utf-8')
uninstall=(root/'uninstaller/main_windows.go').read_text(encoding='utf-8')
shared=(root/'ksui/ui_windows.go').read_text(encoding='utf-8')
publish=(root/'ci/Publish-Release.ps1').read_text(encoding='utf-8')
notes=(root/'RELEASE_BETA_105_EN.md').read_text(encoding='utf-8')
overlay=(root/'electron-app/overlay/overlay.js').read_text(encoding='utf-8')

assert "RELEASE_BETA_105_EN.md" in publish
assert "RELEASE_BETA_103_HU.md" not in publish
assert "v1.0.6-beta" in publish
assert "Account sign-in: security and recovery" in notes and "Google" in notes
assert "lang=\"en\"" in loading
assert "LOADING KS CLIENT" in loading
assert "KLIENS BETÖLTÉSE" not in loading and "Betöltés" not in loading
assert "title:'KS Client — Loading',width:490,height:390" in main
assert 'private string message = "LOADING KS CLIENT"' in cef
assert "statusBounds" in cef and 'BETA 1.0.6' in cef
assert "BETA 1.0.3" not in shared and "BETA 1.0.6" not in shared
assert 'strings.TrimSpace(w.Version)' in shared
assert 'w.Version=releaseLabel' in setup
assert 'bundledVersionFromArchive' in setup
assert 'runtime/Electron/resources/app/package.json' in setup
assert 'runtime/CEF/ks-smoke-pass.json' in setup
assert 'w.Version=installedReleaseLabel(folder)' in uninstall
assert 'r.en.map(item' in overlay
assert "state.language==='hu'?r.hu:r.en" not in overlay
assert "v:'Beta 1.0.6'" in overlay
assert overlay==(root/'cef/overlay/overlay.js').read_text(encoding='utf-8')
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':490,'height':390},device_scale_factor=1)
    page.goto((root/'electron-app/assets/loading.html').resolve().as_uri())
    assert page.title()=='KS Client • Loading'
    result=page.evaluate("""() => {
       const keys=['.shell','.card','.eyebrow','.logo-wrap','.title','.sub','.track','.detail','.helper','.version'];
       return keys.map(key=>{
         const box=document.querySelector(key).getBoundingClientRect();
         return {key,left:box.left,top:box.top,right:box.right,bottom:box.bottom}
       })
    }""")
    for box in result:
        assert box['left'] >= -0.5 and box['right'] <= 490.5,box
        assert box['top'] >= -0.5 and box['bottom'] <= 390.5,box
    assert not page.locator('.detail').is_hidden()
    assert page.locator('.detail').inner_text()=='LOADING KS CLIENT'
    browser.close()
print('PASS: Beta 1.0.6 English patch notes and GitHub body, unclipped English splash and dynamic installer version')
