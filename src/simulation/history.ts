import {planAction,workDay} from './human';
import {SeededRandom} from './random';
import {canExperiment} from './technology';
import type { SimulationSnapshot } from './model';
import { dayChance } from './time';
import { learn, TECHNOLOGIES } from './technology';
/** History omits individual routes/utility decisions. Daily needs and monthly demographics remain explicit. */
export function historyDay(s:SimulationSnapshot){
 const w=s.world,t=s.timeline,day=w.day;
 const living=w.humans.filter(h=>h.alive);
 const stock=w.resources.reduce((a,b)=>a+b,0);
 const enough=stock>=living.length;
 let consumption=living.length;
 for(let i=0;i<w.resources.length&&consumption>0;i++){const n=Math.min(consumption,w.resources[i]);w.resources[i]-=n;consumption-=n;}
 for(const h of living){
  h.path=[];h.work=null;h.techOrder=null;h.control='auto';h.action='idle';h.reason='역사 집계 중';
  h.hunger=Math.max(0,Math.min(100,h.hunger+(enough?-7:7)));h.fatigue=Math.max(0,h.fatigue-5);
  h.health=Math.max(0,Math.min(100,h.health+(h.hunger>=85?-5:1)));
 }
 if((day+1)%30!==0)return;
 const survivors=w.humans.filter(h=>h.alive);
 // Monthly representative activities preserve exploration, construction and farming in compressed history.
 const worker=survivors[Math.floor(day/30)%Math.max(1,survivors.length)];
 if(worker){
  if(enough)worker.food=Math.min(8,worker.food+2);
  const rng=new SeededRandom((s.seed+day)>>>0);
  const unknown=w.landscape.sites.some(site=>!site.discoverers.includes(worker.id));
  const action=unknown?'explore':worker.knowledge.includes('cultivation')?'tend':'build';
  if(planAction(w,worker,action,rng)){
   if(worker.path.length)worker.position={...worker.path.at(-1)!};worker.path=[];
   for(let n=0;n<3&&worker.work;n++)workDay(w,worker);
  }
  worker.work=null;
  const tech=TECHNOLOGIES.find(t=>canExperiment(w,worker,t.id));
  if(tech&&worker.food>=2&&dayChance(s.seed,day,410)<.3){worker.food--;worker.fatigue=Math.min(100,worker.fatigue+15);learn(w,worker,tech.id,{method:'experiment'});}
 }

 // Non-genetic cultural transmission: living teachers pass knowledge through social contact.
 for(const tech of TECHNOLOGIES){const teacher=survivors.find(h=>h.knowledge.includes(tech.id));const learner=survivors.find(h=>!h.knowledge.includes(tech.id));
  if(teacher&&learner&&dayChance(s.seed,day,tech.id.length+11)<.35+t.culture.cooperation/200){learn(w,learner,tech.id,{teacher,method:'history'});t.culture.tradition=Math.min(100,t.culture.tradition+.2);}
 }
 for(let i=0;i<survivors.length-1;i++){const a=survivors[i],b=survivors[i+1];const r=a.relationships[b.id]??{trust:0,familiarity:0};a.relationships[b.id]={trust:Math.min(100,r.trust+1),familiarity:Math.min(100,r.familiarity+1)};}
 t.culture.cooperation=Math.max(0,Math.min(100,t.culture.cooperation+(enough?.15:-.5)));
}
