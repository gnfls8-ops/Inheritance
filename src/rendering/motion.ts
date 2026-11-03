import type { Point } from '../simulation/map';
/** Visual-only arc-length interpolation. Never mutates simulation positions or consumes RNG. */
export class MotionTrack {
  position:Point;
  private route:Point[]=[];
  private index=0;
  private velocity=0;
  constructor(position:Point){this.position={...position};}
  get moving(){return this.index<this.route.length;}
  retarget(points:Point[],seconds:number){
    const remaining=this.route.slice(this.index);
    this.route=[...remaining,...points].filter((p,i,a)=>i===0||p.x!==a[i-1].x||p.y!==a[i-1].y);
    this.index=0;let length=0,previous=this.position;
    for(const p of this.route){length+=Math.hypot(p.x-previous.x,p.y-previous.y);previous=p;}
    this.velocity=length/Math.max(.1,seconds);
  }
  advance(seconds:number,paused=false):Point {
    if(paused||!Number.isFinite(seconds)||seconds<=0)return this.position;
    let distance=this.velocity*seconds;
    while(this.index<this.route.length){
      const target=this.route[this.index],dx=target.x-this.position.x,dy=target.y-this.position.y,length=Math.hypot(dx,dy);
      if(length<=distance){this.position={...target};distance-=length;this.index++;}
      else{this.position={x:this.position.x+dx/length*distance,y:this.position.y+dy/length*distance};break;}
    }
    return this.position;
  }
}
