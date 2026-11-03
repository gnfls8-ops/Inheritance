#!/usr/bin/env python3
"""Append-only local development evidence. No upload, credentials, or game-source edits."""
import argparse, datetime as dt, hashlib, json, os, re, shutil, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=Path(__file__).resolve().parent
DATA=BASE/'site/data'
PRIVATE=BASE/'private'
def now(): return dt.datetime.now(dt.timezone.utc).isoformat()
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def read(path,default=None):
 return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default
def ident(value):
 if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,79}',value):raise ValueError('ID에는 영문·숫자·점·밑줄·하이픈만 사용할 수 있습니다.')
 return value
def source(value):
 path=(ROOT/value).resolve()
 if not path.is_relative_to(ROOT) or not path.is_file():raise ValueError('저장소 밖 또는 없는 증거: '+value)
 relative=path.relative_to(ROOT)
 allowed=(str(relative) in ['README.md','dev-dashboard/README.md'] or relative.parts[0]=='docs') and path.suffix in ['.md','.json']
 allowed=allowed or (relative.parts[0]=='release' and path.suffix=='.png')
 if not allowed:raise ValueError('증거 허용 목록 밖: '+value)
 return path
def git(*args):
 return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def request_file():return PRIVATE/'requests.json'
def requests():return read(request_file(),[])
def update_request(request_id,status,round_id=None):
 records=requests()
 for record in records:
  if record['id']==request_id:
   record['status']=status
   if round_id and round_id not in record['rounds']:record['rounds'].append(round_id)
   record['history'].append({'at':now(),'status':status,'round':round_id})
   write(request_file(),records);return
 raise ValueError('알 수 없는 요청: '+request_id)
def request(args):
 records=requests();request_id=ident(args.id)
 if any(r['id']==request_id for r in records):raise ValueError('요청 ID는 덮어쓰지 않습니다.')
 text=Path(args.text_file).read_text(encoding='utf-8')
 records.append({'id':request_id,'title':args.title,'text':text,'approval':args.approval,'status':'approved' if args.approval=='approved' else 'needs_confirmation','received_at':now(),'received_at_basis':'이 수집기에 등록된 시각; 원래 채팅 시각이 아님','rounds':[],'history':[{'at':now(),'status':'registered'}]})
 write(request_file(),records);catalog();print('요청 등록:',request_id)
def command(argv,stage,name,timeout=240):
 started=now();print('실행:',name,flush=True)
 try:
  result=subprocess.run(argv,cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout)
  output=result.stdout;code=result.returncode
 except subprocess.TimeoutExpired as error:
  output=(error.stdout or b'');output=output.decode(errors='replace') if isinstance(output,bytes) else output
  output+='\nTIMEOUT';code=124
 log=stage/'logs'/f'{name}.txt';log.parent.mkdir(exist_ok=True);log.write_text(output,encoding='utf-8')
 return {'name':name,'status':'passed' if code==0 else 'failed','exit_code':code,'started_at':started,'ended_at':now(),'log':f'logs/{name}.txt'}
def collect(args):
 plan=read(Path(args.plan))
 if not plan:raise ValueError('기획 JSON이 필요합니다.')
 round_id=ident(plan['id']);archive=bool(args.archive)
 if plan.get('approval')!='approved':raise ValueError('큰 신규 범위는 계획 확인 후 실행합니다.')
 if (DATA/'rounds'/round_id).exists():raise ValueError('이미 존재하는 불변 회차입니다: '+round_id)
 known={r['id']:r for r in requests()}
 for request_id in plan.get('requests',[]):
  if request_id not in known or known[request_id]['approval']!='approved':raise ValueError('승인되지 않은 요청: '+request_id)
 # Validate whitelist before running checks or collecting anything.
 documents=[source(p) for p in plan.get('documents',[])]
 images=[source(p) for p in plan.get('screenshots',[]) if (ROOT/p).exists()]
 PRIVATE.mkdir(exist_ok=True);stage=Path(tempfile.mkdtemp(prefix='round-',dir=PRIVATE))
 started=now();start_epoch=dt.datetime.now().timestamp();checks=[]
 try:
  commit=git('rev-parse','HEAD')
  dirty=bool(git('status','--porcelain','--','src','public','vite.config.ts','package.json','package-lock.json'))
  if not archive and args.checks:
   checks.append(command(['npm','run','build'],stage,'build'))
   if checks[-1]['status']=='passed':
    checks.append(command(['npm','test','--','--reporter=json','--outputFile='+str(stage/'test-results.json')],stage,'tests'))
   if args.browser and all(c['status']=='passed' for c in checks):
    if args.browser not in ['scripts/check_living_world.py','scripts/check_browser.py','scripts/check_release.py']:raise ValueError('허용되지 않은 브라우저 검사')
    checks.append(command(['python',args.browser],stage,'browser'))
  if not archive and args.dashboard:
   checks.append(command(['python','dev-dashboard/check_dashboard.py'],stage,'dashboard'))
  release=read(ROOT/'public/release.json',{})
  record={'schema':1,'id':round_id,'title':plan['title'],'kind':'archive' if archive else 'iteration','started_at':started,'finished_at':now(),
   'build':{'version':None if archive else release.get('version'),'source_commit':commit,'source_dirty':dirty,'index_sha256':None if archive or not (ROOT/'dist/index.html').exists() else digest(ROOT/'dist/index.html'),'binding':'collection_only' if archive else 'current_workspace'},
   'requests':plan.get('requests',[]),'planning':plan.get('planning',[]),'changes':plan.get('changes',[]),'improvements':plan.get('improvements',[]),
   'checks':checks,'manual_play':{'status':'not_performed','notes':'수동 플레이 감상은 제출되지 않았습니다. 자동 조작 결과를 사람의 감상으로 표시하지 않습니다.'},
   'documents':[],'screenshots':[],'limitations':plan.get('limitations',[]),'publish':{'status':'not_published','reason':'현재 채팅에 Sites 스킬 및 게시 도구가 없음','url':None}}
  tests=read(stage/'test-results.json')
  if tests:record['test_summary']={key:tests.get(key) for key in ['numTotalTests','numPassedTests','numFailedTests','numPendingTests','success']}
  for index,path in enumerate(documents):
   target=stage/'documents'/f'{index:02d}-{path.name}';target.parent.mkdir(exist_ok=True);shutil.copyfile(path,target)
   record['documents'].append({'name':str(path.relative_to(ROOT)),'file':str(target.relative_to(stage)),'sha256':digest(target),'body':path.read_text(encoding='utf-8'),'basis':'imported_document' if archive else 'document_snapshot','source_modified_at':dt.datetime.fromtimestamp(path.stat().st_mtime,dt.timezone.utc).isoformat()})
  # Missing requested images remain explicit rather than being fabricated.
  for value in plan.get('screenshots',[]):
   if not (ROOT/value).exists():record['limitations'].append('없는 이미지: '+value)
  images=[source(p) for p in plan.get('screenshots',[]) if (ROOT/p).exists()]
  for index,path in enumerate(images):
   target=stage/'screenshots'/f'{index:02d}-{path.name}';target.parent.mkdir(exist_ok=True);shutil.copyfile(path,target)
   fresh=not archive and any(c['name']==('dashboard' if path.name.startswith('dashboard') else 'browser') and c['status']=='passed' for c in checks) and path.stat().st_mtime>=start_epoch
   record['screenshots'].append({'name':path.name,'file':str(target.relative_to(stage)),'sha256':digest(target),'captured_at':dt.datetime.fromtimestamp(path.stat().st_mtime,dt.timezone.utc).isoformat(),'time_basis':'파일 저장 시각 (UTC)','source':'automated_browser_current_run' if fresh else 'existing_artifact_unverified_build','app':'dashboard' if path.name.startswith('dashboard') else 'game','build_index_sha256':(digest(BASE/'site/index.html') if path.name.startswith('dashboard') else record['build']['index_sha256']) if fresh else None})
  record['status']='archived' if archive else 'failed' if any(c['status']=='failed' for c in checks) else 'verified' if checks else 'collected_unverified'
  record['finished_at']=now();write(stage/'round.json',record)
  hashes={str(path.relative_to(stage)):digest(path) for path in sorted(stage.rglob('*')) if path.is_file()}
  write(stage/'hashes.json',hashes)
  (DATA/'rounds').mkdir(parents=True,exist_ok=True);destination=DATA/'rounds'/round_id
  # rename is the only publication step, after the complete snapshot exists.
  if destination.exists():raise ValueError('회차 ID 충돌')
  stage.rename(destination)
  for path in destination.rglob('*'):
   path.chmod(0o555 if path.is_dir() else 0o444)
  destination.chmod(0o555)
  if not archive:
   for request_id in plan.get('requests',[]):update_request(request_id,'verified' if record['status']=='verified' else 'needs_fix',round_id)
   pending=[dict(item,carried_from=round_id) for item in plan.get('improvements',[]) if item.get('approval')=='approved']
   write(PRIVATE/'next-plan.json',{'from_round':round_id,'generated_at':now(),'approval':'approved' if pending else 'needs_confirmation','planning':pending,'note':'승인된 항목만 다음 기획에 승계합니다. 게임 소스 수정은 이 채팅에서 수행하며 수집기는 코드를 변경하지 않습니다.'})
  catalog();print('회차 보존:',round_id,record['status'],flush=True)
 except:
  if stage.exists():shutil.rmtree(stage)
  raise
def catalog():
 DATA.mkdir(parents=True,exist_ok=True)
 rounds=[]
 for path in sorted((DATA/'rounds').glob('*/round.json'),reverse=True):
  record=read(path);record['base']='data/rounds/'+record['id']+'/';record['manifest_sha256']=digest(path);rounds.append(record)
 value={'generated_at':now(),'requests':requests(),'rounds':rounds,'hosting':{'url':None,'status':'local_only','message':'비공개 게시 미완료 · Sites 스킬/도구 연결 필요'}}
 # External JS rather than inline HTML: the downloaded dashboard works via file:// as well.
 content='window.INHERITANCE_DASHBOARD='+json.dumps(value,ensure_ascii=False).replace('\u2028','\\u2028').replace('\u2029','\\u2029')+';\n'
 temp=DATA/'catalog.tmp';temp.write_text(content,encoding='utf-8');temp.replace(DATA/'catalog.js')
 write(DATA/'catalog.json',value)
def verify(_args):
 count=0
 for directory in (DATA/'rounds').glob('*'):
  hashes=read(directory/'hashes.json')
  if hashes is None:raise ValueError('해시 목록 없음: '+str(directory))
  for name,expected in hashes.items():
   path=(directory/name).resolve()
   if not path.is_relative_to(directory.resolve()) or not path.is_file() or digest(path)!=expected:raise ValueError('무결성 불일치: '+str(path))
   count+=1
 print('PASS immutable snapshot hashes:',count,'files')
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);sub=parser.add_subparsers(dest='action',required=True)
 req=sub.add_parser('request');req.add_argument('--id',required=True);req.add_argument('--title',required=True);req.add_argument('--text-file',required=True);req.add_argument('--approval',choices=['approved','needs_confirmation'],default='needs_confirmation');req.set_defaults(run=request)
 run=sub.add_parser('collect');run.add_argument('--plan',required=True);run.add_argument('--archive',action='store_true');run.add_argument('--checks',action='store_true');run.add_argument('--browser');run.add_argument('--dashboard',action='store_true');run.set_defaults(run=collect)
 state=sub.add_parser('status');state.add_argument('--id',required=True);state.add_argument('--state',choices=['approved','needs_confirmation','verified','needs_fix','awaiting_publish'],required=True);state.add_argument('--round');state.set_defaults(run=lambda args:(update_request(args.id,args.state,args.round),catalog()))
 check=sub.add_parser('verify');check.set_defaults(run=verify)
 cat=sub.add_parser('catalog');cat.set_defaults(run=lambda args:catalog())
 args=parser.parse_args()
 try:args.run(args)
 except (ValueError,KeyError,OSError,subprocess.SubprocessError) as error:parser.exit(1,str(error)+'\n')
