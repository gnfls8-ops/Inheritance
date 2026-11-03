import type { HumanState, WorldState } from './model';
import { SeededRandom } from './random';
export const TECHNOLOGIES = [
  {id:'fire',name:'불 관리',condition:'3일 경과 · 방문한 땅 3칸',effect:'식사 시 허기 4 추가 감소',cost:1,chance:.55},
  {id:'stone',name:'석기 제작',condition:'3칸 이내 암석',effect:'한 번에 최대 4개 채집',cost:1,chance:.65},
  {id:'storage',name:'식량 저장',condition:'소지 식량 2개 이상',effect:'7일마다 발생하는 식량 1개 부패 방지',cost:1,chance:.6},
] as const;
export type TechnologyId=typeof TECHNOLOGIES[number]['id'];
export interface TechOrder {kind:'experiment'|'teach';id:TechnologyId}
export interface TechStatus {holders:number;adopted:boolean;everDiscovered:boolean}
export interface TechRecord {day:number;text:string}
export function canExperiment(w:WorldState,h:HumanState,id:TechnologyId):boolean {
 if(h.knowledge.includes(id)||h.food<1||h.fatigue>85)return false;
 if(id==='fire')return w.day>=3&&h.visited.length>=3;
 if(id==='storage')return h.food>=2;
 return w.map.tiles.some((t,i)=>t==='rock'&&Math.abs(i%w.map.width-h.position.x)+Math.abs(Math.floor(i/w.map.width)-h.position.y)<=3);
}
function log(w:WorldState,text:string){w.technologyLog.push({day:w.day+1,text});if(w.technologyLog.length>200)w.technologyLog.shift();}
export function learn(w:WorldState,h:HumanState,id:TechnologyId){if(!h.knowledge.includes(id)){h.knowledge.push(id);h.learnedAt[id]=w.day;}}
export function resolveTechnology(w:WorldState,h:HumanState,random:SeededRandom){
 const order=h.techOrder;if(!order)return;h.techOrder=null;
 const tech=TECHNOLOGIES.find(t=>t.id===order.id)!;
 if(order.kind==='experiment'){
  if(!canExperiment(w,h,order.id)){log(w,`${h.name}: ${tech.name} 실험 조건 부족`);return;}
  h.food-=tech.cost;h.fatigue=Math.min(100,h.fatigue+15);
  if(random.next()<tech.chance+h.traits.curiosity/1000){learn(w,h,order.id);log(w,`${h.name}: ${tech.name} 발견`);}
  else{h.health=Math.max(0,h.health-2);log(w,`${h.name}: ${tech.name} 실험 실패 · 식량과 기력 소모`);}
 }else{
  if(!h.knowledge.includes(order.id))return;
  const target=w.humans.filter(o=>o.id!==h.id&&!o.knowledge.includes(order.id)&&Math.abs(o.position.x-h.position.x)+Math.abs(o.position.y-h.position.y)<=3).sort((a,b)=>a.id<b.id?-1:1)[0];
  if(!target){log(w,`${h.name}: 가까운 전승 대상 없음 · 다른 인물 근처로 이동하세요`);return;}
  const trust=target.relationships[h.id]?.trust??0;
  const acceptance=Math.max(.05,Math.min(.95,.25+target.traits.curiosity*.003+target.traits.sociability*.002+trust*.003-target.traits.stability*.002));
  h.fatigue=Math.min(100,h.fatigue+5);
  if(random.next()<acceptance){learn(w,target,order.id);log(w,`${h.name} → ${target.name}: ${tech.name} 전승 수용`);}
  else log(w,`${target.name}: ${tech.name} 수용 거부 · 관계와 기질의 영향`);
 }
}
export function updateTechnology(w:WorldState,random:SeededRandom){
 for(const tech of TECHNOLOGIES){
  let holders=w.humans.filter(h=>h.knowledge.includes(tech.id));
  if(holders.length===1){const h=holders[0];if(w.day-(h.learnedAt[tech.id]??w.day)>=60&&random.next()<.02){h.knowledge=h.knowledge.filter(k=>k!==tech.id);log(w,`${tech.name}: 전승되지 않은 지식 소실`);holders=[];}}
  const old=w.technologies[tech.id];const adopted=holders.length>=Math.ceil(w.humans.length/2)&&holders.length>0;
  if(adopted!==old.adopted)log(w,`${tech.name}: ${adopted?'공동체 정착':'공동체 정착 해제'}`);
  w.technologies[tech.id]={holders:holders.length,adopted,everDiscovered:old.everDiscovered||holders.length>0};
 }
}
