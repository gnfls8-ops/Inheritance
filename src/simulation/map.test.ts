import { describe,it,expect } from 'vitest';
import { toIso,fromIso,findPath,generateMap,walkable } from './map';
import type { TileMap } from './map';
import { SeededRandom } from './random';
import { Simulation } from './Simulation';
describe('isometric map',()=>{
  it('round-trips all tile centers and points inside diamonds',()=>{
    for(let y=0;y<48;y++)for(let x=0;x<48;x++){
      const p=toIso({x,y});expect(fromIso(p)).toEqual({x,y});
      expect(fromIso({x:p.x+8,y:p.y+3})).toEqual({x,y});
    }
  });
  it('creates a repeatable 48×48 region and walkable spawn positions',()=>{
    const a=generateMap(new SeededRandom(2026));expect(a).toEqual(generateMap(new SeededRandom(2026)));
    expect(a.tiles).toHaveLength(48*48);expect(new Set(a.tiles).size).toBe(4);
    expect(a).not.toEqual(generateMap(new SeededRandom(2027)));
    const state=started(2026).snapshot();expect(state.world.humans).toHaveLength(12);
    for(const h of state.world.humans)expect(walkable(a,h.position)).toBe(true);
  });
});
describe('pathfinding',()=>{
  const map:TileMap={width:3,height:3,tiles:['grass','rock','grass','grass','river','grass','grass','grass','grass']};
  it('routes around obstacles with four-neighbor shortest paths',()=>{
    const path=findPath(map,{x:0,y:0},{x:2,y:0});expect(path).toHaveLength(6);
    let prev={x:0,y:0};for(const p of path!){expect(walkable(map,p)).toBe(true);expect(Math.abs(prev.x-p.x)+Math.abs(prev.y-p.y)).toBe(1);prev=p;}
    expect(prev).toEqual({x:2,y:0});
  });
  it('rejects obstacles, out-of-bounds, non-integral and disconnected targets',()=>{
    for(const target of [{x:1,y:0},{x:-1,y:0},{x:.5,y:0},{x:3,y:3}])expect(findPath(map,{x:0,y:0},target)).toBeNull();
    expect(findPath({...map,tiles:['grass','rock','grass','river','rock','river','grass','rock','grass']},{x:0,y:0},{x:2,y:0})).toBeNull();
    expect(findPath(map,{x:0,y:0},{x:0,y:0})).toEqual([]);
  });
});
describe('movement commands',()=>{
  it('queues while paused, moves one tile per step and replays identically',()=>{
    const a=started(2026),b=started(2026);
    for(const sim of [a,b]){
      expect(sim.move('human-1',{x:25,y:25})).toBe(true);
      expect(sim.snapshot().world.humans[0].position).toEqual({x:21,y:22});
      sim.step();expect(sim.snapshot().world.humans[0].path).toHaveLength(6);
      for(let i=0;i<6;i++)sim.step();
      expect(sim.snapshot().world.humans[0].position).toEqual({x:25,y:25});
      expect(sim.snapshot().commands[1]).toEqual({tick:0,type:'move',humanId:'human-1',target:{x:25,y:25}});
    }
    expect(a.snapshot()).toEqual(b.snapshot());
  });
  it('does not record rejected commands and replaces an existing path',()=>{
    const sim=started();expect(sim.move('missing',{x:22,y:22})).toBe(false);
    expect(sim.move('human-1',{x:-1,y:0})).toBe(false);expect(sim.snapshot().commands).toHaveLength(1);
    sim.move('human-1',{x:25,y:25});sim.move('human-1',{x:22,y:22});sim.step();
    expect(sim.snapshot().world.humans[0].position).toEqual({x:22,y:22});expect(sim.snapshot().world.humans[0].path).toEqual([]);
  });
});

function started(seed=2026){const sim=new Simulation(seed);sim.choosePlayer('human-1');return sim;}
