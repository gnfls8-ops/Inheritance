import type { SimulationSnapshot } from './model';
import { dayChance } from './time';
import { TECHNOLOGIES } from './technology';
/** History omits individual routes/utility decisions. Daily needs and monthly demographics remain explicit. */
export function historyDay(s:SimulationSnapshot){
 const w=s.world,t=s.timeline,day=w.day;
 const living=w.humans.filter(h=>h.alive);
 const stock=w.resources.reduce((a,b)=>a+b,0);
 const enough=stock>=living.length;
 let consumption=living.length;
 for(let i=0;i<w.resources.length&&consumption>0;i++){const n=Math.min(consumption,w.resources[i]);w.resources[i]-=n;consumption-=n;}
 for(const h of living){
  h.path=[];h.techOrder=null;h.control='auto';h.action='idle';h.reason='역사 집계 중';h.ageDays++;
  h.hunger=Math.max(0,Math.min(100,h.hunger+(enough?-7:7)));h.fatigue=Math.max(0,h.fatigue-5);
  h.health=Math.max(0,Math.min(100,h.health+(h.hunger>=85?-5:1)));
  if(h.health===0||h.ageDays>=80*365){h.alive=false;h.deathDay=day+1;t.deaths++;}
 }
 if((day+1)%30!==0)return;
 const survivors=w.humans.filter(h=>h.alive);
 // Non-genetic cultural transmission: living teachers pass knowledge through social contact.
 for(const tech of TECHNOLOGIES){const teacher=survivors.find(h=>h.knowledge.includes(tech.id));const learner=survivors.find(h=>!h.knowledge.includes(tech.id));
  if(teacher&&learner&&dayChance(s.seed,day,tech.id.length+11)<.35+t.culture.cooperation/200){learner.knowledge.push(tech.id);learner.learnedAt[tech.id]=day;t.culture.tradition=Math.min(100,t.culture.tradition+.2);}
 }
 for(let i=0;i<survivors.length-1;i++){const a=survivors[i],b=survivors[i+1];const r=a.relationships[b.id]??{trust:0,familiarity:0};a.relationships[b.id]={trust:Math.min(100,r.trust+1),familiarity:Math.min(100,r.familiarity+1)};}
 const adults=survivors.filter(h=>h.ageDays>=18*365&&h.ageDays<60*365);
 if(adults.length>=2&&survivors.length<30&&enough&&dayChance(s.seed,day,88)<adults.length/180){
  const id=`human-${t.nextHuman++}`,source=adults[0];
  w.humans.push({...structuredClone(source),id,name:`후대 ${t.nextHuman-1}`,ageDays:0,health:100,hunger:0,fatigue:0,food:1,alive:true,deathDay:null,knowledge:[],learnedAt:{},relationships:{},path:[],visited:[],techOrder:null,targetHumanId:null,traits:{curiosity:Math.floor(dayChance(s.seed,day,101)*101),stability:Math.floor(dayChance(s.seed,day,102)*101),sociability:Math.floor(dayChance(s.seed,day,103)*101),riskTaking:Math.floor(dayChance(s.seed,day,104)*101)}});
  w.region.humanIds.push(id);t.births++;
 }
 t.culture.cooperation=Math.max(0,Math.min(100,t.culture.cooperation+(enough?.15:-.5)));
 // Keep recent dead people plus the player’s own identity; life summaries persist separately.
 const keep=new Set(w.humans.filter(h=>!h.alive).slice(-30).map(h=>h.id));
 w.humans=w.humans.filter(h=>h.alive||keep.has(h.id)||h.id===s.player.humanId);
 w.region.humanIds=w.humans.filter(h=>h.alive).map(h=>h.id);
 for(const h of w.humans)for(const id of Object.keys(h.relationships))if(!w.humans.some(o=>o.id===id))delete h.relationships[id];
}
