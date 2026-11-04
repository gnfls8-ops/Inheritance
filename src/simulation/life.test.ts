import {expect,it} from 'vitest';
import {Simulation} from './Simulation';
import {type SimulationSnapshot} from './model';
import {BIOMES,findPath,walkable} from './map';
import {lifeEffects,initialLife} from './life';
import {lifeEvents} from './lifeEvents';
import {stepHuman,planAction} from './human';
import {SeededRandom} from './random';
const data=(s:Simulation)=>(s as unknown as {data:SimulationSnapshot}).data;
function started(seed=2026){const s=new Simulation(seed);s.choosePlayer('human-1');return s;}
function crossroads(){const s=started(),d=data(s);d.world.day=45;d.world.humans[0].food=100;lifeEvents(d);return s;}
it('samples all biomes reproducibly with food-bearing connected starts and reachable clues',()=>{
 const seen=new Set();
 for(let n=1;n<=24;n++){
  const s=new Simulation((n*2654435761)>>>0),w=s.snapshot().world;seen.add(w.map.biome);
  expect(new Simulation((n*2654435761)>>>0).snapshot()).toEqual(s.snapshot());
  for(const h of w.humans){expect(walkable(w.map,h.position)).toBe(true);expect(w.resources[h.position.y*48+h.position.x]).toBeGreaterThan(0);}
  for(const site of w.landscape.sites)expect(findPath(w.map,w.humans[0].position,site.position)).not.toBeNull();
  expect(w.region.name).toBe(BIOMES[w.map.biome!].name);
  if(w.map.biome==='oasis')expect(w.map.tiles).toContain('sand');
  if(w.map.biome==='oldcamp')expect(w.landscape.structures[0].ownerName).toBe('이전 집단');
 }
 expect(seen.size).toBe(4);
});
it('age changes work fatigue and recovery while health and practice remain individual',()=>{
 const w=started().snapshot().world,h=w.humans[0];h.ageDays=65*365;expect(lifeEffects(h).recovery).toBe(24);
 const outcomes=[];
 for(const age of [8,25,65]){const world=structuredClone(w),person=world.humans[0];person.ageDays=age*365;person.hunger=0;person.fatigue=0;person.control='player';planAction(world,person,'gather',new SeededRandom(1));stepHuman(world,person,new SeededRandom(1));outcomes.push(person.fatigue);}
 expect(outcomes).toEqual([11,9,10]);h.health=30;expect(lifeEffects(h).effort).toBe(3);
});
it('children learn more from observation and cannot do adult labor in infancy',()=>{
 const w=started().snapshot().world,h=w.humans[0],teacher=w.humans[1];h.ageDays=8*365;teacher.position={...h.position};teacher.action='gather';teacher.knowledge=['storage'];
 expect(planAction(w,h,'observe',new SeededRandom(1))).toBe(true);h.control='player';stepHuman(w,h,new SeededRandom(0));
 expect(h.life.skills.gather).toBe(1.6);expect(h.knowledge).toContain('storage');expect(w.legacy.transmissions.at(-1)?.fromId).toBe(teacher.id);
 h.ageDays=3*365;expect(planAction(w,h,'build',new SeededRandom(1))).toBe(false);expect(planAction(w,h,'observe',new SeededRandom(1))).toBe(true);
});
it('unaccompanied children survey only nearby ground',()=>{
 const w=started().snapshot().world,h=w.humans[0];h.ageDays=8*365;for(const o of w.humans.slice(1))o.position={x:0,y:0};
 expect(planAction(w,h,'explore',new SeededRandom(1))).toBe(true);expect(h.path.length).toBeLessThanOrEqual(2);
});
it('a child can receive real food from a nearby caregiver without creating resources',()=>{
 const w=started().snapshot().world,h=w.humans[0],adult=w.humans[1];h.ageDays=2*365;h.life.caregiverId=adult.id;h.food=0;h.hunger=0;adult.food=4;adult.position={...h.position};h.control='player';h.action='rest';stepHuman(w,h,new SeededRandom(1));expect(adult.food).toBe(3);expect(h.food).toBe(1);
});
it('crossroads pause batching and cannot be dismissed by generic acknowledgement',()=>{
 const s=crossroads();expect(s.snapshot().timeline.pending?.id).toBe('life-crossroads');expect(s.advance(30)).toBe(0);expect(s.acknowledgeEvent()).toBe(false);
 s.chooseLifePath('later');expect(s.snapshot().timeline.pending).toBeNull();data(s).world.day=104;lifeEvents(data(s));expect(s.snapshot().timeline.pending).toBeNull();data(s).world.day=105;lifeEvents(data(s));expect(s.snapshot().timeline.pending?.id).toBe('life-crossroads');
});
it('migration is physical travel, survives a save, and leads to a lasting shelter',()=>{
 const s=crossroads(),d=data(s),h=d.world.humans[0],before={...h.position};s.chooseLifePath('migrate');expect(h.position).toEqual(before);expect(h.path.length).toBeGreaterThan(8);expect(h.food).toBe(98);
 const restored=Simulation.restore(s.snapshot());
 for(let day=0;day<65;day++)for(const sim of [s,restored]){if(sim.snapshot().timeline.pending?.id==='life-followup')continue;sim.acknowledgeEvent();sim.step();}
 expect(s.snapshot()).toEqual(restored.snapshot());expect(h.life.arrivedDay).not.toBeNull();expect(s.snapshot().timeline.pending?.id).toBe('life-followup');
 s.chooseLifePath('settle');const home=d.world.landscape.structures.find(b=>b.id==='life-home-'+h.id)!;expect(home.progress).toBe(3);h.health=0;s.step();expect(s.snapshot().player.phase).toBe('summary');s.reviewLife();s.choosePlayer('human-2');expect(d.world.landscape.structures).toContainEqual(home);expect(d.player.humanId).toBe('human-2');
});
it('staying and migration leave different persistent state; NPC can refuse without switching player',()=>{
 const stay=crossroads();stay.chooseLifePath('stay');expect(data(stay).world.humans[0].life.destination).toBeNull();expect(data(stay).world.humans[0].life.decision).toBe('stay');
 const s=crossroads(),d=data(s);for(const h of d.world.humans.slice(1))h.food=0;
 expect(s.chooseLifePath('invite')).toContain('거절');expect(d.world.humans[0].life.companionId).toBeNull();expect(d.player.humanId).toBe('human-1');expect(d.world.humans[1].control).toBe('auto');
});
it('NPC invitation acceptance is seeded, costs real food and never grants direct command authority',()=>{
 const s=crossroads(),d=data(s),other=d.world.humans[1];other.food=10;other.hunger=0;other.traits.riskTaking=100;other.traits.stability=0;other.relationships['human-1']={trust:100,familiarity:100};
 d.randomState=0;const r=Simulation.restore(s.snapshot());expect(r.chooseLifePath('invite')).toContain('수락');const p=r.snapshot();expect(p.world.humans[0].life.companionId).toBe(other.id);expect(p.world.humans[1].food).toBe(9);expect(r.move(other.id,{x:23,y:23})).toBe(false);
});
it('v4 imports preserve terrain, structures, identity, time and RNG without generating a new world',()=>{
 const old:any=started(123456789).snapshot();old.version=4;delete old.world.map.biome;for(const h of old.world.humans)delete h.life;
 const r=Simulation.restore(old).snapshot();expect(r.version).toBe(5);expect(r.world.map).toEqual(old.world.map);expect(r.world.landscape).toEqual(old.world.landscape);expect(r.player).toEqual(old.player);expect(r.randomState).toBe(old.randomState);expect(r.world.humans[0].life).toEqual(initialLife(old.world.humans[0].position));
});
it('rejects corrupt new life state without resetting it silently',()=>{
 const s=started().snapshot();s.world.humans[0].life.home.x=-1;expect(()=>Simulation.restore(s)).toThrow();
});
it('daily and life batches stop at the same choice with identical RNG',()=>{
 const a=started(),b=started();data(a).world.humans[0].food=100;data(b).world.humans[0].food=100;b.setMode('life');
 for(let n=0;n<120&&a.canAdvance();n++)a.advance(1);
 for(let n=0;n<4&&b.canAdvance();n++)b.advance(30);
 expect(b.snapshot().world).toEqual(a.snapshot().world);expect(b.snapshot().timeline.pending).toEqual(a.snapshot().timeline.pending);expect(b.snapshot().randomState).toBe(a.snapshot().randomState);
});
it('child movement cannot bypass local exploration rules and grown people remain free to travel',()=>{
 const s=started(),h=data(s).world.humans[0];h.ageDays=8*365;
 expect(s.move(h.id,{x:38,y:25})).toBe(false);expect(s.move(h.id,{x:22,y:22})).toBe(true);
 h.ageDays=18*365;expect(s.move(h.id,{x:38,y:25})).toBe(true);
});
it('desert scarcity has slower sand renewal and no river-wide flood forecast',async()=>{
 const {landscapeDay}=await import('./landscape');let s=started();
 for(let n=1;n<30;n++){const candidate=started((n*2654435761)>>>0);if(candidate.snapshot().world.map.biome==='oasis'){s=candidate;break;}}
 const d=data(s);expect(d.world.map.biome).toBe('oasis');d.world.resources.fill(0);d.world.day=7;landscapeDay(d);
 const sand=d.world.map.tiles.indexOf('sand');expect(d.world.resources[sand]).toBe(0);
 d.world.day=28;landscapeDay(d);expect(d.world.resources[sand]).toBe(1);
 d.world.day=42;landscapeDay(d);expect(d.world.landscape.forecast?.kind).not.toBe('flood');
});
it('a life-stage transition pauses on the exact birthday and preserves identity',()=>{
 const s=started(),h=data(s).world.humans[0];h.ageDays=60*365-1;s.setMode('life');expect(s.advance(30)).toBe(1);expect(s.snapshot().timeline.pending?.id).toBe('age-stage');expect(s.snapshot().player.humanId).toBe(h.id);expect(s.acknowledgeEvent()).toBe(true);
});
