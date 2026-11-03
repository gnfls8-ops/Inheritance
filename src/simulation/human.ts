import {besideRiver,nearShelter,readyCrop,survey} from './landscape';
import {dayChance} from './time';
import {withParticle,remember} from './chronicle';
import {learn,TECHNOLOGIES} from './technology';
import type { Activity, HumanState, WorldState } from './model';
import type { Point } from './map';
import { findPath, walkable } from './map';
import { SeededRandom } from './random';
export const ACTION_LABELS = {idle:'대기',move:'이동',gather:'채집',explore:'탐험',rest:'휴식',socialize:'교류',fish:'낚시',build:'거처 짓기',tend:'밭 돌보기'} as const;
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const distance=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export function scoreActions(h:HumanState, foodNearby:boolean, companionNearby:boolean): Record<Activity,number> {
  return {
    fish:-Infinity,build:-Infinity,tend:-Infinity,
    gather:foodNearby ? h.hunger*1.8+(h.food<2 ? 35:0)+(h.hunger>=75&&h.food===0 ? 120:0)+h.traits.stability*.15-h.fatigue*.25 : -Infinity,
    rest:h.fatigue*1.2+(100-h.health)*1.4+h.traits.stability*.12,
    explore:h.traits.curiosity*.7+h.traits.riskTaking*.3+(100-h.hunger)*.2-h.fatigue*.65-h.traits.stability*.15,
    socialize:companionNearby ? h.loneliness*.8+h.traits.sociability*.6-h.hunger*.5-h.fatigue*.2 : -Infinity,
  };
}
function neighbors(world:WorldState,h:HumanState,radius:number):Point[] {
  const result:Point[]=[];
  for(let y=Math.max(0,h.position.y-radius);y<=Math.min(world.map.height-1,h.position.y+radius);y++)
    for(let x=Math.max(0,h.position.x-radius);x<=Math.min(world.map.width-1,h.position.x+radius);x++)
      if(distance(h.position,{x,y})<=radius&&walkable(world.map,{x,y}))result.push({x,y});
  return result;
}
export function planAction(world:WorldState,h:HumanState,action:Activity,random:SeededRandom):boolean {
  h.path=[];h.targetHumanId=null;h.work=null;
  if(action==='rest'){h.action=action;return true;}
  let candidates:Point[]=[];
  const duration=action==='explore'?2:action==='fish'?3:action==='build'?3:action==='tend'?2:0;
  if(duration)h.work={kind:action,remaining:duration,total:duration};
  if(action==='fish')candidates=neighbors(world,h,12).filter(p=>besideRiver(world.map,p));
  if(action==='build'){
    if(h.food<2||world.landscape.structures.filter(s=>s.kind==='shelter'&&s.progress===3).length>=12)return false;
    const unfinished=world.landscape.structures.filter(s=>s.kind==='shelter'&&s.progress<3&&distance(s.position,h.position)<=8);
    candidates=unfinished.map(s=>s.position).concat(neighbors(world,h,4).filter(p=>world.map.tiles[p.y*48+p.x]==='grass'&&!world.landscape.structures.some(s=>distance(s.position,p)<2)));
  }
  if(action==='tend'){
    if(!h.knowledge.includes('cultivation'))return false;
    candidates=world.landscape.structures.filter(s=>s.kind==='plot'&&distance(s.position,h.position)<=12&&(readyCrop(world,s)||s.plantedDay===null&&h.food>=1)).map(s=>s.position);
    if(h.food>=2&&world.landscape.structures.filter(s=>s.kind==='plot').length<8)candidates.push(...neighbors(world,h,6).filter(p=>world.map.tiles[p.y*48+p.x]==='grass'&&nearShelter(world,p,4)&&!world.landscape.structures.some(s=>distance(s.position,p)===0)));
  }
  if(action==='gather') candidates=neighbors(world,h,8).filter(p=>world.resources[p.y*world.map.width+p.x]>0);
  if(action==='socialize') {
    const other=world.humans.filter(o=>o.alive&&o.id!==h.id&&distance(h.position,o.position)<=8&&(h.socialCooldown[o.id]??-1)<=world.day)
      .sort((a,b)=>distance(h.position,a.position)-distance(h.position,b.position)||(a.id<b.id?-1:a.id>b.id?1:0));
    for(const person of other){const path=findPath(world.map,h.position,person.position);if(path){h.targetHumanId=person.id;h.path=path;h.action=action;return true;}}
    return false;
  }
  if(action==='explore') {
    candidates=neighbors(world,h,5).filter(p=>distance(h.position,p)>0);
    // Prefer unexplored ground, with seeded variation among similarly useful destinations.
    const offset=Math.floor(random.next()*Math.max(1,candidates.length));
    candidates=candidates.slice(offset).concat(candidates.slice(0,offset));
    candidates.sort((a,b)=>Number(h.visited.includes(a.y*world.map.width+a.x))-Number(h.visited.includes(b.y*world.map.width+b.x)));
    const clues=world.landscape.sites.filter(s=>!s.discoverers.includes(h.id)&&distance(s.position,h.position)<=12).sort((a,b)=>distance(a.position,h.position)-distance(b.position,h.position));
    candidates=clues.map(s=>s.position).concat(candidates);
  }else candidates.sort((a,b)=>distance(h.position,a)-distance(h.position,b));
  for(const p of candidates){const path=findPath(world.map,h.position,p);if(path){h.path=path;h.action=action;return true;}}
  return false;
}
function record(world:WorldState,h:HumanState,text:string) {
  world.activityLog.push({day:world.day+1,humanId:h.id,humanName:h.name,text});
  if(world.activityLog.length>100)world.activityLog.shift();
}
function finish(h:HumanState){h.work=null;h.control='auto';h.targetHumanId=null;h.path=[];}
/** One deterministic daily update. Sequential people share the same finite resources. */
export function stepHuman(world:WorldState,h:HumanState,random:SeededRandom) {
  const manual=h.control==='player'&&h.command&&['queued','progress'].includes(h.command.status);
  const before={food:h.food,fatigue:h.fatigue,hunger:h.hunger,health:h.health};
  if(manual&&h.command)h.command={...h.command,status:'progress',text:h.path.length?`${h.command.kind} 장소로 이동 중 · ${h.path.length}칸 남음`:`${h.command.kind} 진행 중`,day:world.day+1};
  h.hunger=clamp(h.hunger+7);h.fatigue=clamp(h.fatigue+3);h.loneliness=clamp(h.loneliness+3);
  if(h.food>0&&h.hunger>=20){h.food--;h.hunger=clamp(h.hunger-28-(h.knowledge.includes('fire')?4:0));}
  if(h.hunger>=85)h.health=clamp(h.health-5);
  else if(h.hunger<45)h.health=clamp(h.health+1);
  if(h.control==='auto'&&(!h.work&&h.path.length===0||h.hunger>75&&h.action!=='gather')) {
    const candidates=neighbors(world,h,8);
    const scores=scoreActions(h,candidates.some(p=>world.resources[p.y*world.map.width+p.x]>0),world.humans.some(o=>o.alive&&o.id!==h.id&&distance(h.position,o.position)<=8&&(h.socialCooldown[o.id]??-1)<=world.day));
    if(h.food>=3&&world.landscape.structures.filter(s=>s.kind==='shelter'&&s.progress===3).length<Math.min(12,Math.ceil(world.humans.filter(o=>o.alive).length/3)))scores.build=h.traits.stability*.8+15-h.fatigue*.6;
    if(h.knowledge.includes('cultivation'))scores.tend=65+h.hunger*.5-h.fatigue*.4;
    if(candidates.some(p=>besideRiver(world.map,p)))scores.fish=h.hunger*1.2+10-h.fatigue*.3;
    const order=(Object.keys(scores) as Activity[]).sort((a,b)=>scores[b]-scores[a]);
    for(const action of order)if(planAction(world,h,action,random)){h.reason=`${ACTION_LABELS[action]} 효용 ${Math.round(scores[action])} · 욕구와 기질 반영`;break;}
  }
  if(h.action==='socialize'&&h.targetHumanId){
    const target=world.humans.find(o=>o.alive&&o.id===h.targetHumanId);
    if(!target||distance(h.position,target.position)>12){h.reason='교류 상대가 멀어져 자율 행동으로 복귀';if(manual&&h.command)h.command={...h.command,status:'failed',text:'교류 상대가 사망했거나 멀어졌습니다.',day:world.day+1};finish(h);return;}
    const path=findPath(world.map,h.position,target.position);if(!path){if(manual&&h.command)h.command={...h.command,status:'failed',text:'교류 상대에게 도달할 수 없습니다.',day:world.day+1};finish(h);return;}h.path=path;
  }
  const next=h.path.shift();
  if(next){h.position=next;h.fatigue=clamp(h.fatigue+2);const key=next.y*world.map.width+next.x;if(!h.visited.includes(key))h.visited.push(key);}
  if(h.path.length)return;
  if(next&&h.work){if(manual&&h.command)h.command={...h.command,status:'progress',text:ACTION_LABELS[h.action]+' 장소 도착 · '+h.work.total+'일 작업 시작',day:world.day+1};return;}
  if(h.work){
    const result=workDay(world,h);
    if(h.work){if(manual&&h.command)h.command={...h.command,status:'progress',text:ACTION_LABELS[h.action]+' · 작업 '+(h.work.total-h.work.remaining)+'/'+h.work.total+'일',day:world.day+1};return;}
    if(result){record(world,h,result);if(manual&&h.command)h.command={...h.command,status:result.includes('불가')?'failed':'completed',text:result,day:world.day+1};finish(h);return;}
  }
  if(h.action==='gather'){
    const index=h.position.y*world.map.width+h.position.x;
    const amount=Math.min(h.knowledge.includes('stone')?4:3,world.resources[index]);
    world.resources[index]-=amount;h.food+=amount;h.fatigue=clamp(h.fatigue+6);
    if(h.food>0&&h.hunger>=20){h.food--;h.hunger=clamp(h.hunger-28-(h.knowledge.includes('fire')?4:0));}
    record(world,h,amount ? `먹을거리 ${amount}개 채집`:'채집 장소의 자원이 소진됨');
  }
  if(h.action==='rest'){h.fatigue=clamp(h.fatigue-30-(nearShelter(world,h.position)?10:0));if(h.hunger<70)h.health=clamp(h.health+4);record(world,h,'휴식하며 기력을 회복');}
  if(h.action==='explore')record(world,h,`새로운 땅을 탐험 (${h.position.x}, ${h.position.y})`);
  if(h.action==='socialize'){
    const other=world.humans.find(o=>o.alive&&o.id===h.targetHumanId);
    if(other&&distance(h.position,other.position)<=1){
      for(const [a,b] of [[h,other],[other,h]]){const rel=a.relationships[b.id]??{familiarity:0,trust:0};a.relationships[b.id]={familiarity:clamp(rel.familiarity+8),trust:clamp(rel.trust+5)};a.loneliness=clamp(a.loneliness-30);}
      record(world,h,`${withParticle(other.name)} 교류 · 친밀 +8 / 신뢰 +5`);
      h.socialCooldown[other.id]=world.day+4;other.socialCooldown[h.id]=world.day+4;
      if(manual)remember(world,h,{day:world.day+1,kind:'help',text:`${withParticle(other.name)} 교류 · 친밀 +8 / 신뢰 +5`,otherId:other.id,otherName:other.name});
      const tech=TECHNOLOGIES.find(t=>h.knowledge.includes(t.id)&&!other.knowledge.includes(t.id));
      if(tech&&random.next()<Math.max(.05,Math.min(.9,.2+other.traits.curiosity/500+(other.relationships[h.id]?.trust??0)/500-other.traits.stability/1000))){learn(world,other,tech.id,{teacher:h,method:'social'});world.technologyLog.push({day:world.day+1,text:`${h.name} → ${other.name}: 교류 중 ${tech.name} 전승`});world.technologyLog=world.technologyLog.slice(-200);}
    }
  }
  if(h.action==='move')record(world,h,'지정한 목적지에 도착');
  if(manual&&h.command){const recent=world.activityLog.at(-1);const delta=(n:number)=>n>0?`+${n}`:`${n}`;h.command={...h.command,status:'completed',text:`${recent?.humanId===h.id?recent.text:h.command.kind+' 완료'} · 식량 ${delta(h.food-before.food)} / 피로 ${delta(h.fatigue-before.fatigue)} / 허기 ${delta(h.hunger-before.hunger)}`,day:world.day+1};}
  finish(h);
}

export function workDay(w:WorldState,h:HumanState):string|null{
 const task=h.work;if(!task)return null;
 if(task.kind==='build'){
  let structure=w.landscape.structures.find(s=>s.kind==='shelter'&&distance(s.position,h.position)===0);
  if(!structure){
   if(h.food<1){h.work=null;return '거처 작업 불가 · 식량 1 필요';}
   h.food--;structure={id:'shelter-'+w.day+'-'+h.id,kind:'shelter',position:{...h.position},progress:0,ownerId:h.id,ownerName:h.name,plantedDay:null,harvests:0};w.landscape.structures.push(structure);
  }
  structure.progress=Math.min(3,structure.progress+1);
  if(structure.progress>=3)task.remaining=1;
 }
 h.fatigue=clamp(h.fatigue+4);task.remaining--;
 if(task.remaining>0)return null;
 h.work=null;
 if(task.kind==='explore')return survey(w,h);
 if(task.kind==='fish'){
  const food=w.landscape.weather==='drought'?1:w.landscape.weather==='bounty'?5:2+Math.floor(dayChance(w.day,h.ageDays,200)*3);
  h.food+=food;return '낚시 완료 · 식량 +'+food+' · 강가에서 3일 작업';
 }
 if(task.kind==='build'){
  const text='거처 완성 · 주변 휴식 시 피로 10 추가 회복';
  remember(w,h,{day:w.day+1,kind:'world',text});return text;
 }
 if(task.kind==='tend'){
  let plot=w.landscape.structures.find(s=>s.kind==='plot'&&distance(s.position,h.position)===0);
  if(plot&&readyCrop(w,plot)){
   const food=w.landscape.weather==='drought'?3:w.landscape.weather==='bounty'?10:7;
   plot.plantedDay=null;plot.harvests++;w.landscape.harvests++;h.food+=food;
   const text='수확 완료 · 식량 +'+food;remember(w,h,{day:w.day+1,kind:'world',text});return text;
  }
  if(plot?.plantedDay!==null&&plot?.plantedDay!==undefined)return '밭 작업 불가 · 아직 자라는 중';
  if(h.food<1)return '파종 불가 · 씨앗으로 쓸 식량 1 필요';
  if(!plot){plot={id:'plot-'+w.day+'-'+h.id,kind:'plot',position:{...h.position},progress:3,ownerId:h.id,ownerName:h.name,plantedDay:null,harvests:0};w.landscape.structures.push(plot);}
  h.food--;plot.plantedDay=w.day;return '파종 완료 · 식량 −1 · 30일 후 수확 가능';
 }
 return null;
}
