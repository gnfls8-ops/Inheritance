import {SeededRandom} from '../simulation/random';
import {JOBS} from './content';
import {ACTIONS,clamp,dateOf,DAY,EPOCH,ageYears} from './model';
import type {Action,Human,Job,State} from './model';
export {ageYears} from './model';
export function stage(h:Human){const age=ageYears(h);return age<13?'아동기':age<20?'청소년기':age<35?'청년기':age<60?'중장년기':'노년기';}
export function canAct(h:Human,a:Action,s?:State){return h.alive&&!(a==='work'&&h.job==='service'&&s?.city.buildings.find(b=>b.kind==='shop')?.operating===false)&&(a!=='work'||h.employed)&&(ageYears(h)>=20||!['work','search'].includes(a))&&!(h.retired&&a==='work');}
export function jobName(h:Human){return ageYears(h)<20?'학생 · 가족 부양':h.retired?'은퇴 · '+JOBS[h.previousJob].name:JOBS[h.job].name;}
const names=['민서','지우','서윤','도윤','하준','수아','서준','유진','수현','지안','지호','은우','하린','시온','유나','준서','은서','현우','소연','정우'];
const regions=['해안 생활권','산업 생활권','도심 생활권','외곽 생활권'];
export function createPopulation(rng:SeededRandom,count=180):Human[]{
 const people:Human[]=[];
 for(let i=0;i<count;i++){
  const r=rng.next(),[low,high]=r<.18?[0,12]:r<.3?[13,19]:r<.53?[20,34]:r<.85?[35,59]:[60,84];
  const age=low+Math.floor(rng.next()*(high-low+1));
  const birthDay=Math.round((Date.UTC(2025-age,Math.floor(rng.next()*12),1+Math.floor(rng.next()*28))-EPOCH)/DAY);
  let roll=rng.next()*100;let job:Job='unemployed';for(const [id,v] of Object.entries(JOBS)){roll-=v.weight;if(roll<0){job=id as Job;break;}}
  const retired=age>=60&&rng.next()<.5,adult=age>=20;const previousJob=job==='unemployed'?'service':job;
  if(!adult||retired)job='unemployed';
  const income=JOBS[job].salary*(.8+rng.next()*.5),expenses=adult?130+rng.next()*65:45+rng.next()*25;
  const x=i%2===0?10:18,y=2+(i%25);
  people.push({itinerary:[],speech:null,speechLog:[],said:[],eventContexts:{},id:'p'+i,name:names[i%names.length]+' '+(Math.floor(i/names.length)+1),birthDay,ageDays:-birthDay,retired,region:regions[Math.floor(rng.next()*4)],appearance:{skin:Math.floor(rng.next()*5),clothing:Math.floor(rng.next()*5),gender:rng.next()<.48?'여성':rng.next()<.94?'남성':'논바이너리'},job,previousJob,employed:job!=='unemployed',income,expenses,assets:(adult?300:30)+rng.next()*(adult?3500:150),education:20+rng.next()*60,skill:20+rng.next()*55,aiSkill:rng.next()*65,health:65+rng.next()*30,stress:15+rng.next()*30,happiness:40+rng.next()*35,relationships:35+rng.next()*45,family:'가족과 연락하며 생활',familyId:null,achievement:25+rng.next()*25,energy:65+rng.next()*30,jobSecurity:65,traits:{curiosity:rng.next()*100,stability:rng.next()*100,sociability:rng.next()*100,riskTaking:rng.next()*100},alive:true,deathDay:null,action:'rest',recent:[],priority:'balance',order:null,workUnits:0,creativeIncome:0,trainingDue:null,trained:false,jobChangedDay:null,lastEvents:{},history:[],thought:'새로운 하루를 준비합니다.',position:{x,y},target:{x,y}});
 }
 const adults=people.filter(h=>ageYears(h)>=25&&ageYears(h)<60);
 for(const [i,h] of people.entries()){h.familyId=ageYears(h)<20?adults[i%adults.length]?.id??null:people[(i+1)%people.length].id;h.family=ageYears(h)<20?'가족의 지원을 받으며 교육 중':h.retired?'은퇴 후 가족과 지역의 관계를 유지':'가족과 일, 개인 생활의 균형';}
 return people;
}
export function scores(h:Human,s:State):Record<Action,number>{
 const money=clamp(100-h.assets/Math.max(1,h.expenses)*15),t=h.traits;
 const values:Record<Action,number>={work:0,learn:t.curiosity*.4+(100-h.skill)*.25+s.rules.training*20,ai:t.curiosity*.3+s.nation.metrics.access*.3,create:t.curiosity*.25+(100-h.achievement)*.3+s.rules.creative*15,social:(100-h.relationships)*.7+t.sociability*.25,rest:(100-h.energy)*1.2+h.stress*.65+(100-h.health)*.5,search:!h.employed?money*.8+25:t.riskTaking*.25+(100-h.jobSecurity)*.3,community:t.sociability*.35+(100-h.relationships)*.3+s.nation.metrics.trust*.1};
 if(!h.employed&&s.day-(h.lastEvents.employmentShock??-1000)<=30){if(h.trainingDue!==null)values.learn+=70;else values.search+=90;}
 values.work=money*.8+t.stability*.25+(h.employed?15:-30)-h.stress*.25;
 const preferred={balance:'rest',wealth:h.employed?'work':'search',knowledge:'learn',expression:'create',connection:'social'} as const;values[preferred[h.priority]]+=15;
 for(const a of Object.keys(values) as Action[]){values[a]-=h.recent.filter(x=>x===a).length*(1.8-t.stability/100);if(!canAct(h,a,s))values[a]=-Infinity;}
 return values;
}
export function humanDay(h:Human,s:State){
 if(!h.alive)return;
 h.ageDays=s.day+1-h.birthDay;
 if(h.health<=0||ageYears(h)>=95){h.alive=false;h.deathDay=s.day+1;personalLog(h,s.day+1,h.health<=0?'사망 · 건강 악화':'사망 · 노령');return;}
 const values=scores(h,s),chosen=h.order&&canAct(h,h.order,s)?h.order:(Object.keys(values) as Action[]).sort((a,b)=>values[b]-values[a])[0];
 h.action=chosen;h.order=null;h.recent.push(chosen);h.recent=h.recent.slice(-12);
 h.thought=`${ACTIONS[chosen]} · 욕구와 기질, ${h.priority==='balance'?'안정':h.priority==='wealth'?'경제':h.priority==='connection'?'관계':h.priority==='knowledge'?'탐구':'표현'} 우선순위 반영`;
 h.energy=clamp(h.energy-1.2-(ageYears(h)>=60?.3:0));h.stress=clamp(h.stress+.12+(h.assets<0?.35:0));h.relationships=clamp(h.relationships-.12);
 const access=s.nation.metrics.access/100,synergy=h.aiSkill/100*access;
 switch(chosen){
  case 'work':if(h.employed){h.workUnits+=1+synergy*.45;h.skill=clamp(h.skill+.09);h.energy=clamp(h.energy-2.5*(1+s.rules.workHours));h.stress=clamp(h.stress+1.2*(1+s.rules.workHours));h.achievement=clamp(h.achievement+.4);}break;
  case 'learn':{const subsidized=ageYears(h)<20||s.rules.training>.3;h.assets-=subsidized?.08:.7;h.skill=clamp(h.skill+.22*(1+s.rules.training)*(1+s.city.education*.002));h.education=clamp(h.education+.07);h.achievement=clamp(h.achievement+.3);h.energy=clamp(h.energy-1);break;}
  case 'ai':h.assets-=.15;h.aiSkill=clamp(h.aiSkill+.28*access);h.skill=clamp(h.skill+.12*access);h.workUnits+=h.employed?synergy*.7:0;h.achievement=clamp(h.achievement+.35*access);break;
  case 'create':h.achievement=clamp(h.achievement+.85);h.stress=clamp(h.stress-.6);h.creativeIncome+=ageYears(h)>=20?(1+s.rules.creative)*(.5+synergy):0;h.energy=clamp(h.energy-.5);break;
  case 'social':h.relationships=clamp(h.relationships+2.4);h.stress=clamp(h.stress-1.5);break;
  case 'rest':h.energy=clamp(h.energy+9);h.stress=clamp(h.stress-3);h.health=clamp(h.health+.35+s.city.green*.0005);break;
  case 'search':h.skill=clamp(h.skill+.06);h.stress=clamp(h.stress+.3);break;
  case 'community':h.relationships=clamp(h.relationships+1.6);h.achievement=clamp(h.achievement+.6);h.stress=clamp(h.stress-.7);if(h.id===s.playerId)s.nation.metrics.trust=clamp(s.nation.metrics.trust+.0005);break;
 }
 if(h.stress>82||h.energy<12)h.health=clamp(h.health-.1);
 const security=clamp(h.assets/Math.max(1,h.expenses)*12);
 const wellbeing=h.health*.2+h.relationships*.23+h.achievement*.2+security*.17+s.nation.metrics.freedom*.1+(100-h.stress)*.1;
 h.happiness=clamp(h.happiness*.985+wellbeing*.015);
 const targets:Record<Action,{x:number;y:number}>={work:{x:8,y:8},learn:{x:22,y:8},ai:{x:18,y:10},create:{x:6,y:20},social:{x:13,y:16},rest:{x:3+Number(h.id.slice(1))%5*2,y:27},search:{x:23,y:18},community:{x:14,y:17}};
 h.target={...targets[chosen]};h.position={...h.target};
 if(h.health<=0||ageYears(h)>=95){h.alive=false;h.deathDay=s.day+1;h.history.push({day:s.day+1,text:'사망 · '+(h.health<=0?'건강 악화':'노령')});}
}
export function personalLog(h:Human,day:number,text:string){h.history.push({day,text});h.history=h.history.slice(-60);}
