"""Beta 1.0.1: offline Chromium regression for custom colors on BOTH overlays."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
a=(root/'electron-app/overlay/overlay.js').read_text(encoding='utf-8')
b=(root/'cef/overlay/overlay.js').read_text(encoding='utf-8')
assert a==b, 'CEF and Electron must ship identical theme/settings behavior'

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for engine in ('Electron','CEF'):
        page=browser.new_page(viewport={'width':1400,'height':850})
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_content('<html><body><main>Kirka test page</main></body></html>')
        page.evaluate("""() => {
          window.__KS_TEST_LOCATION__={hostname:'kirka.io',protocol:'https:',pathname:'/',href:'https://kirka.io/'};
          window.__messages=[];
          window.__KS_NATIVE__={post:message=>window.__messages.push(message)};
          const data=new Map();
          window.__saved=data;
          Object.defineProperty(window,'localStorage',{configurable:true,value:{
            getItem:key=>data.get(key)||null,
            setItem:(key,value)=>data.set(key,value),
            removeItem:key=>data.delete(key)
          }});
        }""")
        js=(a if engine=='Electron' else b).replace(
            "  'use strict';","  'use strict'; const location=window.__KS_TEST_LOCATION__;",1)
        page.add_script_tag(content=js)
        page.wait_for_function('!!window.__KS_CLIENT__')
        page.evaluate('window.__KS_CLIENT__.open()')
        page.evaluate("""() => {
          const root=document.querySelector('#ks-client-root').shadowRoot;
          root.querySelector('[data-group="Interface"]').click();
          root.querySelector('[data-tab="Appearance"]').click();
          const setColor=(key,value)=>{
            const el=root.querySelector('[data-setting="'+key+'"]');
            if(!el)throw new Error('Missing color picker '+key);
            el.value=value;
            el.dispatchEvent(new Event('input',{bubbles:true}));
            el.dispatchEvent(new Event('change',{bubbles:true}));
          };
          setColor('customAccent','#2277cc');
          setColor('customBackground','#112233');
          setColor('customPanel','#223344');
          setColor('customText','#e6edf5');
          setColor('customMuted','#aabbcc');
          const font=root.querySelector('[data-setting="fontFamily"]');
          font.value='Verdana';
          font.dispatchEvent(new Event('change',{bubbles:true}));
          const size=root.querySelector('[data-setting="fontSize"]');
          size.value='150';
          size.dispatchEvent(new Event('input',{bubbles:true}));
          size.dispatchEvent(new Event('change',{bubbles:true}));
        }""")
        # Color borders transition for 180ms; inspect the settled CSS, not
        # the first animation frame after choosing the new palette.
        page.wait_for_function("""() => {
          const root=document.querySelector('#ks-client-root').shadowRoot;
          const color='rgb(34, 119, 204)';
          return getComputedStyle(root.querySelector('#ks-gear')).borderColor===color &&
            getComputedStyle(root.querySelector('#ks-close')).borderColor===color;
        }""",timeout=4000)
        result=page.evaluate("""() => {
          const root=document.querySelector('#ks-client-root').shadowRoot;
          const rgb=el=>getComputedStyle(root.querySelector(el));
          return {
            gearInline:root.querySelector('#ks-gear').getAttribute('style'),
            closeInline:root.querySelector('#ks-close').getAttribute('style'),
            cssOverrides:root.getElementById('ks-theme-overrides')?.textContent.length||0,
            accent:rgb('#ks-gear').borderColor,
            close:rgb('#ks-close').borderColor,
            fps:rgb('#ks-fps').borderColor,
            background:rgb('#ks-panel').backgroundColor,
            panel:rgb('.ks-card').backgroundColor,
            label:rgb('.ks-label').color,
            muted:rgb('.ks-desc').color,
            font:rgb('.ks-label').fontFamily,
            fontSize:parseFloat(rgb('.ks-label').fontSize),
            preset:root.querySelector('[data-setting="themePreset"]').value,
            saved:JSON.parse(window.__saved.get('ksclient.settings.alpha'))
          };
        }""")
        assert result['preset']=='Custom',result
        for k in ('accent','close'):
            assert result[k]=='rgb(34, 119, 204)',result
        assert result['background']=='rgb(17, 34, 51)',result
        assert result['panel']=='rgb(34, 51, 68)',result
        assert result['label']=='rgb(230, 237, 245)',result
        assert result['muted']=='rgb(170, 187, 204)',result
        assert 'Verdana' in result['font'],result
        assert result['fontSize']>=17,result
        for key,value in [('customAccent','#2277cc'),('customBackground','#112233'),
                          ('customPanel','#223344'),('customText','#e6edf5'),
                          ('customMuted','#aabbcc'),('fontFamily','Verdana')]:
            assert result['saved'][key]==value,(engine,key,result)
        # Apply saves, rather than reverting the editor's preview on close.
        page.evaluate("""() => document.querySelector('#ks-client-root').shadowRoot.querySelector('#ks-apply').click()""")
        assert not errors,(engine,errors)
        page.close()
        print('PASS: Beta 1.0.1 interactive theme colors, typography, persistence',engine)
    browser.close()
