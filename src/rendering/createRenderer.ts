import {lifeStage,STAGES} from '../simulation/life';
import {ACTION_LABELS} from '../simulation/human';
import {readyCrop} from '../simulation/landscape';
import { Application, Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import type { Spritesheet } from 'pixi.js';
import type { SimulationSnapshot, Speed } from '../simulation/model';
import { toIso, fromIso, findPath } from '../simulation/map';
import type { Point } from '../simulation/map';
import { MotionTrack } from './motion';
export interface Playback {paused:boolean;speed:Speed}
export interface MapRenderer {update(state:SimulationSnapshot,selected:string|null,playback:Playback):void;center():void;follow(enabled:boolean):void;destroy():void}
interface Actor {node:Container;body:Sprite;axe:Sprite;basket:Sprite;fire:Sprite;marker:Graphics;label:Text;motion:MotionTrack;tile:Point;age:number;facing:'front'|'back';flip:number;dying:boolean;phase:number}
/** Pixel atlas, animated presentation, and input. Simulation remains fixed-tick and deterministic. */
export async function createRenderer(host:HTMLElement,initial:SimulationSnapshot,onSelect:(id:string)=>void,onMove:(p:Point)=>void):Promise<MapRenderer>{
 const sheet=await Assets.load<Spritesheet>(`${import.meta.env.BASE_URL}art/inheritance.json`);
 for(const texture of Object.values(sheet.textures))texture.source.scaleMode='nearest';
 const app=new Application();
 await app.init({resizeTo:host,background:0x182b28,antialias:false,resolution:host.clientWidth<900?1:Math.min(window.devicePixelRatio||1,1.5),autoDensity:true,preference:'webgl'});
 host.appendChild(app.canvas);app.canvas.style.touchAction='none';app.canvas.setAttribute('aria-label','살아 움직이는 골짜기. 드래그와 핀치로 탐색하고 인물을 눌러 관찰하세요.');
 const scene=new Container(),ground=new Container(),water=new Container(),route=new Graphics(),depth=new Container(),atmosphere=new Container();
 depth.sortableChildren=true;scene.addChild(ground,water,route,depth,atmosphere);app.stage.addChild(scene);
 let seasonPhase=(initial.world.day%365)/365;
 let state=initial,selected:string|null=null,playback:Playback={paused:true,speed:1},following=false,elapsed=0,visualDay=initial.world.day;
 let mapSignature=JSON.stringify(initial.world.map),previousSeed=initial.seed;
 const actors=new Map<string,Actor>(),trees:Sprite[]=[],ripples:Sprite[]=[],props:Container[]=[],fires:Sprite[]=[];
 const constructions=new Map<string,Sprite>(),landmarks=new Map<string,Sprite>();
 const treeBase=new Map<Sprite,number>();
 function sprite(key:string,x:number,y:number,anchorX=.5,anchorY=1){const s=new Sprite(sheet.textures[key]);s.anchor.set(anchorX,anchorY);s.position.set(x,y);return s;}
 function drawWorld(){
  ground.removeChildren().forEach(n=>n.destroy());water.removeChildren().forEach(n=>n.destroy());
  props.splice(0).forEach(n=>n.destroy({children:true}));trees.length=0;ripples.length=0;fires.length=0;treeBase.clear();
  const map=state.world.map;
  for(let sum=0;sum<map.width+map.height-1;sum++)for(let x=0;x<map.width;x++){
   const y=sum-x;if(y<0||y>=map.height)continue;
   const type=map.tiles[y*48+x],p=toIso({x,y}),variation=(x*13+y*7)%4;
   const tile=sprite(`${type==='river'?'water':type==='rock'?'rockfloor':type==='sand'?'rockfloor':type}${variation}`,p.x,p.y,.5,.5);tile.width=66;tile.height=33;if(type==='sand')tile.tint=0xe3bb76;ground.addChild(tile);
   if(type==='sand'&&(x+y)%3===0){const dune=new Graphics().moveTo(-15,1).quadraticCurveTo(0,-5,15,1).stroke({color:0xf1cc83,width:2,alpha:.7});dune.position.set(p.x,p.y);ground.addChild(dune);}
   if(type==='river'){
    const shimmer=sprite(`water${(variation+1)%4}`,p.x,p.y,.5,.5);shimmer.alpha=.15;water.addChild(shimmer);ripples.push(shimmer);
    // Shallow banks follow the actual navigable tile boundary.
    const edge=new Graphics();let hasEdge=false;
    for(const [dx,dy,ax,ay,bx,by] of [[-1,0,-32,0,0,-16],[0,-1,0,-16,32,0],[1,0,32,0,0,16],[0,1,0,16,-32,0]]){
     if(x+dx>=0&&y+dy>=0&&x+dx<48&&y+dy<48&&map.tiles[(y+dy)*48+x+dx]!=='river'){edge.moveTo(ax,ay).lineTo(bx,by).stroke({color:0xb7ae7e,width:5,alpha:.6});hasEdge=true;}
    }
    if(hasEdge){edge.position.set(p.x,p.y);ground.addChild(edge);}else edge.destroy();
   }
   if(type==='forest'){
    const tree=sprite(`tree${(x*7+y*11)%6}`,p.x+(x%3-1)*4,p.y+4,.5,.94);const scale=.48+((x*3+y)%5)*.035;tree.scale.set(scale);tree.zIndex=p.y;depth.addChild(tree);trees.push(tree);treeBase.set(tree,scale);props.push(tree);
   }else if(type==='rock'){
    const rock=sprite(`rock${variation}`,p.x,p.y+5,.5,.85);rock.scale.set(.7);rock.zIndex=p.y;depth.addChild(rock);props.push(rock);
   }else if(type==='grass'&&(x*19+y*11)%13===0){const shrub=sprite(`shrub${variation%3}`,p.x,p.y,.5,.85);shrub.scale.set(.48);shrub.zIndex=p.y;depth.addChild(shrub);props.push(shrub);}
  }
  for(const tile of [{x:20,y:25},{x:25,y:21}]){const p=toIso(tile),fire=sprite('fire0',p.x,p.y,.5,.85);fire.scale.set(.8);fire.zIndex=p.y;depth.addChild(fire);fires.push(fire);props.push(fire);}
  ground.updateCacheTexture();
 }
 function reconcile(reset=false){
  const w=state.world;
  const liveIds=new Set(w.landscape.structures.map(b=>b.id));
  for(const [id,prop] of constructions)if(!liveIds.has(id)){prop.destroy();constructions.delete(id);}
  for(const building of w.landscape.structures){
   const p=toIso(building.position),key=building.kind==='shelter'?(building.progress>=3?'shelter0':'scaffold'):building.plantedDay===null?'crop0':readyCrop(w,building)?'crop2':'crop1';
   let prop=constructions.get(building.id);if(!prop){prop=sprite(key,p.x,p.y+5,.5,.9);prop.scale.set(building.kind==='shelter'?.65:.85);depth.addChild(prop);constructions.set(building.id,prop);}
   prop.texture=sheet.textures[key];prop.position.set(p.x,p.y+5);prop.zIndex=p.y-4;
  }
  for(const site of w.landscape.sites){
   let prop=landmarks.get(site.id);const p=toIso(site.position),key=site.kind==='spring'?'spring':site.kind==='flint'?'rock0':site.kind==='seeds'?'crop2':'shrub1';
   if(!prop){prop=sprite(key,p.x,p.y,.5,.85);prop.scale.set(.6);depth.addChild(prop);landmarks.set(site.id,prop);}
   prop.texture=sheet.textures[key];prop.position.set(p.x,p.y);prop.zIndex=p.y;prop.alpha=site.discoverers.includes(state.player.humanId??'')?1:.65;
  }

  const living=new Set(state.world.humans.filter(h=>h.alive).map(h=>h.id));
  for(const [id,a] of actors)if(!living.has(id))a.dying=true;
  for(const [i,h] of state.world.humans.filter(h=>h.alive).entries()){
   let a=actors.get(h.id);const p=toIso(h.position);
   if(!a){const node=new Container(),body=sprite(`human${Number(h.id.replace('human-',''))%3}-front-idle0`,0,0,.5,.93),marker=new Graphics(),label=new Text({text:h.name,style:{fontFamily:'sans-serif',fontSize:10,fill:0xf3ead4,stroke:{color:0x1b2c22,width:3}}});label.anchor.set(.5,1);label.y=-55;const axe=sprite('axe',10,-17,.5,.5),basket=sprite('basket',-13,1,.5,.9),fire=sprite('fire0',20,4,.5,.9);axe.scale.set(.8);basket.scale.set(.7);fire.scale.set(.5);node.addChild(marker,fire,body,basket,axe,label);node.position.set(p.x,p.y);depth.addChild(node);a={node,body,axe,basket,fire,marker,label,motion:new MotionTrack(p),tile:{...h.position},age:0,facing:'front',flip:1,dying:false,phase:i*.7};actors.set(h.id,a);}
   a.dying=false;
   if(reset){a.motion=new MotionTrack(p);a.node.position.set(p.x,p.y);a.tile={...h.position};}
   else if(a.tile.x!==h.position.x||a.tile.y!==h.position.y){
    const path=findPath(state.world.map,a.tile,h.position);
    if(path)a.motion.retarget(path.map(toIso),Math.max(.15,.95/playback.speed));
    else{a.motion=new MotionTrack(p);a.node.alpha=0;a.age=0;}
    a.tile={...h.position};
   }
   a.marker.clear();
   if(h.id===selected)a.marker.ellipse(0,0,12,6).stroke({color:0xe9cd8a,width:1.5,alpha:.9});
   if(h.id===state.player.humanId)a.marker.poly([-3,-50,0,-54,3,-50,0,-47]).fill(0xaddde0);
   a.label.visible=h.id===selected||h.id===state.player.humanId;a.label.text=h.name+' · '+STAGES[lifeStage(h)]+(h.id===state.player.humanId?' · 나':'')+(h.work?'\n'+ACTION_LABELS[h.work.kind]+' '+(h.work.total-h.work.remaining)+'/'+h.work.total:'');
  }
  route.clear();const h=state.world.humans.find(h=>h.id===selected&&h.alive);
  if(h)for(const tile of h.path){const p=toIso(tile);route.ellipse(p.x,p.y,2.5,1.3).fill({color:0xe5cd92,alpha:.55});}
 }
 let cameraInitialized=false;
 function center(){const h=state.world.humans.find(h=>h.id===selected&&h.alive);const p=h?actors.get(h.id)?.motion.position??toIso(h.position):toIso({x:23,y:23});const scale=host.clientWidth<500?1.05:1.3;scene.scale.set(scale);scene.position.set(host.clientWidth/2-p.x*scale,host.clientHeight/2-p.y*scale);cameraInitialized=true;}
 const rain=new Graphics();atmosphere.addChild(rain);
 const cloud=new Graphics();for(let i=0;i<7;i++)cloud.ellipse(i*155-400,(i%3)*95-130,170,65).fill({color:0x102922,alpha:.025});atmosphere.addChild(cloud);atmosphere.eventMode='none';
 function tick(){
  const dt=Math.min(app.ticker.deltaMS/1000,.1),running=!playback.paused;
  if(running)elapsed+=dt;
  visualDay+=(state.world.day-visualDay)*(1-Math.exp(-dt*3));
  const targetSeason=(state.world.day%365)/365;const seasonDelta=((targetSeason-seasonPhase+1.5)%1)-.5;seasonPhase=(seasonPhase+seasonDelta*(1-Math.exp(-dt*2))+1)%1;
  const season=seasonPhase;
  const palettes=[0xf1f4df,0xffffff,0xd8b77b,0xc5d4cd],phase=season*4,from=palettes[Math.floor(phase)%4],to=palettes[(Math.floor(phase)+1)%4],mix=phase%1;
  const seasonal=[16,8,0].reduce((color,shift)=>color|(Math.round(((from>>shift)&255)*(1-mix)+((to>>shift)&255)*mix)<<shift),0);
  const weather=state.world.landscape.weather;
  ground.tint=weather==='drought'?0xd5b37c:weather==='bounty'?0xd1edb3:weather==='flood'?0xb4c7d2:seasonal;
  rain.clear();
  if(weather==='flood')for(let n=0;n<90;n++){const x=((n*137+elapsed*80)%2400)-1200,y=((n*89+elapsed*230)%1600);rain.moveTo(x,y).lineTo(x-4,y+15).stroke({color:0xc2d7df,width:1,alpha:.4});}

  for(let i=0;i<trees.length;i++){const tree=trees[i];tree.tint=seasonal;const base=treeBase.get(tree)!;tree.skew.x=Math.sin(elapsed*.75+i*1.9)*.014;tree.scale.y=base*(1+Math.sin(elapsed+i)*.003);}
  for(let i=0;i<ripples.length;i++){ripples[i].alpha=.12+Math.sin(elapsed*1.7+i*.6)*.1;}
  for(let i=0;i<fires.length;i++){fires[i].visible=state.world.technologies.fire.adopted;fires[i].texture=sheet.textures[`fire${Math.floor(elapsed*9+i)%6}`];}
  cloud.position.set(Math.sin(elapsed/18)*250,Math.cos(elapsed/29)*130+650);
  let i=0;
  for(const [id,a] of actors){
   a.age+=dt;
   if(a.dying){a.node.alpha=Math.max(0,a.node.alpha-dt*1.6);if(a.node.alpha===0){a.node.destroy({children:true});actors.delete(id);}continue;}
   const h=state.world.humans.find(h=>h.id===id)!;const before={...a.motion.position};const pos=a.motion.advance(dt,playback.paused);const dx=pos.x-before.x,dy=pos.y-before.y;
   const moving=a.motion.moving||Math.abs(dx)+Math.abs(dy)>.001;
   if(Math.abs(dx)+Math.abs(dy)>.001){a.facing=dy<0?'back':'front';if(Math.abs(dx)>.01)a.flip=dx<0?-1:1;}
   const action=moving?'walk':h.work?(h.work.kind==='explore'?'survey':h.work.kind):h.action==='explore'?'survey':['fish','build','tend'].includes(h.action)?h.action:h.action==='rest'?'rest':h.action==='gather'?'work':(h.action==='socialize'||h.action==='observe')?'talk':'idle';
   const frame=Math.floor((elapsed*(moving?9:action==='work'?7:3)+a.phase))%6;
   a.axe.visible=h.knowledge.includes('stone')&&(h.action==='gather'||moving);a.axe.x=a.flip*11;a.axe.rotation=Math.sin(elapsed*7+a.phase)*(h.action==='gather'?.3:.1);
   a.basket.visible=h.knowledge.includes('storage')&&h.food>0;
   a.fire.visible=h.knowledge.includes('fire')&&!moving&&h.food>0;a.fire.texture=sheet.textures[`fire${Math.floor(elapsed*9+a.phase)%6}`];
   a.body.texture=sheet.textures[`human${Number(h.id.replace('human-',''))%3}-${a.facing}-${action}${frame}`];const size=lifeStage(h)==='child'?.66:lifeStage(h)==='youth'?.85:1;a.body.scale.set(a.flip*size,size);a.body.tint=lifeStage(h)==='elder'?0xd8d2c5:0xffffff;
   a.node.position.set(pos.x,pos.y);a.node.zIndex=pos.y;a.node.alpha=Math.min(1,a.age*2);
   // Canopies soften near the observed human so the subject remains readable.
   i++;
  }
  const focus=selected?actors.get(selected):undefined;
  for(const tree of trees){tree.alpha=focus&&Math.abs(tree.x-focus.node.x)<35&&tree.y>focus.node.y&&tree.y-focus.node.y<70?.42:1;}
  if(following&&focus){const tx=host.clientWidth/2-focus.node.x*scene.scale.x,ty=host.clientHeight/2-focus.node.y*scene.scale.y;const k=1-Math.exp(-dt*7);scene.x+=(tx-scene.x)*k;scene.y+=(ty-scene.y)*k;}
 }
 const pointers=new Map<number,Point>();let origin:Point|null=null,moved=false,pinch=0;
 function local(e:PointerEvent|WheelEvent){const r=app.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 function zoom(factor:number,p:Point){const x=(p.x-scene.x)/scene.scale.x,y=(p.y-scene.y)/scene.scale.y;const scale=Math.max(.3,Math.min(3,scene.scale.x*factor));scene.scale.set(scale);scene.position.set(p.x-x*scale,p.y-y*scale);}
 const down=(e:PointerEvent)=>{if(e.button!==0)return;const p=local(e);pointers.set(e.pointerId,p);app.canvas.setPointerCapture(e.pointerId);origin=p;moved=pointers.size>1;pinch=0;};
 const move=(e:PointerEvent)=>{const old=pointers.get(e.pointerId);if(!old)return;const p=local(e);pointers.set(e.pointerId,p);if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)zoom(d/pinch,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});pinch=d;moved=true;return;}if(origin&&Math.hypot(p.x-origin.x,p.y-origin.y)>5)moved=true;if(moved){scene.x+=p.x-old.x;scene.y+=p.y-old.y;}};
 const up=(e:PointerEvent)=>{if(!pointers.has(e.pointerId))return;const p=local(e);pointers.delete(e.pointerId);if(e.type==='pointerup'&&!moved&&origin){const w={x:(p.x-scene.x)/scene.scale.x,y:(p.y-scene.y)/scene.scale.y};const hit=[...actors.entries()].filter(([,a])=>!a.dying).sort((a,b)=>b[1].node.y-a[1].node.y).find(([,a])=>Math.abs(a.node.x-w.x)<13&&w.y>=a.node.y-48&&w.y<=a.node.y+6);if(hit)onSelect(hit[0]);else onMove(fromIso(w));}moved=true;pinch=0;if(!pointers.size)origin=null;};
 const wheel=(e:WheelEvent)=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.001),local(e));};
 app.canvas.addEventListener('pointerdown',down);app.canvas.addEventListener('pointermove',move);app.canvas.addEventListener('pointerup',up);app.canvas.addEventListener('pointercancel',up);app.canvas.addEventListener('wheel',wheel,{passive:false});
 const resize=new ResizeObserver(()=>{if(cameraInitialized)center();});resize.observe(host);
 ground.cacheAsTexture(true);drawWorld();reconcile();center();app.ticker.add(tick);
 return{update(next,id,controls){const reset=next.seed!==previousSeed||next.world.day<state.world.day;state=next;selected=id;playback=controls;previousSeed=next.seed;const signature=JSON.stringify(next.world.map);if(signature!==mapSignature){mapSignature=signature;drawWorld();}reconcile(reset);if(reset)center();},center,follow(enabled){following=enabled;},destroy(){resize.disconnect();app.ticker.remove(tick);app.canvas.removeEventListener('pointerdown',down);app.canvas.removeEventListener('pointermove',move);app.canvas.removeEventListener('pointerup',up);app.canvas.removeEventListener('pointercancel',up);app.canvas.removeEventListener('wheel',wheel);app.destroy(true,{children:true});}};
}
