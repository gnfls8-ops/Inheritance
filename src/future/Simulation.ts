import {SeededRandom} from '../simulation/random';
import {ACTIONS,INITIAL,INITIAL_RULES,END_DAY,clamp,dateOf,dayOfYear,monthsLater,yearOf,ageYears} from './model';
import type {Action,Metric,Priority,State,LifeRecord} from './model';
import {WORLD_EVENTS,PERSONAL_EVENTS} from './content';
import {createPopulation,humanDay,canAct,personalLog} from './people';
import {applyMetrics,worldMonth,economyMonth,seekJob,classifyEnding} from './world';
import {createCity,initialGlobal,globalMonth,cityMonth,migrate} from './layers';
import type {CityFrame} from './model';
import {validate} from './validation';
export class FutureSimulation {
 private state:State;
 private rng:SeededRandom;
 private frames:CityFrame[]=[];
 drainCityFrames(){const result=this.frames;this.frames=[];return result;}
 constructor(seed=2026){
  this.rng=new SeededRandom(seed);const population=createPopulation(this.rng);
  this.state={version:23,global:initialGlobal(),nation:{id:'arcadia',name:'아르카디아',metrics:{...INITIAL}},city:createCity(),seed,randomState:this.rng.state,day:0,phase:'world-event',rules:{...INITIAL_RULES},population,playerId:null,observedId:null,assignment:null,pending:'E01',policies:[],delayed:[],applied:[],chronicle:[{day:0,kind:'world',text:'2026년 · 선택한 미래를 다른 인간의 삶으로 경험합니다.'}],lives:[],perspectives:[],lastPersonalDay:0,causes:Object.fromEntries(Object.keys(INITIAL).map(k=>[k,{delta:0,text:'2026년 가상 초기값'}])) as State['causes'],ending:null,commands:[],tutorialSeen:false};
 }
 snapshot():State{return structuredClone(this.state);}
 static restore(raw:unknown){const value=migrate(raw);validate(value);const sim=new FutureSimulation(value.seed);sim.state=value;sim.rng=new SeededRandom(value.randomState);return sim;}
 private log(kind:string,text:string){this.state.chronicle.push({day:this.state.day,kind,text});}
 private command(type:string,value:string){this.state.commands.push({day:this.state.day,type,value});this.state.randomState=this.rng.state;}
 private current(){return this.state.population.find(h=>h.id===this.state.playerId);}
 choosePolicy(index:number){
  const s=this.state,e=WORLD_EVENTS.find(e=>e.id===s.pending);
  if(s.phase!=='world-event'||!e||!Number.isInteger(index)||!e.choices[index]||s.policies.some(p=>p.id===e.id))return false;
  const choice=e.choices[index];applyMetrics(s,choice.instant,e.title+' · '+choice.label);
  for(const [k,v] of Object.entries(choice.rules)){const key=k as keyof State['rules'];s.rules[key]=clamp(s.rules[key]+v!,-.6,1.5);}
  s.policies.push({id:e.id,choice:index,day:s.day});s.delayed.push({id:e.id+':delayed',due:monthsLater(s.day,choice.months),effects:{...choice.delayed}});
  this.log('policy',`${e.title} → ${choice.label} · ${choice.benefit} / ${choice.risk}`);
  for(const h of s.population)if(h.alive&&h.id===s.playerId)personalLog(h,s.day,`${choice.label} · 이후의 생활에 정책의 영향이 반영됩니다.`);
  s.pending=null;s.phase='playing';this.command('policy',e.id+':'+index);
  if(!s.playerId)this.assign();return true;
 }
 private assign(){
  const s=this.state,eligible=s.population.filter(h=>h.alive&&ageYears(h)>=10&&h.id!==s.playerId);
  const pool=eligible.length?eligible:s.population.filter(h=>h.alive&&ageYears(h)>=10);
  if(!pool.length){this.finish();return;}
  const h=pool[Math.floor(this.rng.next()*pool.length)];s.playerId=h.id;s.observedId=h.id;s.assignment={day:s.day,assets:h.assets,happiness:h.happiness,world:{...s.nation.metrics}};s.phase='assignment';s.lastPersonalDay=s.day;
  this.log('perspective',`${h.name} · ${ageYears(h)}세 · 새로운 관점. 정책 수혜/피해와 무관하게 현재 인구에서 추첨했습니다.`);this.command('assignment',h.id);
 }
 acceptAssignment(){if(this.state.phase!=='assignment')return false;this.state.phase=this.state.tutorialSeen?'playing':'tutorial';return true;}
 finishTutorial(){if(this.state.phase!=='tutorial')return false;this.state.tutorialSeen=true;this.state.phase='playing';return true;}
 act(id:string,action:Action){const s=this.state,h=this.current();if(s.phase!=='playing'||!h||id!==s.playerId||!Object.hasOwn(ACTIONS,action)||!canAct(h,action))return false;h.order=action;this.command('action',action);return true;}
 setPriority(id:string,priority:Priority){const h=this.current();if(this.state.phase!=='playing'||!h||id!==h.id||!['balance','wealth','knowledge','expression','connection'].includes(priority))return false;h.priority=priority;this.command('priority',priority);return true;}
 retire(){const h=this.current();if(this.state.phase!=='playing'||!h||ageYears(h)<60||h.retired)return false;h.previousJob=h.job==='unemployed'?h.previousJob:h.job;h.job='unemployed';h.employed=false;h.retired=true;h.order=null;personalLog(h,this.state.day,'은퇴를 선택했습니다. 소득은 사회보장과 개인 자산에 의존합니다.');this.command('retire',h.id);return true;}
 choosePersonal(index:number){
  const s=this.state,h=this.current(),e=PERSONAL_EVENTS.find(e=>e.id===s.pending);
  if(s.phase!=='personal-event'||!h||!e||!Number.isInteger(index)||!e.choices[index])return false;
  const c=e.choices[index];
  for(const [key,value] of Object.entries(c.effects)){const k=key as keyof typeof c.effects;if(k==='assets')h.assets+=value!;else h[k]=clamp(h[k]+value!);}
  if(c.training)h.trainingDue=monthsLater(s.day,3);
  if(c.job==='new')seekJob(h,s,this.rng);
  if(c.job==='lose'){h.previousJob=h.job;h.job='unemployed';h.employed=false;}
  if(c.priority)h.priority=c.priority;
  if(e.id==='P10')h.trained=false;
  personalLog(h,s.day,e.title+' → '+c.label);this.log('personal',h.name+' · '+e.title+' → '+c.label);
  h.lastEvents[e.id]=s.day;s.lastPersonalDay=s.day;s.pending=null;s.phase='playing';this.command('personal',e.id+':'+index);return true;
 }
 private closeLife(reason:string){
  const s=this.state,h=this.current(),a=s.assignment;if(!h||!a)return;
  const record:LifeRecord={id:h.id,name:h.name,job:h.job,startDay:a.day,endDay:s.day,status:h.alive?'interim':'deceased',reason,startAssets:a.assets,endAssets:h.assets,startHappiness:a.happiness,endHappiness:h.happiness,worldStart:{...a.world},worldEnd:{...s.nation.metrics},entries:structuredClone(h.history.filter(e=>e.day>=a.day))};
  s.lives.push(record);s.assignment=null;h.order=null;s.phase='life-summary';s.pending=null;this.log('life',`${h.name} · ${reason} · ${h.alive?'살아 있는 인물은 자율 생활을 계속합니다.':'생애 기록을 보존합니다.'}`);
 }
 continuePerspective(){if(this.state.phase!=='life-summary')return false;this.assign();return true;}
 private finish(){
  const s=this.state;if(s.assignment)this.closeLife('2050년까지 경험한 삶');
  for(const life of s.lives)life.status=s.population.find(h=>h.id===life.id)?.alive?'interim':'deceased';
  s.ending=classifyEnding(s);s.phase='ending';s.pending=null;this.log('ending',s.ending.title+' · '+s.ending.unintended);
 }
 canAdvance(){return this.state.phase==='playing'&&this.state.day<END_DAY;}
 advance(days=1){
  if(!Number.isInteger(days)||days<0||days>END_DAY)throw new Error('진행 일수는 시나리오 범위 안의 정수여야 합니다.');
  const start=this.state.day;while(this.state.day-start<days&&this.canAdvance())this.tick();
  if(this.state.day!==start)this.command('advance',String(this.state.day-start));return this.state.day-start;
 }
 advanceMonths(months:number){return this.advance(Math.min(END_DAY-this.state.day,monthsLater(this.state.day,months)-this.state.day));}
 nextEvent(){return this.advance(END_DAY-this.state.day);}
 private tick(){
  const s=this.state;
  for(const h of s.population)humanDay(h,s);s.day++;
  if(dateOf(s.day).getUTCDate()===1){
   for(const effect of s.delayed.filter(d=>d.due<=s.day&&!s.applied.includes(d.id))){applyMetrics(s,effect.effects,'지연 정책 효과 · '+effect.id);s.applied.push(effect.id);this.log('delayed',effect.id.split(':')[0]+'의 지연 효과가 사회에 반영됐습니다.');}
   s.delayed=s.delayed.filter(d=>!s.applied.includes(d.id));globalMonth(s.global);worldMonth(s);cityMonth(s);economyMonth(s,this.rng);
   this.frames.push({day:s.day,city:structuredClone(s.city),metrics:{...s.nation.metrics},global:{...s.global}});
  }
  if(s.day>=END_DAY){this.finish();s.randomState=this.rng.state;return;}
  const h=this.current();if(!h)return;
  const milestone=[2034,2042].find(y=>s.day>=dayOfYear(y)&&!s.perspectives.includes(y));
  if(!h.alive||milestone){if(milestone)s.perspectives.push(milestone);this.closeLife(!h.alive?'사망':`${milestone}년 · 다른 인간의 관점으로`);s.randomState=this.rng.state;return;}
  const event=WORLD_EVENTS.find(e=>!s.policies.some(p=>p.id===e.id)&&yearOf(s.day)>=e.earliest&&(!e.requires||s.policies.some(p=>p.id===e.requires))&&Object.entries(e.threshold).every(([k,v])=>s.nation.metrics[k as Metric]>=v!));
  if(event){s.pending=event.id;s.phase='world-event';this.log('world',event.title);}
  else{
   const critical=h.health<25||h.assets<-h.expenses*3;
   if(s.day-s.lastPersonalDay>=(critical?45:150)){
    const candidates=PERSONAL_EVENTS.filter(e=>e.condition(h,s)&&s.day-(h.lastEvents[e.id]??-Infinity)>720);
    const event=candidates.find(e=>critical&&['P06','P11'].includes(e.id))??(candidates.length&&this.rng.next()<.035?candidates[Math.floor(this.rng.next()*candidates.length)]:undefined);
    if(event){s.pending=event.id;s.phase='personal-event';this.log('personal',h.name+' · '+event.title);}
   }
  }
  s.randomState=this.rng.state;
 }
}
