import type { SimulationSnapshot } from './model';
/** Validate imported data before replacing the live instance; reject incoherent identities. */
export function validateSnapshot(s:SimulationSnapshot):void {
 const fail=()=>{throw new Error('손상되거나 일관되지 않은 저장 데이터');};
 const number=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const object=(v:unknown)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const map=s.world.map,t=s.timeline,p=s.player;
 if(!map||map.width!==48||map.height!==48||!Array.isArray(map.tiles)||map.tiles.length!==2304||map.tiles.some(v=>!['grass','forest','rock','river','sand'].includes(v)))fail();
 if(!Array.isArray(s.world.resources)||s.world.resources.length!==2304||s.world.resources.some(v=>!number(v,0,6)))fail();
 if(!['choose','playing','summary','successor'].includes(p.phase)||!number(p.startedDay)||!Array.isArray(s.world.activityLog)||!Array.isArray(s.world.technologyLog)||!s.world.region||!Array.isArray(s.world.region.humanIds))fail();
 if(!object(t.culture)||!number(t.culture.cooperation,0,100)||!number(t.culture.tradition,0,100)||!number(t.nextHuman,13)||!number(t.births)||!number(t.deaths)||!object(t.last)||!Array.isArray(t.events))fail();
 if(Object.values(t.last).some(v=>!number(v)))fail();
 for(const e of [...t.events,...(t.pending?[t.pending]:[])])if(!e||typeof e.id!=='string'||typeof e.title!=='string'||!number(e.day,0,s.world.day)||typeof e.important!=='boolean')fail();
 if(!object(t.requestUntil)||Object.values(t.requestUntil).some(v=>!number(v)))fail();
 const legacy=s.world.legacy;
 if(!legacy||!object(legacy.people)||!Array.isArray(legacy.transmissions))fail();
 for(const person of Object.values(legacy.people)){
  if(!person||typeof person.name!=='string'||!Array.isArray(person.entries))fail();
  for(const e of person.entries)if(!e||!number(e.day,0,s.world.day)||typeof e.text!=='string')fail();
 }
 for(const e of legacy.transmissions)if(!e||!['fire','stone','storage','cultivation'].includes(e.technology)||!number(e.day,0,s.world.day)||typeof e.fromName!=='string'||typeof e.toName!=='string')fail();
 const l=s.world.landscape;
 if(!l||!Array.isArray(l.sites)||!Array.isArray(l.structures)||!Array.isArray(l.chapters)||!number(l.harvests)||!['foraging','settlement','cultivation'].includes(l.chapter)||!['clear','bounty','drought','flood'].includes(l.weather))fail();
 const point=(v:{x:number;y:number})=>v&&Number.isInteger(v.x)&&number(v.x,0,47)&&Number.isInteger(v.y)&&number(v.y,0,47);
 for(const site of l.sites)if(!site||!point(site.position)||!Array.isArray(site.discoverers)||!['berries','spring','flint','seeds'].includes(site.kind)||typeof site.name!=='string')fail();
 for(const b of l.structures)if(!b||!point(b.position)||!['shelter','plot'].includes(b.kind)||!number(b.progress,0,3)||!number(b.harvests)||typeof b.ownerName!=='string'||(b.plantedDay!==null&&!number(b.plantedDay,0,s.world.day)))fail();
 if(l.forecast&&(!['bounty','drought','flood'].includes(l.forecast.kind)||!number(l.forecast.starts)||!number(l.forecast.ends,l.forecast.starts)))fail();
 for(const c of l.chapters)if(!['foraging','settlement','cultivation'].includes(c.stage)||!number(c.day,0,s.world.day))fail();
 if(map.biome!==undefined&&!['riverland','woodland','oasis','oldcamp'].includes(map.biome))fail();
 const ids=new Set<string>();
 for(const h of s.world.humans){
  if(!h||typeof h.id!=='string'||ids.has(h.id)||typeof h.name!=='string'||typeof h.alive!=='boolean'||!number(h.ageDays)||!number(h.food)||!h.position)fail();ids.add(h.id);
  if(!Number.isInteger(h.position.x)||!number(h.position.x,0,47)||!Number.isInteger(h.position.y)||!number(h.position.y,0,47))fail();
  if([h.health,h.hunger,h.fatigue,h.loneliness,...Object.values(h.traits??{})].some(v=>!number(v,0,100))||!h.traits||Object.keys(h.traits).length!==4)fail();
  const life=h.life;
  if(!life||!point(life.home)||!object(life.skills)||Object.entries(life.skills).some(([k,v])=>!['gather','explore','rest','socialize','fish','build','tend','observe'].includes(k)||!number(v,0,100))||!(life.caregiverId===null||typeof life.caregiverId==='string')||!(life.companionId===null||typeof life.companionId==='string')||!(life.decision===null||['stay','migrate','invite'].includes(life.decision))||!(life.followup===null||['settle','roam'].includes(life.followup))||(life.destination!==null&&!point(life.destination))||(life.decisionDay!==null&&!number(life.decisionDay,0,s.world.day))||(life.arrivedDay!==null&&!number(life.arrivedDay,0,s.world.day)))fail();
  if(life.decision===null&&(life.decisionDay!==null||life.destination!==null||life.arrivedDay!==null||life.followup!==null||life.companionId!==null))fail();
  if(life.decision!==null&&life.decisionDay===null||life.decision==='stay'&&(life.destination!==null||life.arrivedDay===null)||['migrate','invite'].includes(life.decision??'')&&life.destination===null||life.followup!==null&&life.arrivedDay===null)fail();
  if(!Array.isArray(h.path)||h.path.some(v=>!v||!Number.isInteger(v.x)||!number(v.x,0,47)||!Number.isInteger(v.y)||!number(v.y,0,47)))fail();
  if(!Array.isArray(h.knowledge)||h.knowledge.some(v=>!['fire','stone','storage','cultivation'].includes(v))||!Array.isArray(h.visited)||!object(h.relationships)||!object(h.learnedAt))fail();
  if(!['auto','player'].includes(h.control)||!['idle','move','gather','explore','rest','socialize','fish','build','tend','observe'].includes(h.action))fail();
  if(!object(h.socialCooldown)||Object.values(h.socialCooldown).some(v=>!number(v))||(h.deathCause!==null&&typeof h.deathCause!=='string'))fail();
  if(h.command&&(!['queued','progress','completed','failed','cancelled'].includes(h.command.status)||typeof h.command.text!=='string'||!number(h.command.day,0,s.world.day)))fail();
  if(h.work&&(!['explore','fish','build','tend'].includes(h.work.kind)||!number(h.work.remaining,1,3)||!number(h.work.total,1,3)))fail();
  if(h.techOrder&&(!['experiment','teach'].includes(h.techOrder.kind)||!['fire','stone','storage','cultivation'].includes(h.techOrder.id)))fail();
  for(const r of Object.values(h.relationships))if(!r||!number(r.trust,0,100)||!number(r.familiarity,0,100))fail();
 }
 if(p.phase==='playing'&&!s.world.humans.some(h=>h.id===p.humanId&&h.alive))fail();
 if(['summary','successor'].includes(p.phase)&&(!p.summary||!number(p.summary.diedDay)||!Array.isArray(p.summary.knowledge)))fail();
 if(['summary','successor'].includes(p.phase)&&s.world.humans.some(h=>h.id===p.humanId&&h.alive))fail();
 if(t.mode==='history'&&p.phase!=='successor')fail();
 for(const id of ['fire','stone','storage','cultivation'] as const){const k=s.world.technologies?.[id];if(!k||!number(k.holders)||typeof k.adopted!=='boolean'||typeof k.everDiscovered!=='boolean')fail();}
}
