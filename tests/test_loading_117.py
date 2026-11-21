"""Test the Electron loading screen and its packaged logo."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
file=root/'electron-app/assets/loading.html'
assert file.is_file()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page()
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(file.resolve().as_uri())
 assert page.locator('.logo').count()==1
 assert page.locator('.logo').evaluate('(img)=> img.complete && img.naturalWidth>0')
 assert 'KS CLIENT' in page.locator('.title').inner_text()
 assert page.locator('.track .moving').count()==1
 assert '1.0.23' in page.locator('.version').inner_text()
 assert page.evaluate("getComputedStyle(document.querySelector('.moving')).animationName")=='load'
 assert not errors,errors

 browser.close()
print('PASS: Electron animated loading screen')
