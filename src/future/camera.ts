/** Frame-rate independent dead-zone following, independent of simulation state/RNG. */
export function followCamera(camera:{x:number;y:number},subject:{x:number;y:number},width:number,height:number,dt:number,force=false){
 const sx=subject.x+camera.x,sy=subject.y+camera.y;
 const dx=force?width*.5-sx:sx<width*.32?width*.32-sx:sx>width*.68?width*.68-sx:0;
 const dy=force?height*.48-sy:sy<height*.32?height*.32-sy:sy>height*.62?height*.62-sy:0;
 const alpha=1-Math.exp(-Math.max(0,dt)*7);
 return{x:camera.x+dx*alpha,y:camera.y+dy*alpha};
}
