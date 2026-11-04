"""Chromium automation against production build. Not manual play, real-device or Safari evidence."""
import json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright,TimeoutError as PlaywrightTimeout
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'release/v2.3';OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('INHERITANCE_URL','http://127.0.0.1:4180/')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL,wait_until='networkidle');page.evaluate("localStorage.setItem('inheritance.autosave.v3','legacy-preservation-sentinel')")
 page.screenshot(path=str(OUT/'01-start.png'))
 page.get_by_role('button',name='새로운 미래 시작',exact=True).click();page.screenshot(path=str(OUT/'02-policy.png'))
 page.locator('.policy-choices button').nth(1).click();page.get_by_role('button',name='이 방향으로 결정',exact=True).click();page.screenshot(path=str(OUT/'03-assignment.png'))
 page.get_by_role('button',name='이 삶으로 들어가기',exact=True).click();page.get_by_role('button',name='생활 시작',exact=True).click()
 assert page.locator('canvas').count()==1
 def state():
  return page.evaluate("""async()=>{const db=await new Promise((res,rej)=>{const q=indexedDB.open('inheritance-future-v2',1);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});return await new Promise((res,rej)=>{const q=db.transaction('saves').objectStore('saves').get('current');q.onsuccess=()=>{db.close();res(q.result)};q.onerror=()=>rej(q.error)})}""")
 def wait_save():page.wait_for_timeout(100)
 def clear_replay():
  if page.get_by_role('button',name='現在 시점으로',exact=True).count():raise AssertionError('wrong locale')
  button=page.get_by_role('button',name='현재 시점으로',exact=True)
  if button.count():
   try:button.click(timeout=600)
   except PlaywrightTimeout:
    if button.count():raise
 def snap(name):page.screenshot(path=str(OUT/name))
 wait_save();initial=state();first=initial['playerId']
 page.get_by_role('button',name='시민 관찰',exact=True).click();page.locator('.citizens button').first.click();assert page.get_by_role('dialog').count()==1;assert page.locator('.actions').count()==0;assert state()['playerId']==first;page.get_by_role('button',name='창 닫기',exact=True).click()
 page.get_by_role('button',name='나의 삶',exact=True).click();page.get_by_role('button',name='학습',exact=True).click();assert page.get_by_role('button',name='학습',exact=True).get_attribute('aria-pressed')=='true';page.get_by_role('button',name='창 닫기',exact=True).click()
 page.get_by_role('button',name='한 달',exact=True).click();page.wait_for_timeout(700);clear_replay();wait_save();assert state()['day']==31;assert any(b['phase']=='construction' for b in state()['city']['buildings']);snap('04-construction.png')
 # IndexedDB and legacy slot coexist; reload resumes exactly the stored state.
 before=state();page.reload(wait_until='networkidle');page.get_by_role('button',name='이어서 살기',exact=False).click();wait_save();assert state()==before;assert page.evaluate("localStorage.getItem('inheritance.autosave.v3')")=='legacy-preservation-sentinel'
 # Deterministic malformed import rejection leaves autosave untouched.
 page.get_by_role('button',name='설정',exact=True).click();bad=json.loads(json.dumps(before));bad['global']={'foo':1,'bar':2,'baz':3};page.get_by_label('저장 파일 불러오기',exact=True).set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});page.get_by_role('status').filter(has_text='손상').wait_for();assert state()==before;page.get_by_role('status').filter(has_text='손상').click();page.get_by_role('button',name='창 닫기',exact=True).click()
 page.get_by_role('button',name='1년',exact=True).click();page.get_by_role('button',name='타임랩스 정지',exact=True).wait_for();page.get_by_role('button',name='타임랩스 정지',exact=True).click();date=page.locator('.date b').inner_text();page.wait_for_timeout(400);assert page.locator('.date b').inner_text()==date;assert page.locator('.player-card').count()==0;snap('05-timelapse.png');clear_replay()
 # Desktop/mobile UI and camera controls, no mocked viewport/device claims.
 if page.locator('.personal-choices button').count():page.locator('.personal-choices button').first.click()
 if page.locator('.policy-choices button').count():page.locator('.policy-choices button').nth(1).click();page.get_by_role('button',name='이 방향으로 결정',exact=True).click()
 for width,height,label in [(390,844,'portrait'),(844,390,'landscape')]:
  page.set_viewport_size({'width':width,'height':height});page.get_by_role('button',name='나의 삶',exact=True).click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.get_by_role('button',name='학습',exact=True).is_visible();snap('06-mobile-'+label+'.png');page.get_by_role('button',name='창 닫기',exact=True).click();page.get_by_role('button',name='국가·세계',exact=True).click();assert 'GLOBAL' in page.get_by_role('dialog').inner_text();snap('07-layers-'+label+'.png');page.get_by_role('button',name='창 닫기',exact=True).click()
 page.set_viewport_size({'width':1440,'height':900})
 # Entire remaining scenario via visible buttons; no state injection or direct simulation methods.
 started=time.perf_counter();iterations=0;milestones=[];completion_shot=False
 while iterations<300:
  iterations+=1
  clear_replay()
  dialog=page.get_by_role('dialog')
  if dialog.count():
   title=dialog.get_attribute('aria-label')
   if title=='2050 · 우리가 물려준 미래':break
   if page.locator('.policy-choices button').count():page.locator('.policy-choices button').nth(1).click();page.get_by_role('button',name='이 방향으로 결정',exact=True).click()
   elif page.locator('.personal-choices button').count():page.locator('.personal-choices button').first.click()
   elif page.get_by_role('button',name='다른 삶의 관점으로',exact=True).count():
    wait_save();milestones.append(state()['day']);snap('08-life-summary-'+str(len(milestones))+'.png');page.get_by_role('button',name='다른 삶의 관점으로',exact=True).click()
   elif page.get_by_role('button',name='이 삶으로 들어가기',exact=True).count():page.get_by_role('button',name='이 삶으로 들어가기',exact=True).click()
   else:raise AssertionError('Unexpected dialog '+str(title))
  else:
   wait_save();s=state()
   if not completion_shot and any(b['level'] for b in s['city']['buildings']):snap('09-completed-city.png');completion_shot=True
   page.get_by_role('button',name='다음 중요 사건 →',exact=True).click();page.locator('.busy').wait_for(state='hidden',timeout=30000)
 else:raise AssertionError('Did not reach 2050')
 wait_save();final=state();assert final['phase']=='ending';assert len(final['policies'])==10;assert final['perspectives']==[2034,2042];assert len(set(x['id'] for x in final['policies']))==10;assert len(final['city']['history'])>5;snap('10-ending.png')
 with page.expect_download() as downloaded:page.get_by_role('button',name='이 미래 기록 내려받기',exact=True).click()
 downloaded.value.save_as(str(OUT/'normal-play-2050.json'));assert json.loads((OUT/'normal-play-2050.json').read_text())==final
 page.get_by_role('button',name='또 다른 미래 시작',exact=True).click();page.get_by_role('button',name='새 미래 확정',exact=True).click();wait_save();fresh=state();assert fresh['day']==0 and fresh['city']['history']==[] and fresh['lives']==[]
 # Service-worker installation and offline reload on the production build.
 page.evaluate('async()=>{await navigator.serviceWorker.ready}');page.reload(wait_until='networkidle');page.wait_for_function('navigator.serviceWorker.controller!==null');context.set_offline(True);page.reload(wait_until='domcontentloaded');page.get_by_role('button',name='이어서 살기',exact=False).wait_for();assert page.locator('h1').inner_text().startswith('INHERITANCE');context.set_offline(False)
 assert not errors,errors
 result={'passed':True,'build':'2.3.0','checks':['first policy and existing-person assignment','NPC observation cannot command or switch','manual learning order','monthly construction','IndexedDB exact reload','legacy slot preserved','malformed global save rejected','timelapse pause and final-state separation','portrait and landscape drawers','normal 2026–2050 path','2034/2042 perspectives','10 unique national events','real construction/completion history','ending download exact','new-game isolation','offline reload'], 'scenario_seconds':round(time.perf_counter()-started,2),'ui_iterations':iterations,'policies':len(final['policies']),'life_records':len(final['lives']),'city_history':len(final['city']['history']),'browser':'Chromium software WebGL','real_phone':False,'safari':False,'manual_play':False,'js_errors':errors}
 (OUT/'browser-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));browser.close()
