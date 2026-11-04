import { SeededRandom } from './random';
export interface Point { x: number; y: number }
export type Terrain = 'grass' | 'forest' | 'river' | 'rock' | 'sand';
export type Biome='riverland'|'woodland'|'oasis'|'oldcamp';
export const BIOMES={riverland:{name:'굽이치는 강가',description:'물과 낚시 자원이 가까우나 범람에 대비해야 합니다.'},woodland:{name:'깊은 숲 가장자리',description:'열매와 목재가 풍부한 숲에서 길을 찾아 살아갑니다.'},oasis:{name:'사막의 오아시스',description:'풀밭과 샘 주변에 식량이 모이며 모래땅은 회복이 느립니다.'},oldcamp:{name:'잊힌 야영지',description:'이전 집단이 남긴 거처와 돌무더기를 조사할 수 있습니다.'}} as const;
export interface TileMap { biome?:Biome; width: number; height: number; tiles: Terrain[] }
export const TILE_WIDTH = 64, TILE_HEIGHT = 32;
export function toIso({x,y}: Point): Point { return {x:(x-y)*32,y:(x+y)*16}; }
export function fromIso({x,y}: Point): Point { return {x:Math.floor(x/64+y/32+.5),y:Math.floor(y/32-x/64+.5)}; }
export function generateMap(random: SeededRandom): TileMap {
  const biome=(['riverland','woodland','oasis','oldcamp'] as const)[Math.floor(random.next()*4)];
  const bend=3+random.next()*4,offset=Math.floor(random.next()*5);
  const map:TileMap={width:48,height:48,tiles:[],biome};
  for(let y=0;y<48;y++)for(let x=0;x<48;x++){
    const value=random.next(),river=30+offset+Math.round(Math.sin(y/bend)*2);
    const pool=Math.hypot(x-30-offset/2,y-24);
    const water=biome==='oasis'?pool<2.5:Math.abs(x-river)<(biome==='riverland'?2:1);
    map.tiles.push(water?'river':value<.07?'rock':biome==='oasis'?(pool<5?'grass':'sand'):value<(biome==='woodland'?.68:.35)?'forest':'grass');
  }
  // A connected, food-bearing start is guaranteed; all other terrain remains seeded.
  for(let y=20;y<=27;y++)for(let x=19;x<=26;x++)map.tiles[y*48+x]='grass';
  // Two reachable alternative camps let relocation be an actual journey, never a teleport.
  for(let y=28;y<=39;y++)map.tiles[y*48+23]='grass';
  for(let x=27;x<=39;x++)map.tiles[25*48+x]='grass';
  for(const camp of [{x:38,y:25},{x:23,y:38}])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)map.tiles[(camp.y+dy)*48+camp.x+dx]='grass';
  return map;
}
export function walkable(map: TileMap, p: Point): boolean {
  return Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<map.width&&p.y<map.height && ['grass','forest','sand'].includes(map.tiles[p.y*map.width+p.x]);
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
