from pathlib import Path
import os
from playwright.sync_api import sync_playwright, expect
source=Path(__file__).resolve().parents[1]/'electron-app/overlay/kirka_stats.js'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('KS_CHROMIUM') or None)
    page=browser.new_page()
    page.route('https://kirka.io/**',lambda r:r.fulfill(content_type='text/html',body="""
      <div class="clans"><div class="champions-list"><div class="lists"><div class="items"><div class="item">Alpha<div class="stats">123</div></div></div></div></div></div>
      <div class="trade-window"><div class="offer-item"><span class="oi-name">Ice</span></div></div>"""))
    page.goto('https://kirka.io/')
    page.evaluate("""()=>{window.reads=[];window.__KS_PUBLIC_STATS__={get:async(k,a)=>{
      reads.push([k,a]);const data={clan:{name:'Alpha',members:[{name:'Bravo',shortId:'ABC123',level:5}]},
      player:{name:'Bravo',shortId:'ABC123',kills:10,deaths:5},market:[{name:'Ice',type:'LAR',average:300,fate:350}]};
      return {source:'test',stamp:1,data:data[k]}}}}""")
    page.add_script_tag(path=str(source))
    dialog=page.get_by_role('dialog')
    page.locator('.champions-list .item').click()
    expect(dialog.get_by_role('heading',name='Alpha')).to_be_visible()
    dialog.get_by_role('button',name='Bravo').click()
    expect(dialog.get_by_role('heading',name='Bravo  #ABC123')).to_be_visible()
    page.keyboard.press('Escape')
    page.locator('.oi-name').hover()
    page.locator('[data-ks-public-action="item"]').click()
    dialog.get_by_role('button',name='Ice',exact=True).click()
    expect(dialog.locator('dd').get_by_text('350',exact=True)).to_be_visible()
    page.keyboard.press('Escape')
    assert page.url=='https://kirka.io/'
    assert ['clan','Alpha'] in page.evaluate('reads')
    browser.close()
