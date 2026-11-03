import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path(__file__).resolve().parents[1] / 'release';out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('INHERITANCE_URL','http://127.0.0.1:4180'),wait_until='networkidle')
 page.get_by_role('button',name='아라의 삶 시작',exact=True).click()
 page.locator('canvas').wait_for();page.wait_for_timeout(1000)
 page.screenshot(path=str(out/'desktop.png'))
 page.get_by_role('button',name='내 인물',exact=True).click()
 page.get_by_role('button',name='휴식',exact=True).click()
 assert '예약' in page.locator('.world-toast').inner_text()
 page.get_by_role('button',name='창 닫기',exact=True).click()
 page.get_by_role('button',name='시간 재생',exact=True).click();page.wait_for_timeout(1600)
 page.get_by_role('button',name='시간 일시정지',exact=True).click()
 assert '완료' in page.locator('.world-toast').inner_text()
 page.get_by_role('button',name='설정',exact=False).click()
 with page.expect_download() as dl:page.get_by_role('button',name='저장 파일 내려받기').click()
 snap=json.load(open(dl.value.path()));assert snap['version']==4
 # Approved legacy retirement migration, retaining world and original character.
 old=json.loads(json.dumps(snap));old['version']=2;old['player']['phase']='successor'
 old['player']['summary']={'retired':True,'humanId':'human-1','name':'아라','startedDay':0,'diedDay':old['world']['day'],'knowledge':[],'relationships':{}}
 old['timeline']['mode']='history';del old['world']['legacy'];del old['timeline']['requestUntil']
 def load(s):
  page.locator('input[type=file]').set_input_files({'name':'fixture.json','mimeType':'application/json','buffer':json.dumps(s).encode()})
  page.wait_for_timeout(250)
 load(old);assert '현재 플레이어' in page.locator('.identity').inner_text()
 assert '생활 · 일시정지' in page.locator('.clock-label').inner_text()
 # NPC observation and indirect request never transfer player identity.
 load(snap);page.get_by_role('button',name='창 닫기',exact=True).click()
 page.get_by_role('button',name='내 인물',exact=True).click()
 page.get_by_label('관찰할 인간').select_option('human-2')
 assert page.get_by_role('button',name='채집',exact=True).count()==0
 page.get_by_role('button',name='식량 나눔 부탁',exact=True).click()
 assert '아라' in page.locator('.identity').inner_text()
 page.get_by_role('button',name='창 닫기',exact=True).click()
 page.get_by_role('button',name='설정',exact=False).click()
 # Controlled RNG/world fixture exercises discovery and direct transmission through UI.
 tech=json.loads(json.dumps(snap));tech['randomState']=0
 tech['world']['humans'][0]['food']=10
 for h in tech['world']['humans']:
  h['traits']['curiosity']=100;h['traits']['sociability']=100;h['traits']['stability']=0
 load(tech);page.get_by_role('button',name='창 닫기',exact=True).click()
 page.get_by_role('button',name='내 인물',exact=True).click()
 page.get_by_role('button',name='실험: 식량 저장',exact=True).click()
 page.get_by_role('button',name='시간 재생',exact=True).click();page.wait_for_timeout(1150)
 page.get_by_role('button',name='시간 일시정지',exact=True).click()
 assert page.get_by_role('button',name='전파: 식량 저장',exact=True).is_enabled()
 page.get_by_role('button',name='전파: 식량 저장',exact=True).click()
 page.get_by_role('button',name='시간 재생',exact=True).click();page.wait_for_timeout(1150)
 page.get_by_role('button',name='시간 일시정지',exact=True).click()
 assert '전승' in page.locator('.world-toast').inner_text()
 page.get_by_role('button',name='창 닫기',exact=True).click()
 page.get_by_role('button',name='설정',exact=False).click()
 # Natural old-age boundary with fixture imported through actual UI.
 snap['world']['humans'][0]['ageDays']=80*365-1;load(snap)
 page.get_by_role('button',name='창 닫기',exact=True).click();page.get_by_role('button',name='시간 재생',exact=True).click()
 page.get_by_role('dialog',name='생애 결산',exact=True).wait_for()
 assert '노령' in page.get_by_role('dialog',name='생애 결산',exact=True).inner_text()
 page.get_by_role('button',name='결산 확인 · 계승자 선택').click()
 assert page.get_by_role('button',name='아라의 삶 시작',exact=True).count()==0
 page.get_by_role('button',name='역사 모드로 관찰하기').click()
 assert page.get_by_role('dialog',name='삶 선택',exact=True).count()==0
 page.get_by_role('button',name='시간 재생',exact=True).click();page.wait_for_timeout(1400)
 if page.get_by_role('button',name='시간 일시정지',exact=True).count():page.get_by_role('button',name='시간 일시정지',exact=True).click()
 if page.get_by_role('button',name='사건 확인',exact=True).count():page.get_by_role('button',name='사건 확인',exact=True).click()
 page.get_by_role('button',name='다음 삶 선택',exact=True).click();page.get_by_role('button',name='누리의 삶 시작',exact=True).click()
 assert '생활 · 일시정지' in page.locator('.clock-label').inner_text()
 for width,height in [(390,844),(360,640),(844,390)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(200)
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  assert page.evaluate('document.documentElement.scrollHeight <= innerHeight')
  page.get_by_role('button',name='인물·행동',exact=False).click()
  assert page.get_by_role('dialog',name='인물과 행동',exact=True).get_attribute('aria-modal')=='true'
  page.screenshot(path=str(out/f'mobile-{width}.png'))
  page.get_by_role('button',name='창 닫기',exact=True).click()
  assert page.get_by_role('dialog',name='인물과 행동',exact=True).count()==0
 assert not errors,errors
 print('PASS desktop, mobile 390/360/844, NPC observation/request, discovery/transmission, command feedback, v2 migration, death, history, succession; no JS errors')
 b.close()
