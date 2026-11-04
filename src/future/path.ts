import type {CityLayer} from './model';
type Point={x:number;y:number};
/** Visual routing only. Occupied building footprints are impassable. */
export function cityPath(start:Point,end:Point,city:CityLayer):Point[]{
 const blocked=new Set<number>();for(const b of city.buildings)for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.d;y++)blocked.add(y*30+x);
 const cell=(p:Point)=>Math.max(0,Math.min(29,Math.round(p.y)))*30+Math.max(0,Math.min(29,Math.round(p.x))),from=cell(start),to=cell(end),queue=[from],parents=new Map<number,number>();parents.set(from,-1);
 for(let n=0;n<queue.length;n++){const current=queue[n];if(current===to)break;const x=current%30,y=Math.floor(current/30);for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy,next=ny*30+nx;if(nx<0||nx>=30||ny<0||ny>=30||blocked.has(next)||parents.has(next))continue;parents.set(next,current);queue.push(next);}}
 if(!parents.has(to))return[];
 const route:Point[]=[];let cursor=to;while(cursor!==from){route.push({x:cursor%30,y:Math.floor(cursor/30)});cursor=parents.get(cursor)!;}return route.reverse();
}
