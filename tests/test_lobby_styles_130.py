"""Exercise lobby slot replacement, Kirka Settings navigation and file imports."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json

root=Path(__file__).resolve().parents[1]/'electron-app/overlay'
toolbar="""<div class="settings-and-socicons"><a class="soc-group" href="https://discord.gg/kirka">
<svg class="soc-icon"></svg></a><button class="soc-group">CLIENT <span>DOWNLOAD</span></button>
<button class="settings" id="stock">Gear</button></div>"""
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    page=browser.new_page()
    page.route('https://kirka.io/**',lambda r:r.fulfill(body='<div class="interface">'+toolbar+'</div>',content_type='text/html'))
    page.goto('https://kirka.io/')
    page.evaluate("""() => {
      window.sent=[];window.stockCalls=0;window.__KS_NATIVE__={post:m=>sent.push(m)};
      document.querySelector('#stock').onclick=()=>{stockCalls++;document.body.insertAdjacentHTML('beforeend',
        '<div class="settings-holder"><div class="tab-header"><button>Graphics</button></div></div>');};
    }""")
    for file in ['game_runtime','overlay','lobby_controls']:
        page.add_script_tag(content=(root/(file+'.js')).read_text(encoding='utf8'))
    red=page.locator('.ks-community-control');green=page.locator('.ks-settings-control')
    expect(red).to_be_visible();expect(green).to_be_visible()
    expect(page.locator('.soc-group').first).to_be_hidden()
    red.focus();page.keyboard.press('Enter')
    assert page.evaluate("sent.filter(x=>x.type==='discord-community').length")==1
    assert page.url=='https://kirka.io/'
    green.click();assert page.evaluate('__KS_CLIENT__.isSettingsOpen()')
    page.locator('#ks-close').click()
    page.locator('#stock').click();expect(page.locator('.ks-settings-entry')).to_be_visible()
    page.locator('.ks-settings-entry').click();page.locator('.ks-tab[data-group="Interface"]').click()
    page.locator('.ks-subtab[data-tab="Appearance"]').click()
    css='/*'+('x'*16000)+'*/ body { --ks130-color: orange; }'
    page.locator('#ks-style-file').set_input_files({'name':'style.css','mimeType':'text/css','buffer':css.encode()})
    expect(page.locator('#ks-style-result')).to_contain_text('style.css')
    assert page.evaluate("getComputedStyle(document.body).getPropertyValue('--ks130-color').trim()")=='orange'
    page.locator('#ks-apply').click()
    page.evaluate("document.querySelector('.settings-and-socicons').outerHTML="+json.dumps(toolbar))
    expect(red).to_have_count(1);expect(green).to_be_visible()
    green.click()
    theme={'format':'ks-theme','api':1,'name':'Lobby Theme','author':'KS','colors':dict.fromkeys(
        ['customAccent','customBackground','customPanel','customText','customMuted'],'#aabbcc')}
    page.locator('#ks-style-drop').evaluate("""(el,theme)=>{
      const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(theme)],'look.json',{type:'application/json'}));
      el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    }""",theme)
    expect(page.locator('#ks-style-result')).to_contain_text('look.json')
    assert page.evaluate("__KS_CLIENT__.galleryThemes().some(t=>t.name==='Lobby Theme')")
    page.locator('#ks-style-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{}'})
    expect(page.locator('#ks-style-result')).to_contain_text('Incompatible')
    page.locator('#ks-cancel').click()
    assert not page.evaluate("__KS_CLIENT__.galleryThemes().some(t=>t.name==='Lobby Theme')")
    browser.close()
