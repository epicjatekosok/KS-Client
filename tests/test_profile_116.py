"""Exercise the profile transfer via Settings on an offline Kirka-shaped page."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

scripts=Path(__file__).resolve().parents[1]/'electron-app'/'overlay'
with sync_playwright() as pw:
    browser=pw.chromium.launch(args=['--no-sandbox'])
    page=browser.new_page()
    page.route('https://kirka.io/**',lambda route:route.fulfill(body='<html><body><main></main></body></html>',content_type='text/html'))
    page.goto('https://kirka.io/')
    for name in ['frame_pacer.js','workshop.js','overlay.js']:
        page.add_script_tag(content=(scripts/name).read_text())
    page.on('dialog',lambda dialog:dialog.accept())
    page.evaluate('window.__KS_CLIENT__.open()')
    page.locator('[data-group="Advanced"]').click()
    page.locator('[data-tab="Sharing"].ks-subtab').click()
    with page.expect_download() as d:
        page.locator('[data-action="export-profile"]').click()
    doc=json.loads(d.value.path().read_text())
    assert doc['format']=='ksclient-profile' and set(doc['media'])=={'menuSound','menuBackground','uiImage','localFont'}
    doc['settings']['fpsLimit']=173
    doc['workshop']['friends']=[{'nick':'Test','note':'Fixture'}]
    doc['media']['menuSound']={'type':'audio/wav','name':'fixture.wav','data':'UklGRg=='}
    def upload():
        page.locator('#ks-profile-file').set_input_files({'name':'restore.json','mimeType':'application/json','buffer':json.dumps(doc).encode()})
    upload()
    page.wait_for_function("window.__KS_FRAME_PACER__.getStats().target===173")
    assert page.evaluate("window.__KS_WORKSHOP__.getConfig().friends[0].note")=='Fixture'
    with page.expect_download() as d:
        page.locator('[data-action="export-profile"]').click()
    assert json.loads(d.value.path().read_text())['media']==doc['media']
    doc['settings']['fpsLimit']=211
    doc['media']['menuSound']['type']='text/html'
    upload()
    page.wait_for_function("document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-sharing-status').textContent.includes('Invalid media')")
    assert page.evaluate("window.__KS_FRAME_PACER__.getStats().target")==173
    browser.close()
