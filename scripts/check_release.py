"""Extended Chromium release checks. Requires the built site at INHERITANCE_URL."""
import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'release';out.mkdir(exist_ok=True)
url=os.environ.get('INHERITANCE_URL','http://127.0.0.1:4180')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("window.audioContexts=[];const AC=window.AudioContext;window.AudioContext=class extends AC {constructor(...args){super(...args);window.audioContexts.push(this);}};")
 page.goto(url,wait_until='networkidle');page.get_by_role('button',name='아라의 삶 시작',exact=True).click();page.locator('canvas').wait_for();assert '0.7.0' in page.locator('.build').inner_text()
 page.wait_for_timeout(2300)
 saved=page.evaluate("JSON.parse(localStorage.getItem('inheritance.autosave.v3'))")
 assert saved['player']['humanId']=='human-1'
 page.reload(wait_until='networkidle')
 assert page.get_by_role('dialog',name='삶 선택',exact=True).count()==0
 assert '아라' in page.locator('.identity').inner_text()
 assert page.get_by_role('button',name='시간 재생',exact=True).is_visible()
 page.get_by_role('button',name='설정',exact=False).click()
 page.get_by_role('button',name='자연·효과음 꺼짐',exact=True).click()
 assert page.evaluate("window.audioContexts[0].state")=='running'
 page.get_by_role('button',name='자연·효과음 켜짐',exact=True).click()
 assert page.evaluate("window.audioContexts[0].state")=='suspended'
 page.get_by_role('button',name='창 닫기',exact=True).click()
 # Browser-dispatched two-finger touch: a gesture must zoom without issuing a move order.
 cdp=context.new_cdp_session(page)
 box=page.locator('canvas').bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2
 before=page.locator('canvas').screenshot()
 for kind,spread in [('touchStart',35),('touchMove',40),('touchMove',65),('touchMove',95)]:
  cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':cx-spread,'y':cy,'id':1},{'x':cx+spread,'y':cy,'id':2}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(300)
 after=page.locator('canvas').screenshot();assert before!=after
 page.wait_for_timeout(2200)
 after_save=page.evaluate("JSON.parse(localStorage.getItem('inheritance.autosave.v3'))")
 assert after_save['commands']==saved['commands']
 # Measure real rendered frames on this CPU/SwiftShader environment, not claimed device FPS.
 page.get_by_role('button',name='시간 재생',exact=True).click()
 timing=page.evaluate("""() => new Promise(resolve => {const deltas=[];let last=performance.now(),start=last;function f(now){deltas.push(now-last);last=now;if(now-start<10000)requestAnimationFrame(f);else{deltas.sort((a,b)=>a-b);resolve({frames:deltas.length,seconds:(now-start)/1000,p95ms:deltas[Math.floor(deltas.length*.95)]});}}requestAnimationFrame(f);})""")
 page.get_by_role('button',name='시간 일시정지',exact=True).click()
 page.screenshot(path=str(out/'mobile-release.png'))
 # Recovery must fall back to previous valid save.
 page.evaluate("localStorage.setItem('inheritance.autosave.v3','broken')")
 page.reload(wait_until='networkidle');assert '아라' in page.locator('.identity').inner_text()
 assert page.get_by_role('button',name='시간 재생',exact=True).is_visible()
 # 300 years at the actual browser clock speed, using an explicitly deceased fixture.
 history=saved;history['player']['phase']='successor';history['player']['summary']={'humanId':'human-1','name':'아라','startedDay':0,'diedDay':0,'knowledge':[],'relationships':{}}
 h=history['world']['humans'][0];h.update(alive=False,health=0,deathDay=0,deathCause='건강 악화')
 history['timeline']['mode']='history';history['timeline']['deaths']=1
 for h in history['world']['humans'][1:9]:h['knowledge']=['fire','storage'];h['learnedAt']={'fire':0,'storage':0}
 page.get_by_role('button',name='설정',exact=False).click()
 page.locator('input[type=file]').set_input_files({'name':'history.json','mimeType':'application/json','buffer':json.dumps(history).encode()})
 page.wait_for_timeout(300);page.get_by_role('button',name='창 닫기',exact=True).click()
 page.get_by_role('button',name='4×',exact=True).click();page.get_by_role('button',name='시간 재생',exact=True).click()
 started=time.monotonic();last=-1
 while True:
  day=int(''.join(c for c in page.locator('.timebar strong').inner_text() if c.isdigit()))-1
  if day>=300*365:break
  if time.monotonic()-started>180:raise AssertionError('300-year browser run exceeded 180 seconds')
  if page.get_by_role('button',name='사건 확인',exact=True).count():
   page.get_by_role('button',name='사건 확인',exact=True).click();page.get_by_role('button',name='시간 재생',exact=True).click()
  year=day//365
  if year//50!=last:last=year//50;print('Browser history:',year,'years',flush=True)
  page.wait_for_timeout(500)
 page.get_by_role('button',name='시간 일시정지',exact=True).click();page.wait_for_timeout(2200)
 result=page.evaluate("JSON.parse(localStorage.getItem('inheritance.autosave.v3'))")
 assert result['world']['day']>=109500
 assert result['world']['technologies']['fire']['holders']>0
 assert result['world']['legacy']['transmissions']
 page.reload(wait_until='networkidle');assert page.get_by_role('button',name='시간 재생',exact=True).is_visible()
 assert int(''.join(c for c in page.locator('.timebar strong').inner_text() if c.isdigit()))-1==result['world']['day']
 assert result['timeline']['births']>12 and result['timeline']['deaths']>12
 assert not errors,errors
 report={'mobileEmulation':'390x844 DPR 2 Chromium / SwiftShader','renderTiming':timing,'historyDays':result['world']['day'],'historyWallSeconds':round(time.monotonic()-started,2),'births':result['timeline']['births'],'deaths':result['timeline']['deaths'],'transmissions':len(result['world']['legacy']['transmissions']),'errors':errors,'checks':['autosave reload','corrupt primary recovery','audio running/suspended','CDP two-finger pinch without game command','real-clock 300-year history']}
 (out/'release-check.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report),flush=True);browser.close()
