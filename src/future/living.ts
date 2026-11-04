import {ageYears} from './model';
import type {State,Human,Stop,Action} from './model';
const jobSite={office:'b0',tech:'b5',factory:'b3',service:'b9',education:'b2',art:'b4',business:'b1',unemployed:'b9'};
export function entrance(s:State,id:string){const b=s.city.buildings.find(b=>b.id===id)!;return{x:Math.floor(b.x+b.w/2),y:b.y+b.d+1};}
function stop(s:State,id:string,activity:Stop['activity']):Stop{return{...entrance(s,id),activity,facility:id};}
export function dailyRoutines(s:State){
 const social=s.population.filter(h=>h.alive&&['social','community'].includes(h.action));
 for(const h of s.population){if(!h.alive)continue;const home='b'+(6+Number(h.id.slice(1))%3);let main:Stop;
  if(h.action==='work'&&h.employed){const site=jobSite[h.job];main=s.city.buildings.find(b=>b.id===site)!.operating?stop(s,site,'work'):{x:23,y:18,facility:'job-board',activity:'search'};}
  else if(h.action==='learn'||h.action==='ai')main=stop(s,h.action==='learn'?'b2':'b5',h.action);
  else if(h.action==='create')main=stop(s,'b4','create');
  else if(h.action==='search')main={x:23,y:18,facility:'job-board',activity:'search'};
  else main={x:12+Number(h.id.slice(1))%6,y:14+Number(h.id.slice(1))%3,facility:'park',activity:h.action==='work'?'rest':h.action};
  if(['social','community'].includes(h.action)){const i=social.indexOf(h),peer=social[i%2===0?i+1:i-1];if(peer){main.x=13+Math.floor(i/2)%4;main.x+=i%2?.65:0;main.y=16;main.partnerId=peer.id;}}
  const shop=s.city.buildings.find(b=>b.id==='b9')!;
  h.itinerary=[stop(s,home,'home'),main,shop.operating&&s.day%3===Number(h.id.slice(1))%3?stop(s,'b9','shop'):{x:15,y:17,facility:'park',activity:'rest'},stop(s,home,'home')];
  const offset=Number(h.id.slice(1))%3-1;h.itinerary[0].x+=offset;h.itinerary[h.itinerary.length-1].x+=offset;h.target={x:main.x,y:main.y};h.position={x:h.itinerary[0].x,y:h.itinerary[0].y};
  speak(h,s);
 }
}
function pick(h:Human,s:State,options:string[],kind:'daily'|'policy'|'important',policyId?:string){
 const available=options.filter(text=>!h.said.includes(text));if(!available.length){h.speech=null;h.said=h.said.slice(1);return;}
 const index=(s.day+Number(h.id.slice(1))*7+s.seed)%available.length,text=available[index];h.speech={day:s.day,text,kind,...(policyId?{policyId}:{})};h.said=[...h.said,text].slice(-8);if(kind!=='daily'){h.speechLog.push({...h.speech});h.speechLog=h.speechLog.slice(-30);}
}
export function speak(h:Human,s:State){
 // Preserve a new important reaction for several days, without claiming a new occurrence.
 if(h.speech?.kind!=='daily'&&h.speech&&s.day-h.speech.day<3)return;
 if(h.jobChangedDay!==null&&s.day-h.jobChangedDay<4){pick(h,s,['새 직장으로 가는 길이 아직 낯설어.','다시 출근할 곳이 생겼네.','이곳에서는 새로 배운 걸 써 보고 싶어.'],'important');return;}
 const recent=s.impacts.filter(e=>e.humanId===h.id&&s.day-e.day<=7).at(-1);
 if(recent){const lines=recent.change==='displaced'&&!h.employed?['일자리를 잃었어. 오늘은 채용 게시판부터 보자.','예전 직장 대신 교육관에 가 봐야겠어.','변화에 적응할 시간도 필요해.']:recent.change==='work-changed'&&h.employed?['같은 일도 이제 도구가 달라졌어.','정책 발표가 내 책상까지 왔네.','효율은 올랐지만 내 역할은 어떻게 될까?']:['내가 선택한 방향으로 조금씩 가 보자.','배움과 생활 사이의 균형을 다시 찾고 있어.','지난 선택의 결과를 더 지켜보고 싶어.'];pick(h,s,lines,'important',recent.policyId);return;}
 if(s.day%7===0){const policy=s.policies.at(-1);if(policy&&s.day-policy.day<90){pick(h,s,h.assets<h.expenses?['새 정책이 생활비 부담도 줄여 줄까?','사회가 바뀌는 동안 우리 집은 버틸 수 있을까?','성과가 일상에도 닿으면 좋겠어.']:h.traits.curiosity>60?['새 제도에서 무엇을 배울 수 있을까?','기술을 써 볼 기회가 늘었으면 해.','달라진 도시를 직접 보고 싶어.']:['변화가 너무 빠르지는 않았으면 해.','익숙한 생활도 지켜졌으면 좋겠어.','새 정책의 결과를 조금 더 지켜보자.'],'policy',policy.id);return;}}
 const options:Record<Action,string[]>={work:['오늘도 내 몫의 일을 해 보자.','일을 마치고 집에 일찍 가고 싶어.','동료에게 새 방법을 물어봐야겠어.'],learn:['모르는 걸 하나씩 알아 가는 중이야.','오늘 배운 걸 내일 써 보고 싶어.','새로운 분야에도 기회가 있을까?'],ai:['이 도구로 반복 일을 줄일 수 있을까?','결과를 그대로 믿기 전에 확인해야겠어.','도구를 다루는 감각이 조금씩 생겨.'],create:['오늘은 내 생각을 작품으로 남겨 보자.','남들과 다른 표현도 괜찮겠지.','완성하는 재미는 여전해.'],social:['요즘 어떻게 지내는지 물어봐야지.','함께 이야기하니 마음이 놓여.','잠깐이라도 얼굴을 보니 좋네.'],rest:['공원에서 잠시 숨을 고르자.','쉬는 시간도 내 삶의 일부야.','오늘은 천천히 걸어도 괜찮아.'],search:['오늘은 새로운 채용 공고가 있을까?','내 경험을 필요로 하는 곳을 찾고 있어.','배운 걸 다른 일에 쓸 수 있을까?'],community:['동네 일을 함께 나누면 조금 낫겠지.','혼자서는 어려운 일도 같이 하면 달라져.','서로 돕는 사람이 있어 다행이야.']};
 const workLines:Record<Human['job'],string[]>={office:['서류를 정리하고 새 도구도 확인해야지.','오늘 회의에는 어떤 일이 남았을까?','반복 업무가 줄면 다른 역할도 배워야겠어.'],tech:['배포 전에 한 번 더 확인하자.','도구가 바뀌어도 문제를 이해하는 게 먼저야.','오늘은 막힌 부분을 해결하고 싶어.'],factory:['장비가 안전하게 돌아가는지 확인하자.','생산 라인의 소리가 달라졌네.','새 설비에 맞춰 작업 순서를 익혀야겠어.'],service:['오늘은 어떤 손님을 만나게 될까?','가게가 다시 활기를 찾으면 좋겠어.','사람을 응대하는 일도 경험이 쌓이네.'],education:['오늘 수업에서 어떤 질문이 나올까?','도구보다 배우는 사람을 먼저 봐야지.','서로 설명하다 보면 나도 배우게 돼.'],art:['내 표현을 기다리는 사람도 있겠지.','오늘 작업은 조금 다르게 해 보고 싶어.','도구가 늘어도 무엇을 말할지는 내 몫이야.'],business:['오늘 매출과 비용을 다시 살펴보자.','동네 경기가 우리 일에도 영향을 주네.','손님이 돌아올 방법을 찾아야겠어.'],unemployed:options.search};
 let lines=h.action==='work'?workLines[h.job]:options[h.action];if(ageYears(h)<20)lines=['학교에서 새로 배운 걸 해 보고 싶어.','어른들의 선택이 내 미래를 어떻게 바꿀까?','친구와 공원에서 만나기로 했어.'];else if(h.assets<0)lines=['이번 달 생활비가 걱정이야.','쓸 돈을 아끼고 다시 계획해 봐야겠어.','지원받을 방법을 찾아봐야겠어.'];else if(h.traits.stability>75)lines=[...lines,'익숙한 일상을 지키는 것도 중요해.'];
 pick(h,s,lines,'daily');
}
export function eventContext(h:Human,id:string){if(['P01','P02','P03','P10'].includes(id))return `${h.job}/${h.employed}/${h.jobChangedDay}/${h.trained}`;if(id==='P06')return h.assets<0?'debt':'low-cash';if(id==='P11')return h.health<40?'health':'stress';return 'life';}
export function repeatAllowed(h:Human,id:string){return !(h.eventContexts[id]??[]).includes(eventContext(h,id));}
