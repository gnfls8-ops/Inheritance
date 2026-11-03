import { describe, expect, it } from 'vitest';
import { Simulation } from './Simulation';
import { SeededRandom } from './random';
import { GameClock } from './clock';

describe('seeded random', () => {
  it('repeats the same sequence for the same seed, including seed zero', () => {
    for (const seed of [0, 2026, 0xffffffff]) {
      const a = new SeededRandom(seed), b = new SeededRandom(seed);
      for (let i=0; i<1000; i++) {
        const value = a.next(); expect(value).toBe(b.next());
        expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThan(1);
      }
    }
  });
  it('distinguishes seeds and resumes exactly from stored state', () => {
    const random = new SeededRandom(42);
    expect(random.next()).not.toBe(new SeededRandom(43).next());
    const resumed = new SeededRandom(random.state);
    expect(random.next()).toBe(resumed.next());
  });
  it('rejects invalid seeds', () => {
    for (const seed of [-1, 0x100000000, NaN, 1.2]) expect(() => started(seed)).toThrow();
  });
});
describe('daily simulation', () => {
  it('replays identical daily commands and stores zero-based tick numbers', () => {
    const a = started(42), b = started(42);
    for (let i=0; i<365; i++) { a.step(); b.step(); }
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.snapshot().world.day).toBe(365);
    expect(a.snapshot().commands[365]).toEqual({tick:364,type:'wait'});
    expect(a.snapshot().randomState).not.toBe(started(42).snapshot().randomState);
  });
  it('isolates snapshots from external mutation', () => {
    const sim = started(); const state = sim.snapshot();
    state.world.day = 99; state.commands.push({tick:0,type:'wait'});
    expect(sim.snapshot().world.day).toBe(0); expect(sim.snapshot().commands).toHaveLength(1);
  });
});
describe('game clock', () => {
  it('starts paused and advances only complete days', () => {
    const clock = new GameClock(), sim = started();
    expect(clock.advance(10000, () => sim.step())).toBe(0);
    clock.setPaused(false);
    expect(clock.advance(999, () => sim.step())).toBe(0);
    expect(clock.advance(1, () => sim.step())).toBe(1);
    expect(sim.snapshot().world.day).toBe(1);
  });
  it.each([1,2,4] as const)('runs at %s× independent of frame partition', speed => {
    const a = new GameClock(), b = new GameClock();
    const sa = started(7), sb = started(7);
    for (const c of [a,b]) { c.setPaused(false); c.setSpeed(speed); }
    a.advance(10000, () => sa.step());
    for (let i=0;i<100;i++) b.advance(100, () => sb.step());
    expect(sa.snapshot()).toEqual(sb.snapshot()); expect(sa.snapshot().world.day).toBe(10*speed);
  });
  it('discards partial time on pause and never catches up paused time', () => {
    const c = new GameClock(); let days=0; const step=()=>days++;
    c.setPaused(false); c.advance(900,step); c.setPaused(true);
    c.advance(60000,step); c.setPaused(false); c.advance(100,step);
    expect(days).toBe(0); c.advance(900,step); expect(days).toBe(1);
  });
  it('changes speed while preserving already accrued game time', () => {
    const c = new GameClock(); let days=0; c.setPaused(false);
    c.advance(500,()=>days++); c.setSpeed(2); c.advance(250,()=>days++);
    expect(days).toBe(1);
  });
  it('rejects invalid elapsed times', () => {
    const c = new GameClock();
    for (const ms of [-1,NaN,Infinity]) expect(()=>c.advance(ms,()=>{})).toThrow();
  });
});

function started(seed=2026){const sim=new Simulation(seed);sim.choosePlayer('human-1');return sim;}
