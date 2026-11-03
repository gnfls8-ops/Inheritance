'use strict';
const data=window.INHERITANCE_DASHBOARD||{rounds:[],requests:[],hosting:{message:'수집된 증거 없음 · collect.py를 실행하세요.'}};
const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const labels={verified:'검증 통과',passed:'통과',failed:'실패',archived:'기존 자료',collected_unverified:'수집만 완료',approved:'승인됨',needs_confirmation:'계획 확인 필요',needs_fix:'수정 필요',awaiting_publish:'게시 대기',not_performed:'수동 플레이 미실시'};
const date=v=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'UTC'})+' UTC':'확인되지 않음';
let selected=data.rounds[0]?.id,tab='overview';
const tabs={overview:'회차 개요',checks:'검증 근거',documents:'문서 본문',screenshots:'스크린샷',next:'다음 기획'};
function pill(value){return node('span',labels[value]||value,'pill '+(['verified','passed'].includes(value)?'good':'warn'));}
function list(items,empty='기록된 항목이 없습니다.'){
 if(!items?.length)return node('p',empty,'empty');
 const ul=node('ul');for(const item of items)ul.append(node('li',typeof item==='string'?item:item.text||JSON.stringify(item)));return ul;
}
function card(title,content){const e=node('article',undefined,'card');e.append(node('h3',title),content);return e;}
function link(text,url){const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener';if(url.startsWith('data:'))a.download='evidence.txt';return a;}
function render(){
 $('hosting').textContent=data.hosting.message+' · 외부 공개 URL은 아직 없습니다.';
 const search=$('search').value.toLowerCase();$('rounds').replaceChildren();
 for(const r of data.rounds.filter(r=>(r.title+' '+r.id+' '+r.requests.join(' ')+' '+r.build.version).toLowerCase().includes(search))){
  const b=node('button',undefined,'round'+(r.id===selected?' active':''));b.append(node('strong',r.title),pill(r.status),node('small','\n'+r.id+' · '+date(r.finished_at)));
  b.onclick=()=>{selected=r.id;render();};$('rounds').append(b);
 }
 const r=data.rounds.find(r=>r.id===selected);
 if(!r){$('summary').replaceChildren(node('p','아직 회차가 없습니다. collect.py로 실제 증거를 수집하세요.','empty'));return;}
 const summary=node('article',undefined,'summary');
 summary.append(node('span',r.kind==='archive'?'ARCHIVE / 과거 자료 수집':'ITERATION / 현재 작업 검증','eyebrow'),node('h2',r.title));
 const meta=node('div',undefined,'meta');meta.append(pill(r.status),node('span',r.build.version?'빌드 '+r.build.version:'원본 빌드 연결 미확인'),node('span',date(r.finished_at)),node('span','수집 소스 '+r.build.source_commit.slice(0,10)+(r.build.source_dirty?' · 수정본 포함':'')));summary.append(meta);
 if(r.kind==='archive')summary.append(node('p','과거 문서와 기존 이미지의 가져오기 기록입니다. 여기의 과거 검증 주장을 현재 다시 실행한 결과로 표시하지 않습니다.'));
 const facts=node('div',undefined,'facts');
 for(const [title,value] of [['현재 자동 검사',r.test_summary?r.test_summary.numPassedTests+' / '+r.test_summary.numTotalTests:'실행 기록 없음'],['보존 스크린샷',String(r.screenshots.length)],['수동 플레이','미실시']]){const f=node('div',undefined,'fact');f.append(node('span',title),node('strong',value));facts.append(f);}summary.append(facts);$('summary').replaceChildren(summary);
 $('tabs').replaceChildren();for(const [key,label] of Object.entries(tabs)){const b=node('button',label,key===tab?'active':'');b.setAttribute('aria-pressed',String(key===tab));b.onclick=()=>{tab=key;render();};$('tabs').append(b);}
 const content=$('content');content.replaceChildren();
 if(tab==='overview'){
  const row=node('div',undefined,'two-col');row.append(card('승인된 기획',list(r.planning)),card('반영한 변경',list(r.changes)));content.append(row,card('연결 요청',list(r.requests)),card('미완료·제약',list(r.limitations)));
 }
 if(tab==='checks'){
  if(!r.checks.length)content.append(node('p','이 회차에서는 검사를 실행하지 않았습니다. 과거 결과는 문서 본문에서 출처와 함께 확인하세요.','empty'));
  for(const check of r.checks){const body=node('div');body.append(pill(check.status),node('p',date(check.started_at)+' → '+date(check.ended_at)+' · 종료 코드 '+check.exit_code),link('원본 실행 로그',r.base+check.log));content.append(card(check.name,body));}
  content.append(card('수동 플레이 감상',node('p',r.manual_play.notes)),card('불변 스냅샷',node('p','회차 파일은 생성 후 덮어쓰지 않습니다. collect.py verify로 문서·이미지·로그의 SHA-256을 확인합니다.')));
  content.append(node('p','빌드 index SHA-256: '+(r.build.index_sha256||'연결되지 않음'),'doc-meta'),node('p','회차 manifest SHA-256: '+r.manifest_sha256,'doc-meta'),link('원본 회차 JSON',r.manifest_url||r.base+'round.json'));
 }
 if(tab==='documents'){
  if(!r.documents.length)content.append(node('p','보존된 문서가 없습니다.','empty'));
  else{const select=node('select');select.setAttribute('aria-label','보존 문서 선택');r.documents.forEach((d,i)=>{const o=node('option',d.name);o.value=String(i);select.append(o);});const body=node('article',undefined,'card');function show(){const d=r.documents[Number(select.value)];body.replaceChildren(node('p',d.basis==='imported_document'?'기존 문서 원문 · 현재 검사 결과가 아님':'회차 완료 시점 문서 원문','source'),node('p',d.name+' · SHA-256 '+d.sha256,'doc-meta'),link('보존 파일 열기',r.base+d.file),node('pre',d.body,'doc-body'));}select.onchange=show;content.append(select,body);show();}
 }
 if(tab==='screenshots'){
  const grid=node('div',undefined,'photos');
  for(const image of r.screenshots){const fig=node('figure',undefined,'photo'),button=node('button'),img=node('img');img.src=r.base+image.file;img.alt=image.name;img.loading='lazy';button.append(img);button.setAttribute('aria-label',image.name+' 확대');button.onclick=()=>{$('zoom-image').src=img.src;$('zoom-image').alt=image.name;$('zoom-caption').textContent=image.name+' · '+date(image.captured_at);$('zoom').showModal();};const caption=node('figcaption',image.name+' · '+date(image.captured_at));caption.append(node('div',image.source==='automated_browser_current_run'?'이번 회차 자동 브라우저 캡처':'기존 이미지 · 정확한 원본 빌드 미확인','source'));fig.append(button,caption);grid.append(fig);}
  content.append(r.screenshots.length?grid:node('p','보존된 이미지가 없습니다. 없는 증거를 생성하지 않았습니다.','empty'));
 }
 if(tab==='next'){
  content.append(card('개선안과 승인 상태',list(r.improvements.map(i=>i.text+' — '+(i.approval==='approved'?'승인됨 · 다음 기획에 승계':'계획 확인 필요')))),card('다음 회차의 경계',node('p','승인된 개선안만 next-plan.json으로 이어집니다. 큰 신규 범위는 계획 확인을 거칩니다. 게임 코드 작성자는 이 개발 채팅이며, 수집기는 게임 소스를 수정하거나 자동 게시하지 않습니다.')));
 }
 $('requests').replaceChildren();
 for(const req of data.requests){const details=node('details'),head=node('summary'),row=node('div',undefined,'request-head');row.append(node('span',req.id+' · '+req.title),pill(req.status));head.append(row);details.append(head,node('p',req.text,'request-text'),node('p','승인: '+(req.approval==='approved'?'승인됨':'계획 확인 필요')+' · 반영 회차: '+(req.rounds.join(', ')||'아직 없음'),'doc-meta'),node('p','등록 '+date(req.received_at)+' · '+req.received_at_basis,'doc-meta'),list(req.history.map(e=>date(e.at)+' · '+(labels[e.status]||e.status)+(e.round?' · '+e.round:''))));$('requests').append(details);}
}
$('search').addEventListener('input',render);$('close-zoom').onclick=()=>$('zoom').close();$('zoom').addEventListener('click',e=>{if(e.target===$('zoom'))$('zoom').close();});render();
