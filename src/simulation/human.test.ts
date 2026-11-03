import { describe,expect,it } from 'vitest';
import { Simulation } from './Simulation';
import { planAction,scoreActions,stepHuman } from './human';
import { SeededRandom } from './random';
function fixture(){
  const world=started(2026).snapshot().world;
  const h=world.humans[0];
  return {world,h,random:new SeededRandom(42)};
}
describe('Utility AI and needs',()=>{
  it('prioritizes food when hungry and rest when exhausted or injured',()=>{
    const {h}=fixture();h.hunger=95;h.food=0;h.fatigue=10;
    let scores=scoreActions(h,true,true);expect(scores.gather).toBeGreaterThan(scores.explore);expect(scores.gather).toBeGreaterThan(scores.socialize);expect(scores.gather).toBeGreaterThan(scores.rest);
    h.fatigue=100;h.health=0;scores=scoreActions(h,true,true);expect(scores.gather).toBeGreaterThan(scores.rest);
    h.hunger=5;h.food=4;h.fatigue=95;h.health=30;
    scores=scoreActions(h,true,true);expect(scores.rest).toBeGreaterThan(scores.gather);expect(scores.rest).toBeGreaterThan(scores.explore);
  });
  it('uses continuous traits as weights rather than fixed personality bans',()=>{
    const {h}=fixture();h.traits.curiosity=0;h.traits.riskTaking=0;h.traits.stability=100;
    const cautious=scoreActions(h,true,true).explore;
    expect(Number.isFinite(cautious)).toBe(true);
    h.traits.curiosity=100;h.traits.riskTaking=100;
    expect(scoreActions(h,true,true).explore).toBeGreaterThan(cautious);
    h.traits.sociability=0;const quiet=scoreActions(h,true,true).socialize;h.traits.sociability=100;
    expect(scoreActions(h,true,true).socialize).toBeGreaterThan(quiet);
  });
  it('hungry autonomous human gathers available food and actually reduces hunger',()=>{
    const {world,h,random}=fixture();h.hunger=90;h.food=0;h.fatigue=0;
    const initial=world.resources[h.position.y*48+h.position.x];
    stepHuman(world,h,random);
    expect(h.action).toBe('gather');expect(h.hunger).toBeLessThan(90);expect(h.food).toBe(2);
    expect(world.resources[h.position.y*48+h.position.x]).toBe(initial-3);
  });
  it('manual rest wins over AI, restores fatigue and returns to autonomy',()=>{
    const {world,h,random}=fixture();h.fatigue=90;h.health=60;h.hunger=10;
    expect(planAction(world,h,'rest',random)).toBe(true);h.control='player';
    stepHuman(world,h,random);expect(h.fatigue).toBe(63);expect(h.health).toBeGreaterThan(60);expect(h.control).toBe('auto');
  });
  it('social contact changes both people’s needs and relationship values',()=>{
    const {world,h,random}=fixture(),other=world.humans[1];other.position={...h.position};h.loneliness=80;other.loneliness=80;
    expect(planAction(world,h,'socialize',random)).toBe(true);h.control='player';
    stepHuman(world,h,random);
    expect(h.relationships[other.id]).toEqual({familiarity:8,trust:5});expect(other.relationships[h.id]).toEqual({familiarity:8,trust:5});
    expect(h.loneliness).toBeLessThan(80);expect(other.loneliness).toBeLessThan(80);
  });
  it('resource scarcity cannot create food or negative resource amounts',()=>{
    const {world,h,random}=fixture();world.resources.fill(0);h.food=0;h.hunger=90;h.action='gather';h.control='player';
    stepHuman(world,h,random);expect(h.food).toBe(0);expect(world.resources.every(n=>n===0)).toBe(true);expect(h.health).toBeLessThan(100);
    expect(planAction(world,h,'gather',random)).toBe(false);
  });
  it('exploration records visited ground after reachable tile movement',()=>{
    const {world,h,random}=fixture();const start={...h.position};
    expect(planAction(world,h,'explore',random)).toBe(true);h.control='player';const length=h.path.length;
    for(let i=0;i<length+2;i++)stepHuman(world,h,random);
    expect(h.position).not.toEqual(start);expect(h.visited.length).toBeGreaterThan(1);expect(h.control).toBe('auto');
  });
});
describe('player intervention and multi-day simulation',()=>{
  it('queues one action, cancels it without time advancing, and logs commands',()=>{
    const sim=started();expect(sim.act('human-1','explore')).toBe(true);
    let h=sim.snapshot().world.humans[0];expect(h.control).toBe('player');expect(h.path.length).toBeGreaterThan(0);
    expect(sim.resumeAuto('human-1')).toBe(true);h=sim.snapshot().world.humans[0];expect(h.control).toBe('auto');expect(h.path).toEqual([]);
    expect(sim.snapshot().world.day).toBe(0);expect(sim.snapshot().commands.map(c=>c.type)).toEqual(['choose','action','auto']);
    expect(sim.act('missing','rest')).toBe(false);expect(sim.resumeAuto('missing')).toBe(false);
  });
  it('creates varied reproducible traits, and autonomous people do not all stand still',()=>{
    const sim=started(42), before=sim.snapshot();
    expect(new Set(before.world.humans.map(h=>JSON.stringify(h.traits))).size).toBe(12);
    for(let i=0;i<20;i++)sim.step();
    const after=sim.snapshot();expect(after.world.humans.some((h,i)=>JSON.stringify(h.position)!==JSON.stringify(before.world.humans[i].position))).toBe(true);
    expect(after.world.activityLog.length).toBeGreaterThan(0);
  });
  it('replays a full year with player interventions and keeps state bounded',()=>{
    const a=started(2026),b=started(2026);
    for(let day=0;day<365;day++){
      for(const sim of [a,b]){
        if(day%23===0)sim.act('human-1','rest');
        if(day%31===0)sim.act('human-1','explore');
        if(day%47===0)sim.resumeAuto('human-1');
        sim.acknowledgeEvent();sim.step();
      }
    }
    expect(a.snapshot()).toEqual(b.snapshot());
    const world=a.snapshot().world;expect(world.activityLog.length).toBeLessThanOrEqual(100);
    for(const h of world.humans){for(const value of [h.health,h.hunger,h.fatigue,h.loneliness]){expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(100);}expect(h.food).toBeGreaterThanOrEqual(0);}
    world.resources.forEach((n,i)=>{expect(n).toBeGreaterThanOrEqual(0);expect(n).toBeLessThanOrEqual(world.map.tiles[i]==='forest'?6:3);});
  });
});

function started(seed=2026){const sim=new Simulation(seed);sim.choosePlayer('human-1');return sim;}
