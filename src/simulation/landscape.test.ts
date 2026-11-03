import {expect,it} from 'vitest';
import {Simulation} from './Simulation';
import type {SimulationSnapshot} from './model';
import {planAction,stepHuman,workDay} from './human';
import {SeededRandom} from './random';
import {besideRiver,landscapeDay,nearShelter,survey} from './landscape';
import {canExperiment,learn} from './technology';
function setup(){const s=new Simulation(2026);s.choosePlayer('human-1');return s;}
function data(s:Simulation){return (s as unknown as {data:SimulationSnapshot}).data;}
it('exploration pauses to survey, discovers a real site once and persists the result',()=>{
 const s=setup(),d=data(s),h=d.world.humans[0],site=d.world.landscape.sites[0];
 h.position={...site.position};expect(s.act(h.id,'explore')).toBe(true);expect(h.path).toHaveLength(0);
 s.step();expect(h.work?.remaining).toBe(1);expect(site.discoverers).toHaveLength(0);
 s.step();expect(h.work).toBeNull();expect(site.discoverers).toContain(h.id);
 const count=d.world.legacy.people[h.id].entries.length;survey(d.world,h);expect(d.world.legacy.people[h.id].entries).toHaveLength(count);
 expect(Simulation.restore(s.snapshot()).snapshot()).toEqual(s.snapshot());
});
it('fishing needs a river bank and three stationary work days',()=>{
 const s=setup(),w=data(s).world,h=w.humans[0];
 const index=w.map.tiles.findIndex((t,i)=>(t==='grass'||t==='forest')&&besideRiver(w.map,{x:i%48,y:Math.floor(i/48)}));
 h.position={x:index%48,y:Math.floor(index/48)};h.food=10;h.hunger=0;
 expect(s.act(h.id,'fish')).toBe(true);const p={...h.position};s.step();s.step();expect(h.work?.remaining).toBe(1);
 s.step();expect(h.work).toBeNull();expect(h.position).toEqual(p);expect(h.command?.text).toContain('낚시 완료');expect(h.food).toBeGreaterThanOrEqual(11);
});
it('shelters are constructed progressively and improve nearby rest',()=>{
 const s=setup(),w=data(s).world,h=w.humans[0];h.food=10;h.hunger=0;
 expect(s.act(h.id,'build')).toBe(true);s.step();expect(w.landscape.structures[0].progress).toBe(1);
 s.step();s.step();expect(nearShelter(w,h.position)).toBe(true);
 h.fatigue=90;h.hunger=0;s.act(h.id,'rest');s.step();expect(h.fatigue).toBe(53);
});
it('planting consumes food, waits thirty game days and only then yields a harvest',()=>{
 const s=setup(),w=data(s).world,h=w.humans[0];h.knowledge=['cultivation'];h.food=10;
 w.landscape.structures.push({id:'home',kind:'shelter',position:{x:22,y:22},progress:3,ownerId:h.id,ownerName:h.name,plantedDay:null,harvests:0});
 h.position={x:23,y:22};const rng=new SeededRandom(1);
 expect(planAction(w,h,'tend',rng)).toBe(true);h.path=[];workDay(w,h);workDay(w,h);expect(h.food).toBe(9);
 const plot=w.landscape.structures.find(b=>b.kind==='plot')!;expect(plot.plantedDay).toBe(0);
 w.day=29;h.work={kind:'tend',remaining:1,total:2};expect(workDay(w,h)).toContain('자라는 중');expect(w.landscape.harvests).toBe(0);
 w.day=30;h.work={kind:'tend',remaining:1,total:2};expect(workDay(w,h)).toContain('수확 완료');expect(h.food).toBe(16);expect(w.landscape.harvests).toBe(1);expect(plot.plantedDay).toBeNull();
});
it('cultivation is personal knowledge requiring seed observation, storage and a shelter',()=>{
 const s=setup(),w=data(s).world,h=w.humans[0];h.food=10;h.knowledge=['storage'];
 expect(canExperiment(w,h,'cultivation')).toBe(false);
 w.landscape.sites.find(s=>s.kind==='seeds')!.discoverers.push(h.id);
 w.landscape.structures.push({id:'home',kind:'shelter',position:h.position,progress:3,ownerId:h.id,ownerName:h.name,plantedDay:null,harvests:0});
 expect(canExperiment(w,h,'cultivation')).toBe(true);expect(s.act('human-2','tend')).toBe(false);
 learn(w,h,'cultivation',{method:'experiment'});expect(w.humans[1].knowledge).not.toContain('cultivation');
});
it('floods affect river crops after warning time, without killing characters or destroying inland crops',()=>{
 const s=setup(),d=data(s),w=d.world;
 const i=w.map.tiles.findIndex((t,i)=>t==='grass'&&besideRiver(w.map,{x:i%48,y:Math.floor(i/48)}));
 w.landscape.structures=[{id:'wet',kind:'plot',position:{x:i%48,y:Math.floor(i/48)},progress:3,ownerId:'human-1',ownerName:'아라',plantedDay:0,harvests:0},{id:'dry',kind:'plot',position:{x:22,y:22},progress:3,ownerId:'human-1',ownerName:'아라',plantedDay:0,harvests:0}];
 w.landscape.forecast={kind:'flood',starts:45,ends:75};w.day=44;landscapeDay(d);expect(w.landscape.structures[0].plantedDay).toBe(0);
 w.day=45;landscapeDay(d);expect(w.landscape.structures[0].plantedDay).toBeNull();expect(w.landscape.structures[1].plantedDay).toBe(0);expect(w.humans.every(h=>h.alive&&h.health===100)).toBe(true);
});
it('natural regeneration follows weather and is consistent across time modes',()=>{
 const outputs=[];
 for(const mode of ['daily','life','history'] as const){const s=setup(),d=data(s);d.timeline.mode=mode;d.world.day=49;d.world.resources.fill(0);d.world.landscape.forecast={kind:'bounty',starts:45,ends:75};landscapeDay(d);outputs.push(d.world.resources);}
 expect(outputs[0]).toEqual(outputs[1]);expect(outputs[1]).toEqual(outputs[2]);expect(outputs[0].some(x=>x===3)).toBe(true);
 const d=data(setup());d.world.day=49;d.world.resources.fill(0);d.world.landscape.forecast={kind:'drought',starts:45,ends:75};landscapeDay(d);expect(d.world.resources.every(x=>x===0)).toBe(true);
});
it('chapters require constructed places, living knowledge and actual harvests, not an elapsed date',()=>{
 const s=setup(),d=data(s),w=d.world;w.day=100000;landscapeDay(d);expect(w.landscape.chapter).toBe('foraging');
 for(const [i,h] of w.humans.slice(0,2).entries()){h.knowledge=['storage'];w.landscape.structures.push({id:'s'+i,kind:'shelter',position:h.position,progress:3,ownerId:h.id,ownerName:h.name,plantedDay:null,harvests:0});}
 landscapeDay(d);expect(w.landscape.chapter).toBe('settlement');expect(d.timeline.pending?.id).toBe('chapter-settlement');
 s.acknowledgeEvent();w.landscape.harvests=2;landscapeDay(d);expect(w.landscape.chapter).toBe('settlement');
 w.humans[0].knowledge.push('cultivation');w.humans[1].knowledge.push('cultivation');landscapeDay(d);expect(w.landscape.chapter).toBe('cultivation');expect(d.timeline.pending?.id).toBe('chapter-cultivation');
});
it('migrates v3 saves without changing the person, date, resources or RNG',()=>{
 const s=setup(),old:any=s.snapshot();old.version=3;delete old.world.landscape;delete old.world.technologies.cultivation;for(const h of old.world.humans)delete h.work;
 const restored=Simulation.restore(old).snapshot();expect(restored.version).toBe(4);expect(restored.world.resources).toEqual(old.world.resources);expect(restored.player).toEqual(old.player);expect(restored.randomState).toBe(old.randomState);
});
it('mid-survey restoration reproduces nature, activities and discoveries',()=>{
 const a=setup();a.act('human-1','explore');a.step();const b=Simulation.restore(a.snapshot());
 for(let i=0;i<100;i++)for(const s of [a,b]){s.acknowledgeEvent();s.step();}
 expect(a.snapshot()).toEqual(b.snapshot());
});
it('distant disasters stay non-blocking, while a fishing player receives a forecast pause',async()=>{
 const {dayChance}=await import('./time');let seed=0;while(dayChance(seed,0,930)<.75)seed++;
 const s=setup(),d=data(s);d.seed=seed;d.world.day=42;landscapeDay(d);
 expect(d.world.landscape.forecast?.kind).toBe('flood');expect(d.timeline.pending).toBeNull();
 d.world.humans[0].action='fish';landscapeDay(d);expect(d.timeline.pending?.id).toBe('weather-warning');
 expect(d.world.landscape.weather).toBe('clear');expect(d.world.landscape.forecast?.starts).toBe(45);
});
it('arrival is a travel day, leaving the full stationary survey visible on subsequent days',()=>{
 const s=setup(),w=data(s).world,h=w.humans[0];s.act(h.id,'explore');const travel=h.path.length;expect(travel).toBeGreaterThan(0);
 for(let i=0;i<travel;i++)s.step();expect(h.work?.remaining).toBe(2);
 s.step();expect(h.work?.remaining).toBe(1);s.step();expect(h.work).toBeNull();
});
it('history does not retain a working animation after an unavailable construction attempt',async()=>{
 const {historyDay}=await import('./history');const s=setup(),d=data(s),w=d.world;w.day=29;
 for(const site of w.landscape.sites)site.discoverers=w.humans.map(h=>h.id);
 for(let i=0;i<12;i++)w.landscape.structures.push({id:'home'+i,kind:'shelter',position:{x:20+i%4,y:22+Math.floor(i/4)},progress:3,ownerId:'human-1',ownerName:'아라',plantedDay:null,harvests:0});
 historyDay(d);expect(w.humans.every(h=>h.work===null)).toBe(true);
});
