import type {SimulationSnapshot,HumanState} from './model';
import {findPath,walkable} from './map';
import {distance} from './landscape';
import {remember} from './chronicle';
import {SeededRandom} from './random';
export type LifeChoice='stay'|'migrate'|'invite'|'later'|'settle'|'roam';
function destination(s:SimulationSnapshot,h:HumanState){
 const candidates=[{x:38,y:25},{x:23,y:38}].filter(p=>walkable(s.world.map,p)&&distance(p,h.life.home)>=8);
 return candidates.find(p=>findPath(s.world.map,h.position,p));
}
function record(s:SimulationSnapshot,h:HumanState,text:string){remember(s.world,h,{day:s.world.day,kind:'world',text});s.world.activityLog.push({day:s.world.day,humanId:h.id,humanName:h.name,text});s.world.activityLog=s.world.activityLog.slice(-100);}
export function lifeEvents(s:SimulationSnapshot){
 const w=s.world,h=w.humans.find(o=>o.id===s.player.humanId&&o.alive);
 if(!h||s.player.phase!=='playing')return;
 const life=h.life;
 if(life.destination&&life.arrivedDay===null&&distance(h.position,life.destination)<=1){
  life.arrivedDay=w.day;life.home={...h.position};record(s,h,'새 터에 도착 · 거주지가 바뀌었습니다. 이전 거처와 사람들은 원래 땅에 남습니다.');
 }
 if(s.timeline.pending)return;
 const offer=(id:string,title:string,reason:string)=>{
  const e={id,title,reason,day:w.day,important:true};s.timeline.pending=e;s.timeline.events.push(e);s.timeline.events=s.timeline.events.slice(-200);
 };
 if(!life.decision&&h.ageDays>=16*365&&w.day-s.player.startedDay>=45&&w.day-(s.timeline.last['life-defer:'+h.id]??-Infinity)>=60&&(h.visited.length>=8||h.food>=4||w.landscape.weather==='drought')&&destination(s,h)){
  offer('life-crossroads','이 땅에 남을까, 새로운 터로 갈까',`${w.landscape.weather==='drought'?'가뭄이 익숙한 생활을 흔듭니다.':h.ageDays<25*365?'혼자 삶의 방향을 정할 때가 왔습니다.':'쌓인 경험으로 앞으로 살 곳을 돌아봅니다.'} 현재 거주지 (${life.home.x}, ${life.home.y}). 이주는 식량 2가 들고 실제 이동 시간이 필요합니다.`);
 }
 if(life.decision&&life.arrivedDay!==null&&!life.followup&&w.day-life.arrivedDay>=30)offer('life-followup','이곳에서 어떤 삶을 이어갈까','지난 선택 이후 한 달이 흘렀습니다. 거처를 남기거나 탐험 경험을 키울 수 있습니다. 선택은 이 인물의 기록과 세계에 남습니다.');
}
export function resolveLifeChoice(s:SimulationSnapshot,rng:SeededRandom,choice:LifeChoice):string{
 const event=s.timeline.pending,h=s.world.humans.find(o=>o.id===s.player.humanId&&o.alive),w=s.world;
 if(!h||s.player.phase!=='playing'||!event||!['life-crossroads','life-followup'].includes(event.id))return '선택할 생애 사건이 없습니다.';
 const life=h.life;
 let text='';
 if(event.id==='life-crossroads'){
  if(!['stay','migrate','invite','later'].includes(choice)||life.decision)return '현재 사건에서 선택할 수 없습니다.';
  if(choice==='later'){s.timeline.last['life-defer:'+h.id]=w.day;text='결정을 미뤘습니다. 60일 뒤 조건이 맞으면 다시 돌아봅니다.';}
  else if(choice==='stay'){life.decision='stay';life.decisionDay=w.day;life.arrivedDay=w.day;life.home={...h.position};text='익숙한 땅에 남았습니다 · 집 근처 휴식 회복 +5 · 한 달 뒤 생활 방향을 선택합니다.';}
  else{
   const target=destination(s,h),path=target&&findPath(w.map,h.position,target);
   if(h.food<2)return '이주를 준비할 식량 2가 필요합니다. 남거나 결정을 미룰 수 있습니다.';
   if(!target||!path)return '도달할 수 있는 새 터가 없습니다. 지금은 남거나 결정을 미루세요.';
   let companion:HumanState|undefined;
   if(choice==='invite'){
    const other=w.humans.filter(o=>o.alive&&o.id!==h.id&&o.ageDays>=16*365&&distance(o.position,h.position)<=5).sort((a,b)=>(b.relationships[h.id]?.trust??0)-(a.relationships[h.id]?.trust??0)||a.id.localeCompare(b.id))[0];
    const route=other&&findPath(w.map,other.position,target);
    const chance=other?Math.max(.05,Math.min(.9,.15+other.traits.riskTaking/200+(other.relationships[h.id]?.trust??0)/200-other.traits.stability/300)):0;
    if(other&&route&&other.food>=2&&other.hunger<70&&rng.next()<chance){
     companion=other;other.path=route;other.work=null;other.techOrder=null;other.action='move';other.control='auto';other.reason='동행 부탁을 스스로 수락 · 필요하면 생존 행동 우선';other.food--;
     for(const [a,b] of [[h,other],[other,h]]){const r=a.relationships[b.id]??{trust:0,familiarity:0};a.relationships[b.id]={trust:Math.min(100,r.trust+10),familiarity:Math.min(100,r.familiarity+8)};}
    }
    text=companion?`${companion.name} 동행 수락 · 서로 신뢰 +10. `:other?`${other.name} 동행 거절 · 혼자 떠납니다. `:'가까운 동행 대상이 없어 혼자 떠납니다. ';
   }
   h.food-=2;h.work=null;h.techOrder=null;h.path=path;h.action='move';h.control='player';h.targetHumanId=null;
   life.decision=choice as 'migrate'|'invite';life.decisionDay=w.day;life.destination=target;life.companionId=companion?.id??null;
   h.command={id:s.commands.length,kind:'이주',status:'queued',day:w.day,text:`새 터 (${target.x}, ${target.y})로 이주 예약 · ${path.length}칸 · 식량 −2`};
   text+=h.command.text+' · 도착 후 한 달 뒤 후속 선택';
  }
 }else{
  if(!['settle','roam'].includes(choice)||life.followup)return '현재 사건에서 선택할 수 없습니다.';
  if(choice==='settle'){
   if(h.food<1)return '거처를 손볼 식량 1이 필요합니다. 탐험 경험을 선택할 수도 있습니다.';
   if(w.landscape.structures.filter(b=>b.kind==='shelter').length>=12)return '거처가 충분합니다. 탐험 경험을 선택할 수 있습니다.';
   h.food--;const home=life.home;const existing=w.landscape.structures.find(b=>b.kind==='shelter'&&distance(b.position,home)<=1);
   if(existing)existing.progress=3;
   else w.landscape.structures.push({id:'life-home-'+h.id,kind:'shelter',position:{...home},progress:3,ownerId:h.id,ownerName:h.name,plantedDay:null,harvests:0});
   text='지난 한 달의 생활을 거처로 남겼습니다 · 식량 −1 · 완성 거처는 사망 후에도 유지됩니다.';
  }else{h.life.skills.explore=Math.min(100,(h.life.skills.explore??0)+25);text='이동과 관찰의 경험을 키웠습니다 · 탐험 숙련 +25 · 숙련이 쌓일수록 작업 부담 감소';}
  life.followup=choice as 'settle'|'roam';
 }
 record(s,h,text);s.timeline.pending=null;s.commands.push({tick:w.day,type:'life-choice',humanId:h.id,choice});s.randomState=rng.state;return text;
}
