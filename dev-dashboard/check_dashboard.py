"""Browser tests for the actual dashboard data, including mobile and image enlargement."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('DASHBOARD_URL','http://127.0.0.1:4181'),wait_until='networkidle')
 assert page.get_by_role('heading',name='개발 기록실',exact=True).is_visible()
 assert page.locator('.round').count()>0
 page.get_by_role('button',name='문서 본문',exact=True).click()
 assert len(page.locator('.doc-body').inner_text())>100
 page.get_by_role('button',name='스크린샷',exact=True).click()
 if page.locator('.photo button').count():
  page.locator('.photo button').first.click();assert page.locator('#zoom').is_visible()
  page.keyboard.press('Escape');assert not page.locator('#zoom').is_visible()
 page.get_by_role('button',name='검증 근거',exact=True).click()
 assert '수동 플레이' in page.locator('#content').inner_text()
 page.get_by_role('button',name='회차 개요',exact=True).click()
 page.screenshot(path=str(root/'release/dashboard-desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.get_by_role('button',name='문서 본문',exact=True).click()
 assert page.locator('.doc-body').is_visible()
 page.screenshot(path=str(root/'release/dashboard-mobile.png'),full_page=True)
 page.get_by_label('회차 검색').fill('NO-SUCH-ROUND');assert page.locator('.round').count()==0
 page.get_by_label('회차 검색').fill('');assert page.locator('.round').count()>0
 # Text is rendered via textContent, not interpreted as HTML.
 assert page.evaluate("document.querySelectorAll('.doc-body script').length")==0
 assert not errors,errors
 print(json.dumps({'result':'passed','checks':['actual round data','document body','image modal and Escape','manual/automatic distinction','mobile layout','search'],'js_errors':errors},ensure_ascii=False))
 b.close()
