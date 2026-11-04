"""Explicit accelerated fixture, not a normal randomized playthrough. Exercises 2030 causal chain visually."""
import json,time
from pathlib import Path
from playwright.sync_api import sync_playwright,TimeoutError
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'release/v2.4';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4180/',wait_until='networkidle');page.get_by_role('button',name='새로운 미래 시작',exact=True).click();page.locator('.policy-choices button').first.click();page.get_by_role('button',name='이 방향으로 결정',exact=True).click();page.get_by_role('button',name='이 삶으로 들어가기',exact=True).click();page.get_by_role('button',name='생활 시작',exact=True).click()
 def state():
  page.wait_for_timeout(100)
  return page.evaluate("""async()=>{const db=await new Promise(r=>{const q=indexedDB.open('inheritance-future-v2');q.onsuccess=()=>r(q.result)});return await new Promise(r=>{const q=db.transaction('saves').objectStore('saves').get('current');q.onsuccess=()=>{db.close();r(q.result)}})}""")
 s=state();s.update(day=1461,pending='E02',phase='world-event',playerId='p2',observedId='p2',lastPersonalDay=1461)
 for h in s['population']:h['ageDays']=s['day']-h['birthDay']
 h=s['population'][2];h.update(job='office',previousJob='office',employed=True,retired=False,skill=100,aiSkill=90,birthDay=-12784,ageDays=1461+12784,health=95)
 s['nation']['metrics']['automation']=28
 s['assignment']={'day':1461,'assets':h['assets'],'happiness':h['happiness'],'world':s['nation']['metrics']}
 page.get_by_role('button',name='설정',exact=True).click();page.get_by_label('저장 파일 불러오기',exact=True).set_input_files({'name':'explicit-2030-fixture.json','mimeType':'application/json','buffer':json.dumps(s).encode()});page.get_by_role('dialog',name='노동 자동화의 확산').wait_for();page.locator('.policy-choices button').first.click();page.get_by_role('button',name='이 방향으로 결정',exact=True).click()
 page.get_by_role('status').click()
 page.get_by_role('button',name='한 달',exact=True).click();page.locator('.busy').wait_for(state='hidden');s=state();assert any(x['equipment']==1 for x in s['city']['buildings']);page.screenshot(path=str(OUT/'fixture-01-investment.png'))
 page.get_by_role('button',name='나의 삶',exact=True).click();page.get_by_role('button',name='학습',exact=True).click();page.get_by_role('button',name='창 닫기',exact=True).click();page.get_by_role('status').click();page.get_by_role('button',name='시간 재생',exact=True).click()
 activities=set();positions=set();bubbles=[]
 for _ in range(130):
  page.wait_for_timeout(100);canvas=page.locator('canvas');activities.add(canvas.get_attribute('data-activity'));positions.add(canvas.get_attribute('data-position'));bubbles.append(int(canvas.get_attribute('data-bubbles') or 0))
 page.get_by_role('button',name='시간 정지',exact=True).click();assert 'walking' in activities and 'learn' in activities,activities;assert len(positions)>5;assert max(bubbles)<=3 and max(bubbles)>0;page.screenshot(path=str(OUT/'fixture-02-human-routine.png'))
 def clear_replay():
  button=page.get_by_role('button',name='현재 시점으로',exact=True)
  if button.count():
   try:button.click(timeout=600)
   except TimeoutError:
    if button.count():raise
 seen_p13=False;seen_follow=False
 for _ in range(65):
  clear_replay();s=state()
  if s['day']>=2922:break # 2034; includes the four-year consequence.
  if s['phase']=='world-event':
   page.locator('.policy-choices button').nth(2 if s['pending']=='E03' else 1).click();page.get_by_role('button',name='이 방향으로 결정',exact=True).click()
  elif s['phase']=='personal-event':
   if s['pending']=='P13':
    seen_p13=True;h=next(h for h in s['population'] if h['id']=='p2');assert not h['employed'];assert h['itinerary'][1]['facility']=='job-board';assert h['speech']['policyId']=='E02';page.screenshot(path=str(OUT/'fixture-03-displacement-chain.png'))
   if s['pending']=='P14':seen_follow=True;page.screenshot(path=str(OUT/'fixture-04-retraining-followup.png'))
   page.locator('.personal-choices button').first.click()
  elif s['phase']=='life-summary':page.get_by_role('button',name='다른 삶의 관점으로',exact=True).click()
  elif s['phase']=='assignment':page.get_by_role('button',name='이 삶으로 들어가기',exact=True).click()
  else:page.get_by_role('button',name='다음 중요 사건 →',exact=True).click();page.locator('.busy').wait_for(state='hidden',timeout=30000)
 assert seen_p13 and seen_follow
 s=state();assert any(e['id']=='E02:returns' for e in s['impacts']);assert any(e['id']=='E02:adaptation' for e in s['impacts']);assert any(x['equipment']==2 for x in s['city']['buildings'])
 # Inspect policy cause ledger even if the calendar milestone is awaiting its decision.
 if page.get_by_role('button',name='다른 삶의 관점으로',exact=True).count():page.get_by_role('button',name='다른 삶의 관점으로',exact=True).click();page.get_by_role('button',name='이 삶으로 들어가기',exact=True).click()
 page.get_by_role('button',name='정책 결과',exact=True).click();page.get_by_label('원인 정책',exact=True).select_option('E02');text=page.get_by_role('dialog').inner_text();assert '3년 후' in text and '4년 후' in text and '고용 재편' in text;page.screenshot(path=str(OUT/'fixture-05-causal-ledger.png'));page.get_by_role('button',name='창 닫기',exact=True).click();page.get_by_role('button',name='도시 관찰',exact=True).click();page.wait_for_timeout(400);page.screenshot(path=str(OUT/'fixture-06-automated-city.png'))
 assert not errors,errors
 result={'passed':True,'fixture':'Explicit accelerated 2030 office-worker fixture; not random normal assignment','policy':'E02/0','checks':['investment equipment','moving and learning animation','limited speech bubbles','selected worker displacement','job-board route','P13 → P14 followup','3-year and 4-year effects','policy-ID ledger','automation city rendering'],'activities':sorted(activities),'distinct_positions':len(positions),'max_bubbles':max(bubbles),'js_errors':errors,'real_device':False}
 (OUT/'scenario-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
