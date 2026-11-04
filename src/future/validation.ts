import {createCity} from './layers';
import {INITIAL,END_DAY,ACTIONS,INITIAL_RULES,ageYears} from './model';
import type {State} from './model';
import {WORLD_EVENTS,PERSONAL_EVENTS,JOBS} from './content';
export function validate(raw:unknown):asserts raw is State{
 const fail=():never=>{throw new Error('v2 미래 세계 저장이 아니거나 데이터가 손상되었습니다. 선사시대 저장은 별도로 보존하세요.');};
 if(!raw||typeof raw!=='object')fail();const s=raw as State;
 const num=(v:unknown,min=-1e9,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const day=(v:unknown)=>num(v,0,END_DAY)&&Number.isInteger(v);
 if(s.version!==23||!day(s.day)||!Number.isInteger(s.seed)||!num(s.seed,0,0xffffffff)||!Number.isInteger(s.randomState)||!num(s.randomState,0,0xffffffff))fail();
 if(!['world-event','assignment','tutorial','playing','personal-event','life-summary','ending'].includes(s.phase)||typeof s.tutorialSeen!=='boolean')fail();
 if(!s.nation?.metrics||Object.keys(INITIAL).some(k=>!num(s.nation.metrics[k as keyof typeof INITIAL],0,100)))fail();
 if(s.nation?.id!=='arcadia'||s.nation.name!=='아르카디아'||!s.global||Object.values(s.global).length!==3||(['technology','energyEfficiency','connectivity'] as const).some(k=>!num(s.global[k],0,100)))fail();
 if(!s.city||s.city.id!=='arcadia-capital'||!Array.isArray(s.city.buildings)||s.city.buildings.length!==10||new Set(s.city.buildings.map(b=>b.id)).size!==10||!Array.isArray(s.city.history))fail();
 for(const k of ['transit','automation','green','education'] as const)if(!num(s.city[k],0,100))fail();
 const expected=createCity().buildings;
 for(const b of s.city.buildings){const original=expected.find(v=>v.id===b.id);if(!original||(['kind','x','y','w','d','height'] as const).some(k=>b[k]!==original[k]))fail();if(!b||!['office','school','factory','art','lab','home','shop'].includes(b.kind)||!['existing','construction','complete'].includes(b.phase)||!Number.isInteger(b.level)||!num(b.level,0,2)||!num(b.progress,0,100)||!num(b.x,0,30)||!num(b.y,0,30)||!num(b.w,1,10)||!num(b.d,1,10)||!num(b.height,1,200)||b.startedDay!==null&&(!day(b.startedDay)||b.startedDay>s.day)||b.completedDay!==null&&(!day(b.completedDay)||b.completedDay>s.day))fail();}
 for(const e of s.city.history)if(!e||!day(e.day)||e.day>s.day||typeof e.text!=='string'||!s.city.buildings.some(b=>b.id===e.buildingId))fail();
 if(!s.rules||Object.keys(INITIAL_RULES).some(k=>!num(s.rules[k as keyof typeof INITIAL_RULES],-.6,1.5)))fail();
 if(!Array.isArray(s.population)||s.population.length<1||s.population.length>300)fail();
 const ids=new Set<string>();
 for(const h of s.population){
  if(!h||typeof h.id!=='string'||ids.has(h.id)||typeof h.name!=='string'||!Number.isInteger(h.birthDay)||!num(h.birthDay,-50000,END_DAY)||h.ageDays!==(h.alive?s.day:h.deathDay??s.day)-h.birthDay||ageYears(h)<0||typeof h.alive!=='boolean'||typeof h.retired!=='boolean'||!Object.hasOwn(JOBS,h.job)||!Object.hasOwn(JOBS,h.previousJob))fail();ids.add(h.id);
  for(const key of ['health','stress','happiness','education','skill','aiSkill','relationships','energy','achievement','jobSecurity'] as const)if(!num(h[key],0,100))fail();
  for(const key of ['income','expenses','assets','workUnits','creativeIncome'] as const)if(!num(h[key]))fail();
  if(!h.traits||Object.values(h.traits).length!==4||Object.values(h.traits).some(v=>!num(v,0,100))||!h.appearance||!num(h.appearance.skin,0,4)||!num(h.appearance.clothing,0,4))fail();
  if(!Object.hasOwn(ACTIONS,h.action)||h.order!==null&&!Object.hasOwn(ACTIONS,h.order)||!Array.isArray(h.recent)||h.recent.some(a=>!Object.hasOwn(ACTIONS,a))||!['balance','wealth','knowledge','expression','connection'].includes(h.priority)||!Array.isArray(h.history)||!h.lastEvents)fail();
  if(h.trainingDue!==null&&!num(h.trainingDue,0,END_DAY+1000)||h.jobChangedDay!==null&&!day(h.jobChangedDay))fail();
  for(const p of [h.position,h.target])if(!p||!num(p.x,0,40)||!num(p.y,0,40))fail();
  for(const e of h.history)if(!e||!day(e.day)||e.day>s.day||typeof e.text!=='string')fail();
 }
 for(const key of ['policies','delayed','applied','chronicle','lives','perspectives','commands'] as const)if(!Array.isArray(s[key]))fail();
 if(new Set(s.policies.map(p=>p.id)).size!==s.policies.length||new Set(s.applied).size!==s.applied.length)fail();
 for(const p of s.policies)if(!WORLD_EVENTS.some(e=>e.id===p.id)||!Number.isInteger(p.choice)||p.choice<0||p.choice>2||!day(p.day)||p.day>s.day)fail();
 for(const e of s.delayed)if(!e||typeof e.id!=='string'||!num(e.due,0,END_DAY+2000)||!e.effects||Object.entries(e.effects).some(([k,v])=>!Object.hasOwn(INITIAL,k)||!num(v,-100,100)))fail();
 for(const e of s.chronicle)if(!e||!day(e.day)||e.day>s.day||typeof e.text!=='string')fail();
 for(const l of s.lives)if(!l||!ids.has(l.id)||!day(l.startDay)||!day(l.endDay)||l.endDay>s.day||l.endDay<l.startDay||!Array.isArray(l.entries)||!['interim','deceased'].includes(l.status))fail();
 if(!s.causes||Object.keys(INITIAL).some(k=>!s.causes[k as keyof typeof INITIAL]||!num(s.causes[k as keyof typeof INITIAL].delta,-100,100)))fail();
 const h=s.population.find(h=>h.id===s.playerId);
 if(['playing','assignment','tutorial','personal-event'].includes(s.phase)&&(!h?.alive||ageYears(h)<10||!s.assignment))fail();
 if(s.phase==='world-event'&&!WORLD_EVENTS.some(e=>e.id===s.pending&&!s.policies.some(p=>p.id===e.id)))fail();
 if(s.phase==='personal-event'&&!PERSONAL_EVENTS.some(e=>e.id===s.pending))fail();
 if(s.phase==='ending'&&(!s.ending||typeof s.ending.title!=='string'||!Array.isArray(s.ending.traits)))fail();
 if(s.phase==='life-summary'&&!s.lives.length)fail();
 if(!num(s.lastPersonalDay,0,s.day)||s.perspectives.some(y=>![2034,2042].includes(y)))fail();
}
