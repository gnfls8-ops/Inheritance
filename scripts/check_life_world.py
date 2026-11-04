"""Automated Chromium scenarios with imported fixtures; not manual play or real-phone evidence."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path(__file__).resolve().parents[1]/'release';out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('INHERITANCE_URL','http://127.0.0.1:4180'),wait_until='networkidle')
 initial=page.locator('.start-environment').inner_text();assert '시드' in initial
 page.get_by_role('button',name='나래의 삶 시작',exact=True).click();page.get_by_role('button',name='내 인물',exact=True).click();assert '유년기' in page.locator('.life-effects').inner_text()
 assert page.get_by_role('button',name='관찰하며 배우기',exact=True).is_visible()
 page.screenshot(path=str(out/'life-child.png'))
 page.get_by_role('button',name='창 닫기',exact=True).click();page.get_by_role('button',name='설정',exact=False).click()
 def save():
  with page.expect_download() as dl:page.get_by_role('button',name='저장 파일 내려받기',exact=True).click()
  return json.loads(Path(dl.value.path()).read_text())
 def load(s):
  page.locator('input[type=file]').set_input_files({'name':'fixture.json','mimeType':'application/json','buffer':json.dumps(s).encode()});page.wait_for_timeout(250)
 base=save();assert base['version']==5
 fixture=json.loads(json.dumps(base));fixture['player'].update(humanId='human-1',startedDay=0);fixture['world']['day']=44;fixture['timeline']['pending']=None;fixture['timeline']['events']=[];fixture['timeline']['last']={}
 h=fixture['world']['humans'][0];h['food']=100;h['control']='player';h['action']='rest';h['path']=[]
 load(fixture);page.get_by_role('button',name='창 닫기',exact=True).click();page.get_by_role('button',name='시간 재생',exact=True).click()
 page.get_by_role('button',name='혼자 이주 · 식량 2 사용',exact=True).wait_for();assert '일시정지' in page.locator('.clock-label').inner_text()
 page.screenshot(path=str(out/'life-crossroads.png'))
 page.get_by_role('button',name='혼자 이주 · 식량 2 사용',exact=True).click();page.get_by_role('button',name='설정',exact=False).click();moved=save();assert moved['world']['humans'][0]['life']['decision']=='migrate';assert moved['world']['humans'][0]['position']==h['position'];assert len(moved['world']['humans'][0]['path'])>0
 # Imported arrival state accelerates the 30-day follow-up; no claim of manual full-life play.
 h=moved['world']['humans'][0];h['position']=h['life']['destination'];h['life']['home']=h['position'];h['path']=[];h['action']='rest';h['control']='player';h['life']['arrivedDay']=45;moved['world']['day']=74
 load(moved);page.get_by_role('button',name='창 닫기',exact=True).click();page.get_by_role('button',name='시간 재생',exact=True).click();page.get_by_role('button',name='거처 남기기 · 식량 1 사용',exact=True).wait_for();page.get_by_role('button',name='거처 남기기 · 식량 1 사용',exact=True).click()
 page.get_by_role('button',name='설정',exact=False).click();settled=save();assert any(s['id']=='life-home-human-1' for s in settled['world']['landscape']['structures'])
 # Re-import restores the same terrain and decision; existing legacy v4 terrain is never regenerated.
 load(settled);assert save()['world']['map']==settled['world']['map']
 old=json.loads(json.dumps(base));old['version']=4
 for person in old['world']['humans']:del person['life']
 del old['world']['map']['biome'];load(old);assert save()['world']['map']==old['world']['map']
 # Replay known seed into the same generated biome, then use default random new world.
 page.get_by_label('같은 시드로 세계 재현').check();page.get_by_label('세계 시드',exact=True).fill('2654435761')
 page.get_by_role('button',name='새 세계 시작',exact=True).click();page.get_by_role('button',name='새 세계 시작 확정',exact=True).click();first=page.locator('.start-environment').inner_text();assert '2654435761' in first
 page.get_by_role('button',name='아라의 삶 시작',exact=True).click();page.get_by_role('button',name='설정',exact=False).click();page.get_by_role('button',name='새 세계 시작',exact=True).click();page.get_by_role('button',name='새 세계 시작 확정',exact=True).click();assert page.locator('.start-environment').inner_text()==first
 page.get_by_role('button',name='아라의 삶 시작',exact=True).click();page.screenshot(path=str(out/'seeded-world.png'))
 page.get_by_role('button',name='설정',exact=False).click();page.get_by_label('같은 시드로 세계 재현').uncheck();page.get_by_role('button',name='새 세계 시작',exact=True).click();page.get_by_role('button',name='새 세계 시작 확정',exact=True).click();assert page.locator('.start-environment').inner_text()!=first
 for seed,label in [(7,'굽이치는 강가'),(12,'깊은 숲 가장자리'),(1,'사막의 오아시스'),(4,'잊힌 야영지')]:
  page.get_by_role('button',name='아라의 삶 시작',exact=True).click();page.get_by_role('button',name='설정',exact=False).click();page.get_by_label('같은 시드로 세계 재현').check();page.get_by_label('세계 시드',exact=True).fill(str(seed));page.get_by_role('button',name='새 세계 시작',exact=True).click();page.get_by_role('button',name='새 세계 시작 확정',exact=True).click();assert label in page.locator('.start-environment').inner_text();page.get_by_role('button',name='아라의 삶 시작',exact=True).click();page.wait_for_timeout(400);page.screenshot(path=str(out/f'biome-{seed}.png'))
  page.get_by_role('button',name='설정',exact=False).click();page.get_by_role('button',name='새 세계 시작',exact=True).click();page.get_by_role('button',name='새 세계 시작 확정',exact=True).click()
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'life-start-mobile.png'));page.get_by_role('button',name='아라의 삶 시작',exact=True).click();page.get_by_role('button',name='인물·행동',exact=False).click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.get_by_role('button',name='관찰하며 배우기',exact=True).is_visible();page.screenshot(path=str(out/'life-panel-mobile.png'))
 assert not errors,errors;b.close()
 print(json.dumps({'passed':True,'checks':['child effects and observation','crossroads auto pause','migration remains actual queued travel','followup shelter','v5 roundtrip and v4 migration','same seed replay','random new world','four biome rendering','mobile drawer'],'fixture_acceleration':True,'real_phone':False,'manual_play':False,'js_errors':errors},ensure_ascii=False))
