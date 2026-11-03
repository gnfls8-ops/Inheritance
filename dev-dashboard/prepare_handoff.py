"""Package existing private evidence for a user-mediated handoff; never uploads or publishes."""
import datetime as dt, hashlib, json, shutil, subprocess, sys, tempfile, zipfile
from pathlib import Path
from zoneinfo import ZoneInfo
BASE=Path(__file__).resolve().parent;ROOT=BASE.parent
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def run(*args):return subprocess.check_output(list(args),cwd=ROOT,text=True).strip()
def main():
 print(run(sys.executable,str(BASE/'collect.py'),'verify'))
 print(run(sys.executable,str(BASE/'export.py')))
 catalog=json.loads((BASE/'site/data/catalog.json').read_text())
 commit=run('git','rev-parse','HEAD')
 stamp=dt.datetime.now(ZoneInfo('Asia/Seoul'))
 name=f'INHERITANCE-sites-handoff-{stamp:%Y%m%d}-{commit[:7]}'
 with tempfile.TemporaryDirectory(prefix='handoff-',dir=BASE/'private') as temporary:
  stage=Path(temporary)
  shutil.copytree(BASE/'site',stage/'site')
  shutil.copyfile(ROOT/'release/INHERITANCE-development-dashboard.html',stage/'dashboard.html')
  (stage/'control').mkdir()
  for filename in ['requests.json','next-plan.json']:
   shutil.copyfile(BASE/'private'/filename,stage/'control'/filename)
  meta={'prepared_at_kst':stamp.isoformat(),'visibility':'private_transfer_only','published':False,
   'repository':'gnfls8-ops/Inheritance','branch':'main','source_commit':commit,
   'source_paths':['dev-dashboard/site/index.html','dev-dashboard/site/dashboard.js','dev-dashboard/site/dashboard.css','dev-dashboard/collect.py','dev-dashboard/test_regressions.py','dev-dashboard/prepare_handoff.py'],
   'static_site_root':'site/','offline_dashboard':'dashboard.html','round_count':len(catalog['rounds']),
   'round_ids':[r['id'] for r in catalog['rounds']],'original_screenshots':'site/data/rounds/<round-id>/screenshots/',
   'round_records':'site/data/rounds/<round-id>/round.json','documents':'site/data/rounds/<round-id>/documents/',
   'checksums':'SHA256SUMS.txt','manual_play':'not_performed','real_devices_safari':'not_verified'}
  (stage/'HANDOFF.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
  (stage/'HANDOFF.md').write_text(f"""# INHERITANCE 기록실 · 비공개 전달
준비 시각: {stamp:%Y-%m-%d %H:%M:%S} KST
소스: gnfls8-ops/Inheritance main @ {commit}

## 수신과 검증
이 ZIP을 총괄 채팅에 파일로 첨부해야 합니다. /workspace 경로나 127.0.0.1 주소를 다른 실행 환경에서 읽을 수 있다고 가정하지 않습니다.
압축을 푼 디렉터리에서 `sha256sum -c SHA256SUMS.txt`로 파일을 확인하세요.

## Sites 게시
해당 채팅의 Sites 스킬을 읽은 뒤 별도 비공개 사이트를 만드세요.
정적 사이트 루트는 **site/**입니다. index.html, dashboard.css, dashboard.js와 data/를 함께 올립니다.
기존 게임의 gh-pages, public/, dist/와 합치거나 이 자료를 공개 저장소에 커밋하지 마세요.
접근 권한이 비공개인지 확인한 뒤 실제 URL을 보고하세요. 이 패키지는 게시 완료나 인증 구성을 의미하지 않습니다.

## 내용
- dashboard.html: 문서와 이미지가 포함된 단일 HTML 검토본.
- site/data/rounds/: 불변 회차 JSON, 원본 PNG, 문서, 실행 로그, hashes.json.
- control/: 요청 상태/이력과 승인된 다음 기획. 사이트 루트 밖의 관리용 자료.
- HANDOFF.json / SHA256SUMS.txt: 정확한 경로, 버전, 파일 해시.

현재 {len(catalog['rounds'])}개 회차를 포함합니다. 기존 회차는 수정하지 않았습니다.
실제 휴대폰/Safari 및 수동 사용자 감상은 여전히 미검증입니다.
""")
  files=sorted(p for p in stage.rglob('*') if p.is_file())
  (stage/'SHA256SUMS.txt').write_text(''.join(sha(p)+'  '+p.relative_to(stage).as_posix()+'\n' for p in files))
  output=ROOT/'release'/f'{name}.zip'
  # The source-commit-specific package is not silently overwritten.
  if output.exists():raise FileExistsError('이미 존재하는 전달 패키지: '+str(output))
  with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
   for p in sorted(stage.rglob('*')):
    if p.is_file():archive.write(p,p.relative_to(stage))
  checksum=output.with_suffix('.zip.sha256')
  checksum.write_text(sha(output)+'  '+output.name+'\n')
  print(json.dumps({'package':str(output),'sha256':sha(output),'bytes':output.stat().st_size,'rounds':len(catalog['rounds']),'checksum':str(checksum)},ensure_ascii=False))
if __name__=='__main__':main()
