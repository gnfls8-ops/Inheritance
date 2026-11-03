import {withParticle,remember} from './chronicle';
import {learn,TECHNOLOGIES} from './technology';
import type { Activity, HumanState, WorldState } from './model';
import type { Point } from './map';
import { findPath, walkable } from './map';
import { SeededRandom } from './random';
export const ACTION_LABELS = {idle:'대기',move:'이동',gather:'채집',explore:'탐험',rest:'휴식',socialize:'교류'} as const;
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const distance=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export function scoreActions(h:HumanState, foodNearby:boolean, companionNearby:boolean): Record<Activity,number> {
  return {
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
  h.path=[];h.targetHumanId=null;
  if(action==='rest'){h.action=action;return true;}
  let candidates:Point[]=[];
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
  }else candidates.sort((a,b)=>distance(h.position,a)-distance(h.position,b));
  for(const p of candidates){const path=findPath(world.map,h.position,p);if(path){h.path=path;h.action=action;return true;}}
  return false;
}
function record(world:WorldState,h:HumanState,text:string) {
  world.activityLog.push({day:world.day+1,humanId:h.id,humanName:h.name,text});
  if(world.activityLog.length>100)world.activityLog.shift();
}
function finish(h:HumanState){h.control='auto';h.targetHumanId=null;h.path=[];}
/** One deterministic daily update. Sequential people share the same finite resources. */
export function stepHuman(world:WorldState,h:HumanState,random:SeededRandom) {
  const manual=h.control==='player'&&h.command&&['queued','progress'].includes(h.command.status);
  const before={food:h.food,fatigue:h.fatigue,hunger:h.hunger,health:h.health};
  if(manual&&h.command)h.command={...h.command,status:'progress',text:h.path.length?`${h.command.kind} 장소로 이동 중 · ${h.path.length}칸 남음`:`${h.command.kind} 진행 중`,day:world.day+1};
  h.hunger=clamp(h.hunger+7);h.fatigue=clamp(h.fatigue+3);h.loneliness=clamp(h.loneliness+3);
  if(h.food>0&&h.hunger>=20){h.food--;h.hunger=clamp(h.hunger-28-(h.knowledge.includes('fire')?4:0));}
  if(h.hunger>=85)h.health=clamp(h.health-5);
  else if(h.hunger<45)h.health=clamp(h.health+1);
  if(h.control==='auto'&&(h.path.length===0||h.hunger>75&&h.action!=='gather')) {
    const candidates=neighbors(world,h,8);
    const scores=scoreActions(h,candidates.some(p=>world.resources[p.y*world.map.width+p.x]>0),world.humans.some(o=>o.alive&&o.id!==h.id&&distance(h.position,o.position)<=8&&(h.socialCooldown[o.id]??-1)<=world.day));
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
  if(h.action==='gather'){
    const index=h.position.y*world.map.width+h.position.x;
    const amount=Math.min(h.knowledge.includes('stone')?4:3,world.resources[index]);
    world.resources[index]-=amount;h.food+=amount;h.fatigue=clamp(h.fatigue+6);
    if(h.food>0&&h.hunger>=20){h.food--;h.hunger=clamp(h.hunger-28-(h.knowledge.includes('fire')?4:0));}
    record(world,h,amount ? `먹을거리 ${amount}개 채집`:'채집 장소의 자원이 소진됨');
  }
  if(h.action==='rest'){h.fatigue=clamp(h.fatigue-30);if(h.hunger<70)h.health=clamp(h.health+4);record(world,h,'휴식하며 기력을 회복');}
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
