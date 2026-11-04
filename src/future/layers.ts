import {trace} from './consequences';
import {clamp,dateOf} from './model';
import type {State,CityLayer,GlobalLayer,CityBuilding} from './model';
export const initialGlobal=():GlobalLayer=>({technology:38,energyEfficiency:35,connectivity:48});
export function globalMonth(g:GlobalLayer){g.technology=clamp(g.technology+.12+(100-g.technology)*.001);g.energyEfficiency=clamp(g.energyEfficiency+.09);g.connectivity=clamp(g.connectivity+.08);}
export function createCity():CityLayer{
 const data:[number,number,number,number,number,CityBuilding['kind']][]=[[3,3,4,4,85,'office'],[7,4,2,3,120,'office'],[21,3,5,4,40,'school'],[23,13,4,4,55,'factory'],[3,14,5,3,35,'art'],[13,3,3,4,90,'lab'],[3,23,3,3,35,'home'],[7,23,3,3,45,'home'],[22,23,4,3,65,'home'],[13,23,4,3,30,'shop']];
 return{id:'arcadia-capital',name:'아르카디아 · 중심 생활권',buildings:data.map(([x,y,w,d,height,kind],i)=>({id:'b'+i,operating:true,equipment:0,sourcePolicyId:null,x,y,w,d,height,kind,level:0,phase:'existing',progress:0,startedDay:null,completedDay:null})),transit:20,automation:12,green:35,education:30,history:[]};
}
const names={office:'업무 단지',school:'공공 학습관',factory:'자동화 생산 시설',art:'창작 공방',lab:'연구 거점',home:'주거 단지',shop:'생활 서비스'};
export function cityMonth(s:State){
 const w=s.nation.metrics,c=s.city,r=s.rules;
 const readiness={office:(w.productivity+w.ai)/2,school:w.access+r.training*15,factory:w.automation,art:w.freedom+r.creative*18,lab:(w.ai+w.access)/2,home:(w.welfare+w.environment)/2,shop:(w.productivity+w.employment)/2};
 for(const b of c.buildings){
  if(b.kind==='shop'){const old=b.operating;if(w.employment<60||w.equality<30)b.operating=false;else if(w.employment>65&&w.equality>35)b.operating=true;if(old!==b.operating)c.history.push({day:s.day,buildingId:b.id,text:b.operating?'생활 상점 재개장 · 수요 회복':'생활 상점 휴업 · 고용/분배 악화'});}
  if(['office','factory','lab'].includes(b.kind)&&b.level>0&&w.automation>60)b.equipment=2;
  if(b.level>=2)continue;
  const threshold=(b.kind==='factory'?27:b.kind==='office'?40:48)+b.level*18;
  if(b.phase!=='construction'&&readiness[b.kind]>=threshold){b.phase='construction';b.progress=0;b.startedDay=s.day;const related=b.kind==='school'?'E03':b.kind==='home'?'E05':b.kind==='art'?'E04':['office','factory'].includes(b.kind)?'E02':'E01';if(s.policies.some(p=>p.id===related)){b.sourcePolicyId=related;trace(s,{policyId:related,layer:'CITY',kind:'realized',text:`${names[b.kind]} 착공 · 관련 정책 및 국가 조건 반영`,groups:['시설 이용 주민']});}c.history.push({day:s.day,buildingId:b.id,text:`${names[b.kind]} ${b.level+1}단계 착공 · 국가 지표의 사업 조건 충족`});}
  else if(b.phase==='construction'){
   const financing=clamp((w.productivity+w.stability)/150,.25,1.4);
   b.progress=clamp(b.progress+financing*(b.kind==='lab'?7:10));
   if(b.progress>=100){b.level++;b.phase='complete';b.completedDay=s.day;if(b.sourcePolicyId)trace(s,{policyId:b.sourcePolicyId,layer:'CITY',kind:'realized',text:`${names[b.kind]} ${b.level}단계 완공 · 생활 기반 반영`,groups:['시설 이용 주민']});c.history.push({day:s.day,buildingId:b.id,text:`${names[b.kind]} ${b.level}단계 완공 · 생활 기반에 반영`});}
  }
 }
 const level=(kind:CityBuilding['kind'])=>c.buildings.filter(b=>b.kind===kind).reduce((n,b)=>n+b.level,0);
 c.transit=clamp(20+level('office')*6+level('shop')*10);
 c.automation=clamp(12+level('factory')*24+level('lab')*8);
 c.education=clamp(30+level('school')*25);
 c.green=clamp(25+w.environment*.2+level('home')*5);
}
/** Preserve all existing v20 inhabitants and decisions; never fabricate historical construction evidence. */
export function migrate(raw:unknown):State{
 if(!raw||typeof raw!=='object')throw new Error('잘못된 저장 파일');
 const input=structuredClone(raw) as Record<string,unknown>;
 if(input.version===20){
  input.version=23;input.nation={id:'arcadia',name:'아르카디아',metrics:input.world};delete input.world;input.city=createCity();const g=initialGlobal();const day=input.day;
  if(typeof day==='number'&&Number.isInteger(day)&&day>=0&&day<=8766){const d=dateOf(day),months=(d.getUTCFullYear()-2026)*12+d.getUTCMonth();for(let n=0;n<months;n++)globalMonth(g);}
  input.global=g;
 }
 if(input.version===23){
  input.version=24;input.impacts=[];input.chains=[];input.followups=[];
  if(Array.isArray(input.population))for(const h of input.population){h.itinerary??=[];h.speech??=null;h.speechLog??=[];h.said??=[];h.eventContexts??={};}
  const city=input.city as CityLayer;if(city&&Array.isArray(city.buildings))for(const b of city.buildings){b.operating=true;b.equipment=0;b.sourcePolicyId=null;}
 }
 return input as unknown as State;
}
