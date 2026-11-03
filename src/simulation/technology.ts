import type { HumanState, WorldState } from './model';
import { SeededRandom } from './random';
import {remember} from './chronicle';
import type {TransmissionMethod} from './chronicle';
export const TECHNOLOGIES = [
 {id:'fire',name:'불 관리',condition:'3일 경과 · 방문한 땅 3칸',effect:'식사 시 허기 4 추가 감소',cost:1,chance:.55},
 {id:'stone',name:'석기 제작',condition:'3칸 이내 암석',effect:'한 번에 최대 4개 채집',cost:1,chance:.65},
 {id:'storage',name:'식량 저장',condition:'소지 식량 2개 이상',effect:'7일마다 발생하는 식량 1개 부패 방지',cost:1,chance:.6},
 {id:'cultivation',name:'씨앗 재배',condition:'식량 저장 지식 · 곡물 발견 · 완성된 거처',effect:'밭을 가꾸어 30일 후 수확',cost:1,chance:.7},
] as const;
export type TechnologyId=typeof TECHNOLOGIES[number]['id'];
export interface TechOrder {kind:'experiment'|'teach';id:TechnologyId;targetId?:string}
export interface TechStatus {holders:number;adopted:boolean;everDiscovered:boolean}
export interface TechRecord {day:number;text:string}
export function canExperiment(w:WorldState,h:HumanState,id:TechnologyId):boolean {
 if(!h.alive||h.knowledge.includes(id)||h.food<1||h.fatigue>85)return false;
 if(id==='fire')return w.day>=3&&h.visited.length>=3;
 if(id==='cultivation')return h.knowledge.includes('storage')&&w.landscape.sites.some(s=>s.kind==='seeds'&&s.discoverers.includes(h.id))&&w.landscape.structures.some(s=>s.kind==='shelter'&&s.progress>=3);
 if(id==='storage')return h.food>=2;
 if(id==='stone'&&w.landscape.sites.some(s=>s.kind==='flint'&&s.discoverers.includes(h.id)))return true;
 return w.map.tiles.some((t,i)=>t==='rock'&&Math.abs(i%w.map.width-h.position.x)+Math.abs(Math.floor(i/w.map.width)-h.position.y)<=3);
}
function log(w:WorldState,text:string){w.technologyLog.push({day:w.day+1,text});if(w.technologyLog.length>200)w.technologyLog.shift();}
export function learn(w:WorldState,h:HumanState,id:TechnologyId,source?:{teacher?:HumanState;method:TransmissionMethod|'experiment'}){
 if(h.knowledge.includes(id))return;h.knowledge.push(id);h.learnedAt[id]=w.day;
 const name=TECHNOLOGIES.find(t=>t.id===id)!.name,teacher=source?.teacher;
 remember(w,h,{day:w.day+1,kind:source?.method==='experiment'?'discovery':'learning',text:source?.method==='experiment'?`${name} 직접 발견`:teacher?`${teacher.name}에게 ${name} 습득`:`${name} 습득 · 출처 기록 없음`,technology:id,otherId:teacher?.id,otherName:teacher?.name});
 if(teacher){
  const method=source!.method as TransmissionMethod;
  w.legacy.transmissions.push({technology:id,fromId:teacher.id,fromName:teacher.name,toId:h.id,toName:h.name,day:w.day+1,method});
  remember(w,teacher,{day:w.day+1,kind:'teaching',text:`${h.name}에게 ${name} 전승`,technology:id,otherId:h.id,otherName:h.name});
 }
}
export function resolveTechnology(w:WorldState,h:HumanState,random:SeededRandom){
 const order=h.techOrder;if(!order)return;h.techOrder=null;
 const tech=TECHNOLOGIES.find(t=>t.id===order.id)!;
 const result=(text:string,success:boolean)=>{log(w,`${h.name}: ${text}`);if(h.command)h.command={...h.command,status:success?'completed':'failed',text,day:w.day+1};};
 if(order.kind==='experiment'){
  if(!canExperiment(w,h,order.id)){result(`${tech.name} 실험 조건 부족 · 비용 없음`,false);return;}
  h.food-=tech.cost;h.fatigue=Math.min(100,h.fatigue+15);
  if(random.next()<tech.chance+h.traits.curiosity/1000){learn(w,h,order.id,{method:'experiment'});result(`${tech.name} 발견 · 식량 −1 / 피로 +15`,true);}
  else{h.health=Math.max(0,h.health-2);result(`${tech.name} 실험 실패 · 식량 −1 / 피로 +15 / 건강 −2`,false);}
 }else{
  if(!h.knowledge.includes(order.id)){result('전승할 지식이 없습니다.',false);return;}
  const target=w.humans.filter(o=>o.alive&&o.id!==h.id&&(!order.targetId||o.id===order.targetId)&&!o.knowledge.includes(order.id)&&Math.abs(o.position.x-h.position.x)+Math.abs(o.position.y-h.position.y)<=3).sort((a,b)=>a.id<b.id?-1:1)[0];
  if(!target){result('가까운 전승 대상 없음 · 이동 후 다시 시도하세요',false);return;}
  const trust=target.relationships[h.id]?.trust??0;
  const acceptance=Math.max(.05,Math.min(.95,.25+target.traits.curiosity*.003+target.traits.sociability*.002+trust*.003-target.traits.stability*.002));
  h.fatigue=Math.min(100,h.fatigue+5);
  if(random.next()<acceptance){learn(w,target,order.id,{teacher:h,method:'direct'});result(`${target.name}: ${tech.name} 전승 수용 · 피로 +5`,true);}
  else{result(`${target.name}: ${tech.name} 수용 거부 · 피로 +5`,false);remember(w,h,{day:w.day+1,kind:'refusal',text:`${target.name}: ${tech.name} 전승 거부`,otherId:target.id,otherName:target.name,technology:order.id});}
 }
}
export function updateTechnology(w:WorldState,random:SeededRandom){
 for(const tech of TECHNOLOGIES){
  let holders=w.humans.filter(h=>h.alive&&h.knowledge.includes(tech.id));
  if(holders.length===1){const h=holders[0];if(w.day-(h.learnedAt[tech.id]??w.day)>=60&&random.next()<.02){h.knowledge=h.knowledge.filter(k=>k!==tech.id);log(w,`${tech.name}: 전승되지 않은 지식 소실`);remember(w,h,{day:w.day+1,kind:'loss',text:`${tech.name} 지식 소실`,technology:tech.id});holders=[];}}
  const old=w.technologies[tech.id],adopted=holders.length>=Math.ceil(w.humans.filter(h=>h.alive).length/2)&&holders.length>0;
  if(old.holders>0&&holders.length===0)log(w,`${tech.name}: 살아 있는 보유자가 없어 지식 소실`);
  if(adopted!==old.adopted)log(w,`${tech.name}: ${adopted?'공동체 정착':'공동체 정착 해제'}`);
  w.technologies[tech.id]={holders:holders.length,adopted,everDiscovered:old.everDiscovered||holders.length>0};
 }
}
