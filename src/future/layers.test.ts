import {it,expect} from 'vitest';
import {FutureSimulation} from './Simulation';
import {cityMonth,globalMonth} from './layers';
import {economyMonth,worldMonth} from './world';
import {humanDay} from './people';
import {SeededRandom} from '../simulation/random';
import type {State} from './model';
function active(){const sim=new FutureSimulation(2026);sim.choosePolicy(0);sim.acceptAssignment();sim.finishTutorial();return sim;}
it('v2.3: world technology evolves independently; national access controls diffusion',()=>{
 const a=active().snapshot(),b=structuredClone(a);a.nation.metrics.access=0;b.nation.metrics.access=100;
 for(let i=0;i<24;i++){globalMonth(a.global);globalMonth(b.global);worldMonth(a);worldMonth(b);}
 expect(a.global).toEqual(b.global);expect(b.nation.metrics.ai).toBeGreaterThan(a.nation.metrics.ai);
});
it('v2.2: actual conditions trigger construction, no calendar-based replacement, completion is gradual',()=>{
 const a=active().snapshot(),b=structuredClone(a);a.nation.metrics.automation=0;b.nation.metrics.automation=80;
 for(const s of [a,b])cityMonth(s);
 const factory=(s:State)=>s.city.buildings.find(b=>b.kind==='factory')!;
 expect(factory(a).phase).toBe('existing');expect(factory(b).phase).toBe('construction');expect(factory(b).level).toBe(0);expect(factory(b).progress).toBe(0);
 b.day+=31;cityMonth(b);expect(factory(b).progress).toBeGreaterThan(0);expect(factory(b).progress).toBeLessThan(100);expect(b.city.automation).toBe(12);
 for(let m=0;m<18;m++){b.day+=30;cityMonth(b);}expect(factory(b).level).toBeGreaterThan(0);expect(b.city.automation).toBeGreaterThan(12);expect(b.city.history.some(e=>e.text.includes('완공'))).toBe(true);
});
it('v2.3: finished city infrastructure changes learning, recovery, wages and household expenses',()=>{
 const a=active().snapshot(),b=structuredClone(a);b.city.education=100;b.city.green=100;b.city.transit=100;b.city.automation=100;
 const ha=a.population[0],hb=b.population[0];ha.order=hb.order='learn';humanDay(ha,a);humanDay(hb,b);expect(hb.skill).toBeGreaterThan(ha.skill);
 economyMonth(a,new SeededRandom(22));economyMonth(b,new SeededRandom(22));expect(hb.expenses).toBeLessThan(ha.expenses);expect(hb.income).toBeGreaterThan(ha.income);
});
it('v2.3: v20 save migration preserves humans, policy, birth dates and RNG, never invents city history',()=>{
 const s=active();s.advance(60);const current=s.snapshot(),old:Record<string,unknown>={...structuredClone(current),version:20,world:current.nation.metrics};delete old.global;delete old.nation;delete old.city;
 const migrated=FutureSimulation.restore(old).snapshot();expect(migrated.version).toBe(23);expect(migrated.population).toEqual(current.population);expect(migrated.randomState).toBe(current.randomState);expect(migrated.policies).toEqual(current.policies);expect(migrated.city.history).toEqual([]);expect(migrated.global).toEqual(current.global);expect(FutureSimulation.restore(current).snapshot()).toEqual(current);
});
it('v2.2: timelapse is sampled actual monthly state and reading it never advances simulation',()=>{
 const s=active();s.advance(90);const before=s.snapshot(),frames=s.drainCityFrames();expect(frames.length).toBe(3);expect(frames.map(f=>f.day)).toEqual([31,59,90]);expect(frames.at(-1)?.city).toEqual(before.city);expect(s.snapshot()).toEqual(before);expect(s.drainCityFrames()).toEqual([]);
 const replay=FutureSimulation.restore(active().snapshot());for(let d=0;d<90;d++)replay.advance(1);expect(replay.snapshot().city).toEqual(before.city);expect(replay.snapshot().global).toEqual(before.global);expect(replay.snapshot().population).toEqual(before.population);
});
it('v2.3: corrupted layer state rejected without changing the current simulation',()=>{const s=active(),before=s.snapshot(),bad=structuredClone(before);bad.city.buildings[0].progress=NaN;expect(()=>FutureSimulation.restore(bad)).toThrow();expect(s.snapshot()).toEqual(before);});
it('v2.3: unknown world keys and substituted building IDs are rejected',()=>{const s=active().snapshot(),bad=structuredClone(s);bad.global={foo:1,bar:2,baz:3} as unknown as State['global'];expect(()=>FutureSimulation.restore(bad)).toThrow();const city=structuredClone(s);city.city.buildings[0].id='unknown';expect(()=>FutureSimulation.restore(city)).toThrow();});
import {cityPath} from './path';
import {security} from './world';
it('walking paths avoid all building footprints and end at the action location',()=>{const city=active().snapshot().city;const path=cityPath({x:10,y:3},{x:22,y:8},city);expect(path.at(-1)).toEqual({x:22,y:8});for(const p of path)expect(city.buildings.some(b=>p.x>=b.x&&p.x<b.x+b.w&&p.y>=b.y&&p.y<b.y+b.d)).toBe(false);});
it('T06: automation exposure is occupation-specific and retraining improves security',()=>{const s=active().snapshot(),h=s.population[0];h.job='factory';s.nation.metrics.automation=10;const low=security(h,s);s.nation.metrics.automation=90;const factory=security(h,s);h.job='education';const education=security(h,s);expect(factory).toBeLessThan(low);expect(education).toBeGreaterThan(factory);s.rules.training=1;expect(security(h,s)).toBeGreaterThan(education);});
it('a person with zero health cannot be revived by a queued rest action',()=>{const s=active().snapshot(),h=s.population[0];h.health=0;h.order='rest';humanDay(h,s);expect(h.alive).toBe(false);expect(h.deathDay).toBe(1);expect(h.health).toBe(0);});

import {PERSONAL_EVENTS} from './content';
it('retired people do not receive a job-loss crisis solely for being retired',()=>{const s=active().snapshot(),h=s.population[0];h.birthDay=-70*365;h.ageDays=-h.birthDay;h.retired=true;h.employed=false;s.nation.metrics.automation=80;expect(PERSONAL_EVENTS.find(e=>e.id==='P02')!.condition(h,s)).toBe(false);});
