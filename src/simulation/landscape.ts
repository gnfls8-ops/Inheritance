import type {HumanState,SimulationSnapshot,WorldState} from './model';
import type {Point,TileMap} from './map';
import {walkable,findPath} from './map';
import {dayChance} from './time';
import {remember} from './chronicle';
export type Weather='clear'|'bounty'|'drought'|'flood';
export type Chapter='foraging'|'settlement'|'cultivation';
export const WEATHER_NAMES={clear:'평온',bounty:'풍요',drought:'가뭄',flood:'범람'};
export const CHAPTER_NAMES={foraging:'채집 생활',settlement:'정착지 형성',cultivation:'초기 재배 생활'};
export interface Site {id:string;kind:'berries'|'spring'|'flint'|'seeds';name:string;position:Point;discoverers:string[]}
export interface Structure {id:string;kind:'shelter'|'plot';position:Point;progress:number;ownerId:string;ownerName:string;plantedDay:number|null;harvests:number}
export interface Landscape {sites:Site[];structures:Structure[];weather:Weather;forecast:{kind:Weather;starts:number;ends:number}|null;chapter:Chapter;chapters:Array<{stage:Chapter;day:number}>;harvests:number}
export const distance=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export function besideRiver(map:TileMap,p:Point){return [[1,0],[-1,0],[0,1],[0,-1]].some(([x,y])=>map.tiles[(p.y+y)*map.width+p.x+x]==='river');}
export function initialLandscape(map:TileMap):Landscape{
 const definitions=[['berries','열매 군락',23,20],['spring','맑은 샘',18,24],['flint','쓸 만한 돌 산지',26,25],['seeds','야생 곡물 군락',23,28]] as const;
 const used=new Set<number>();
 const sites:Site[]=definitions.map(([kind,name,x,y],i)=>{
  const points=map.tiles.map((_,n)=>({x:n%48,y:Math.floor(n/48)})).filter(p=>walkable(map,p)&&!used.has(p.y*48+p.x)).sort((a,b)=>distance(a,{x,y})-distance(b,{x,y}));
  const position=points.find(p=>findPath(map,{x:21,y:22},p)!==null)!;used.add(position.y*48+position.x);return{id:'site-'+i,kind,name,position,discoverers:[]};
 });
 const structures:Structure[]=map.biome==='oldcamp'?[{id:'old-camp',kind:'shelter',position:{x:24,y:26},progress:1,ownerId:'past-group',ownerName:'이전 집단',plantedDay:null,harvests:0}]:[];
 if(map.biome==='oldcamp')sites.find(s=>s.kind==='flint')!.name='옛 야영지의 돌 도구 흔적';
 return{sites,structures,weather:'clear',forecast:null,chapter:'foraging',chapters:[{stage:'foraging',day:0}],harvests:0};
}
export function survey(w:WorldState,h:HumanState):string{
 const site=w.landscape.sites.find(s=>distance(s.position,h.position)<=1&&!s.discoverers.includes(h.id));
 if(!site)return '주변 지형 조사 완료 · 새로운 흔적 없음';
 site.discoverers.push(h.id);
 if(site.kind==='berries'){const i=site.position.y*48+site.position.x;w.resources[i]=Math.min(w.map.tiles[i]==='forest'?6:3,w.resources[i]+3);}
 if(site.kind==='spring')h.fatigue=Math.max(0,h.fatigue-12);
 const text=site.name+' 발견'+(site.kind==='berries'?' · 채집할 수 있는 자원 위치 확인':site.kind==='spring'?' · 피로 −12':site.kind==='seeds'?' · 재배 실험의 단서':' · 석기 실험의 단서');
 remember(w,h,{day:w.day+1,kind:'discovery',text});return text;
}
export function nearShelter(w:WorldState,p:Point,radius=2){return w.landscape.structures.some(s=>s.kind==='shelter'&&s.progress>=3&&distance(s.position,p)<=radius);}
export function readyCrop(w:WorldState,s:Structure){return s.kind==='plot'&&s.plantedDay!==null&&w.day-s.plantedDay>=30;}
export function announce(s:SimulationSnapshot,id:string,title:string,important:boolean){
 const e={id,title,day:s.world.day,important};s.timeline.events.push(e);s.timeline.events=s.timeline.events.slice(-200);
 // Never overwrite an outstanding event, and never hide a death summary.
 if(important&&!s.timeline.pending&&s.player.phase!=='summary')s.timeline.pending=e;
}
export function landscapeDay(s:SimulationSnapshot){
 const w=s.world,l=w.landscape,day=w.day;
 if(day>=42&&(day-42)%120===0){
  const n=dayChance(s.seed,Math.floor(day/120),930);
  const kind:Weather=w.map.biome==='oasis'?(n<.3?'bounty':'drought'):n<.45?'bounty':n<.75?'drought':'flood';
  l.forecast={kind,starts:day+3,ends:day+33};
  const player=w.humans.find(h=>h.id===s.player.humanId&&h.alive);
  const exposedCrop=player&&l.structures.some(b=>b.kind==='plot'&&b.ownerId===player.id&&b.plantedDay!==null&&besideRiver(w.map,b.position));
  const personalRisk=player&&(kind==='flood'&&(exposedCrop||player.action==='fish')||kind==='drought'&&player.food===0&&player.hunger>=75);
  announce(s,'weather-warning',WEATHER_NAMES[kind]+' 예고 · 3일 뒤 시작 · '+(kind==='flood'?'강가 식량과 밭이 피해를 입을 수 있습니다.':kind==='drought'?'자연 회복과 수확이 줄어듭니다.':'자연 회복과 수확이 늘어납니다.'),!!personalRisk&&s.player.phase==='playing');
 }
 l.weather=l.forecast&&day>=l.forecast.starts&&day<l.forecast.ends?l.forecast.kind:'clear';
 if(day%7===0){
  w.resources=w.resources.map((value,i)=>{
   const tile=w.map.tiles[i];if(tile!=='grass'&&tile!=='forest'&&tile!=='sand')return value;
   const p={x:i%48,y:Math.floor(i/48)};
   const growth=tile==='sand'&&day%28!==0?0:l.weather==='drought'?0:(w.technologies.storage.adopted?2:1)+(l.weather==='bounty'?2:0);
   return Math.max(0,Math.min(tile==='forest'?6:tile==='sand'?1:3,value+growth-(l.weather==='flood'&&besideRiver(w.map,p)?3:0)));
  });
 }
 if(l.weather==='flood'&&l.forecast?.starts===day){
  let lost=0;for(const plot of l.structures)if(plot.kind==='plot'&&plot.plantedDay!==null&&besideRiver(w.map,plot.position)){plot.plantedDay=null;lost++;}
  announce(s,'flood-impact',lost?'범람으로 강가 밭 '+lost+'곳의 작물이 유실됐습니다.':'강물이 불어 강가 채집 자원이 줄어듭니다.',false);
 }
 const living=w.humans.filter(h=>h.alive),shelters=l.structures.filter(b=>b.kind==='shelter'&&b.progress===3).length;
 const next=l.chapter==='foraging'&&shelters>=2&&living.filter(h=>h.knowledge.includes('storage')).length>=2?'settlement':
 l.chapter==='settlement'&&l.harvests>=2&&living.filter(h=>h.knowledge.includes('cultivation')).length>=2?'cultivation':null;
 if(next){l.chapter=next;l.chapters.push({stage:next,day});announce(s,'chapter-'+next,CHAPTER_NAMES[next]+' · 사람들의 생활 방식이 달라졌습니다.',true);
  const h=living.find(h=>h.id===s.player.humanId);if(h)remember(w,h,{day,kind:'world',text:CHAPTER_NAMES[next]+' 시작 · 공동체에 남긴 변화'});}
}
