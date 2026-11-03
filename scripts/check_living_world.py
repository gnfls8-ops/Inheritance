"""UI integration of survey, fishing, construction, harvest, climate and old saves."""
import json,os,copy
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'release';out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('INHERITANCE_URL','http://127.0.0.1:4180'),wait_until='networkidle')
 page.get_by_role('button',name='아라의 삶 시작',exact=True).click();page.locator('canvas').wait_for()
 def panel(name):
  if page.get_by_role('button',name='창 닫기',exact=True).count():page.get_by_role('button',name='창 닫기',exact=True).click()
  page.get_by_role('navigation',name='게임 메뉴').get_by_role('button',name=name,exact=False).click()
 def download():
  panel('설정')
  with page.expect_download() as d:page.get_by_role('button',name='저장 파일 내려받기').click()
  return json.load(open(d.value.path()))
 base=download();assert base['version']==4
 def load(s):
  panel('설정');page.locator('input[type=file]').set_input_files({'name':'world.json','mimeType':'application/json','buffer':json.dumps(s).encode()});page.wait_for_timeout(250)
 def run(days):
  if page.get_by_role('button',name='창 닫기',exact=True).count():page.get_by_role('button',name='창 닫기',exact=True).click()
  start=int(''.join(c for c in page.locator('.timebar strong').inner_text() if c.isdigit()))
  page.get_by_role('button',name='시간 재생',exact=True).click()
  page.wait_for_function("(target)=>parseInt(document.querySelector('.timebar strong').innerText.replace(/[^0-9]/g,''))>=target",arg=start+days)
  if page.get_by_role('button',name='시간 일시정지',exact=True).count():page.get_by_role('button',name='시간 일시정지',exact=True).click()
 def action(name):
  panel('인물·행동');page.get_by_role('button',name=name,exact=True).click()
 survey=copy.deepcopy(base)
 load(survey);action('탐험');travel=len(download()['world']['humans'][0]['path']);assert travel>0;run(travel);assert '장소 도착' in page.locator('.world-toast').inner_text();run(1);assert '작업 1/2' in page.locator('.world-toast').inner_text()
 page.screenshot(path=str(out/'survey.png'));run(1);assert '열매 군락 발견' in page.locator('.world-toast').inner_text()
 found=download();assert 'human-1' in found['world']['landscape']['sites'][0]['discoverers']
 # A loaded working save must resume the remaining days, never instantly complete.
 fish=copy.deepcopy(base);tiles=fish['world']['map']['tiles']
 i=next(i for i,t in enumerate(tiles) if t in ['grass','forest'] and any(0<=i+d<len(tiles) and tiles[i+d]=='river' for d in [-1,1,-48,48]))
 h=fish['world']['humans'][0];h['position']={'x':i%48,'y':i//48};h['food']=10;h['hunger']=0
 load(fish);action('낚시');run(1);mid=download();assert mid['world']['humans'][0]['work']['remaining']==2
 load(mid);run(2);assert '낚시 완료' in page.locator('.world-toast').inner_text()
 home=copy.deepcopy(base);home['world']['humans'][0]['food']=10
 load(home);action('거처 짓기');run(1);assert download()['world']['landscape']['structures'][0]['progress']==1
 run(2);built=download();assert built['world']['landscape']['structures'][0]['progress']==3
 # Ready crop + learned knowledge, then actual harvest triggers the new chapter.
 farm=copy.deepcopy(base);w=farm['world'];w['day']=30
 for h in w['humans'][:2]:h['knowledge']=['storage','cultivation'];h['food']=10
 w['landscape']['chapter']='settlement';w['landscape']['chapters'].append({'stage':'settlement','day':0});w['landscape']['harvests']=1
 w['landscape']['structures']=[{'id':'house','kind':'shelter','position':{'x':22,'y':23},'progress':3,'ownerId':'human-1','ownerName':'아라','plantedDay':None,'harvests':0},{'id':'field','kind':'plot','position':{'x':22,'y':22},'progress':3,'ownerId':'human-1','ownerName':'아라','plantedDay':0,'harvests':1}]
 w['humans'][0]['position']={'x':22,'y':22}
 load(farm);page.get_by_role('button',name='창 닫기',exact=True).click();page.screenshot(path=str(out/'cultivation.png'))
 action('밭 돌보기');run(2)
 assert '초기 재배 생활' in page.get_by_role('dialog',name='중요 사건',exact=True).inner_text()
 page.get_by_role('button',name='사건 확인',exact=True).click();harvest=download();assert harvest['world']['landscape']['harvests']==2
 # Flood removes only exposed crops and is visible in the world.
 flood=copy.deepcopy(farm);w=flood['world'];w['day']=44;w['landscape']['forecast']={'kind':'flood','starts':45,'ends':75}
 w['landscape']['structures'][1]['position']={'x':i%48,'y':i//48}
 load(flood);run(1);assert '범람' in page.locator('.world-guide').inner_text()
 page.screenshot(path=str(out/'flood.png'));assert download()['world']['landscape']['structures'][1]['plantedDay'] is None
 old=copy.deepcopy(base);old['version']=3;del old['world']['landscape'];del old['world']['technologies']['cultivation']
 for h in old['world']['humans']:del h['work']
 load(old);assert download()['version']==4;assert '아라' in page.locator('.identity').inner_text()
 page.set_viewport_size({'width':390,'height':844});panel('여정')
 assert page.get_by_role('dialog',name='삶과 세계의 변화',exact=True).is_visible()
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(out/'journey-mobile.png'))
 page.get_by_role('button',name='창 닫기',exact=True).click();page.locator('.world-guide').click();assert page.get_by_role('dialog',name='삶과 세계의 변화',exact=True).is_visible()
 assert not errors,errors
 print('PASS survey stages/discovery, fishing save resume, progressive shelter, harvest chapter pause, flood crop loss, v3 migration and mobile journey; JS errors 0')
 b.close()
