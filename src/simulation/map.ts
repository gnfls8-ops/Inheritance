import { SeededRandom } from './random';
export interface Point { x: number; y: number }
export type Terrain = 'grass' | 'forest' | 'river' | 'rock';
export interface TileMap { width: number; height: number; tiles: Terrain[] }
export const TILE_WIDTH = 64, TILE_HEIGHT = 32;
export function toIso({x,y}: Point): Point { return {x:(x-y)*32,y:(x+y)*16}; }
export function fromIso({x,y}: Point): Point { return {x:Math.floor(x/64+y/32+.5),y:Math.floor(y/32-x/64+.5)}; }
export function generateMap(random: SeededRandom): TileMap {
  const map: TileMap = {width:48,height:48,tiles:[]};
  for(let y=0;y<48;y++) for(let x=0;x<48;x++) {
    const river = 31+Math.round(Math.sin(y/7)*3);
    const value = random.next();
    map.tiles.push(Math.abs(x-river)<2 ? 'river' : value<.08 ? 'rock' : value<.35 ? 'forest':'grass');
  }
  // Clear a modest starting area, leaving the rest of the region untouched.
  for(let y=20;y<=27;y++) for(let x=19;x<=26;x++) map.tiles[y*48+x]='grass';
  return map;
}
export function walkable(map: TileMap, p: Point): boolean {
  return Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<map.width&&p.y<map.height && ['grass','forest'].includes(map.tiles[p.y*map.width+p.x]);
}
/** Deterministic four-neighbor BFS. Returned route excludes the origin. */
export function findPath(map: TileMap, start: Point, goal: Point): Point[] | null {
  if(!walkable(map,start)||!walkable(map,goal)) return null;
  const key=(p:Point)=>p.y*map.width+p.x;
  const queue:Point[]=[start], parents=new Map<number,Point|null>([[key(start),null]]);
  for(let i=0;i<queue.length;i++) {
    const current=queue[i];
    if(key(current)===key(goal)) {
      const route:Point[]=[]; let at=current;
      while(parents.get(key(at))) { route.push(at); at=parents.get(key(at))!; }
      return route.reverse();
    }
    for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const next={x:current.x+dx,y:current.y+dy};
      if(walkable(map,next)&&!parents.has(key(next))) {parents.set(key(next),current);queue.push(next);}
    }
  }
  return null;
}
