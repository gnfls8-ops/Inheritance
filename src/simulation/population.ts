import type {SimulationSnapshot} from './model';
import {dayChance} from './time';
import {remember} from './chronicle';
/** All modes use the same age, death, fertility and capacity rules. */
export function populationDay(s:SimulationSnapshot){
 const w=s.world,t=s.timeline,day=w.day+1;
 for(const h of w.humans){
  if(!h.alive)continue;h.ageDays++;
  if(h.health<=0||h.ageDays>=80*365){
   h.alive=false;h.deathDay=day;h.deathCause=h.ageDays>=80*365?'노령':h.hunger>=85?'굶주림':'건강 악화';h.path=[];h.techOrder=null;h.control='auto';h.action='idle';t.deaths++;
   remember(w,h,{day,kind:'death',text:`${h.name} 사망 · 향년 ${Math.floor(h.ageDays/365)}세 · ${h.deathCause}`});

  }
 }
 const h=w.humans.find(h=>h.id===s.player.humanId);
 if(h&&!h.alive&&s.player.phase==='playing'){
    s.player.phase='summary';const entries=w.legacy.people[h.id]?.entries??[];
    s.player.summary={humanId:h.id,name:h.name,startedDay:s.player.startedDay,diedDay:day,cause:h.deathCause??'건강 악화',ageYears:Math.floor(h.ageDays/365),knowledge:[...h.knowledge],relationships:structuredClone(h.relationships),entries:structuredClone(entries),impact:h.knowledge.map(technology=>({technology,holders:w.humans.filter(o=>o.id!==h.id&&o.alive&&o.knowledge.includes(technology)).map(o=>({id:o.id,name:o.name}))}))};
   }
 if(day%30!==0)return;
 const living=w.humans.filter(h=>h.alive),adults=living.filter(h=>h.ageDays>=18*365&&h.ageDays<60*365);
 const enough=w.resources.reduce((a,b)=>a+b,0)>=living.length;
 if(adults.length>=2&&living.length<30&&enough&&dayChance(s.seed,w.day,88)<adults.length/180){
  const id=`human-${t.nextHuman++}`,source=adults[0];
  const child={...structuredClone(source),id,name:`후대 ${t.nextHuman-1}`,ageDays:0,health:100,hunger:0,fatigue:0,loneliness:20,food:1,alive:true,deathDay:null,deathCause:null,knowledge:[],learnedAt:{},relationships:{},path:[],visited:[],techOrder:null,command:null,socialCooldown:{},targetHumanId:null,control:'auto' as const,action:'idle' as const,reason:'새로운 생명',traits:{curiosity:Math.floor(dayChance(s.seed,w.day,101)*101),stability:Math.floor(dayChance(s.seed,w.day,102)*101),sociability:Math.floor(dayChance(s.seed,w.day,103)*101),riskTaking:Math.floor(dayChance(s.seed,w.day,104)*101)}};
  w.humans.push(child);w.region.humanIds.push(id);w.legacy.people[id]={name:child.name,entries:[{day,kind:'world',text:`${child.name} 출생`}]};t.births++;
 }
 const keep=new Set(w.humans.filter(h=>!h.alive).slice(-30).map(h=>h.id));
 w.humans=w.humans.filter(h=>h.alive||keep.has(h.id)||h.id===s.player.humanId);w.region.humanIds=w.humans.filter(h=>h.alive).map(h=>h.id);
 // Names/relationships in the chronicle survive removal of detailed person state.
 for(const h of w.humans)for(const id of Object.keys(h.relationships))if(!w.humans.some(o=>o.id===id))delete h.relationships[id];
}
