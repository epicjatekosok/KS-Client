"""User-facing Workshop and profile compatibility in an isolated Chromium game fixture."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = Path(__file__).resolve().parents[1] / 'electron-app/overlay'
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page()
    page.route('https://kirka.io/**', lambda r: r.fulfill(body='<div class="interface"><div class="profile-cont"><b class="nickname">Player</b></div></div>', content_type='text/html'))
    page.goto('https://kirka.io/')
    for name in ['game_runtime', 'analytics', 'overlay', 'workshop']:
        page.add_script_tag(content=(base / (name + '.js')).read_text())
    page.evaluate('window.__KS_CLIENT__.open()')
    def tab(group, name):
        page.locator(f'.ks-tab[data-group="{group}"]').click()
        page.locator(f'.ks-subtab[data-tab="{name}"]').click()
    tab('Workshop','KS Analytics')
    expect(page.locator('#ks-body')).to_contain_text('Observed match results')
    tab('Workshop','Weapon Studio')
    page.locator('#ks-wk-pose-name').fill('Local test weapon')
    page.locator('#ks-wk-pose-ry').fill('25')
    expect(page.locator('#ks-pose-preview')).to_have_attribute('style',__import__('re').compile('rotateY\\(25deg\\)'))
    page.locator('[data-action="wk-pose-save"]').click()
    assert page.evaluate('window.__KS_WORKSHOP__.getConfig().poses[0].ry') == 25
    tab('Gameplay','Friends & Profiles')
    page.locator('#ks-wk-look-badge').select_option('KS ◆')
    page.locator('[data-action="wk-look-apply"]').click()
    assert 'KS ◆' in page.locator('.nickname').evaluate("n=>getComputedStyle(n,'::after').content")
    page.locator('[data-action="wk-look-reset"]').click()
    assert 'KS ◆' not in page.locator('.nickname').evaluate("n=>getComputedStyle(n,'::after').content")
    tab('Gameplay','Game Integration')
    page.locator('[data-bind="FPS"]').click()
    page.keyboard.press('Control+Shift+K')
    expect(page.locator('[data-bind="FPS"]')).to_have_text('Ctrl+Shift+KeyK')
    page.locator('[data-bind="Keystrokes"]').click()
    page.keyboard.press('Control+Shift+K')
    expect(page.locator('#ks-bind-status')).to_contain_text('conflicting')
    page.keyboard.press('Escape')
    page.evaluate('window.__KS_CLIENT__.close()')
    page.keyboard.press('Control+Shift+K')
    assert page.evaluate("JSON.parse(localStorage.getItem('ksclient.settings.alpha')).showFPS")
    tab_open = page.evaluate('window.__KS_CLIENT__.isSettingsOpen()')
    assert not tab_open
    js="""() => {
      const wk=window.__KS_WORKSHOP__;
      const manifest={kind:'css',api:2,name:'Tint',code:'.profile .nickname{color:#aabbcc}',version:'1.0.0',author:'KS'};
      const cfg=wk.normalizeWorkshop({plugins:[manifest,{...manifest,code:'body{display:none}'},{...manifest,permissions:['filesystem']}]});
      return cfg.plugins.map(p=>[p.author,p.permissions]);
    }"""
    assert page.evaluate(js) == [['KS',['scoped-colors']]]
    browser.close()

# Exercise data-dependent views with public-shape fixtures and no credentials.
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page()
    page.route('https://kirka.io/**', lambda r: r.fulfill(body='<div class="interface"></div>', content_type='text/html'))
    page.goto('https://kirka.io/')
    page.evaluate("""() => {window.__KS_PUBLIC_STATS__={get:async kind=>({source:'Fixture',stamp:1,priceStamp:1,
        data:kind==='inventory'?[{name:'A',type:'Rifle',rarity:'L',average:15,amount:2},{name:'B',type:'Rifle',rarity:'C',average:null,amount:1}]:
        {name:'Tester',shortId:'ABC123',clan:'Example',rank:'Gold'}})}}""")
    for name in ['overlay','workshop','kirka_stats']:
        page.add_script_tag(content=(base/(name+'.js')).read_text())
    page.evaluate("window.__KS_KIRKA_STATS__.open('player','ABC123')")
    dialog=page.get_by_role('dialog')
    expect(dialog.locator('.rank')).to_contain_text('Gold')
    dialog.get_by_role('button',name='Inventory').click()
    expect(dialog.locator('tbody tr')).to_have_count(2)
    dialog.get_by_label('coverage').select_option('missing')
    expect(dialog.locator('tbody')).to_contain_text('B')
    expect(dialog.locator('tbody tr')).to_have_count(1)
    dialog.get_by_label('coverage').select_option('all')
    dialog.get_by_label('Minimum price').fill('10')
    expect(dialog.locator('tbody')).to_contain_text('A')
    expect(dialog.locator('tbody tr')).to_have_count(1)
    page.keyboard.press('Escape')
    page.evaluate('window.__KS_CLIENT__.open()')
    page.locator('.ks-tab[data-group="Interface"]').click()
    page.locator('.ks-subtab[data-tab="Appearance"]').click()
    page.get_by_text('Shared themes',exact=True).click()
    import json
    palette={'format':'ks-theme','api':1,'name':'Fixture','author':'Tester','version':'2','colors':dict.fromkeys(
        ['customAccent','customBackground','customPanel','customText','customMuted'],'#113355')}
    page.locator('#ks-theme-file').set_input_files({'name':'theme.json','mimeType':'application/json','buffer':json.dumps(palette).encode()})
    page.locator('[data-action="theme-import"]').click()
    page.wait_for_function("window.__KS_CLIENT__.galleryThemes().some(t=>t.name==='Fixture'&&t.author==='Tester')")
    assert page.evaluate("window.__KS_CLIENT__.galleryAction('shared','Fixture','Tester')")
    assert page.evaluate("JSON.parse(localStorage.getItem('ksclient.settings.alpha')).customAccent")== '#113355'
    browser.close()
