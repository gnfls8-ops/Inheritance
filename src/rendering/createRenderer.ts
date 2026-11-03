import { Application, Container, Graphics } from 'pixi.js';
import type { SimulationSnapshot } from '../simulation/model';
import { toIso, fromIso } from '../simulation/map';
import type { Point, Terrain } from '../simulation/map';
export interface MapRenderer { update(state: SimulationSnapshot, selected: string | null): void; center(): void; follow(enabled:boolean): void; destroy(): void }
/** Canvas-only rendering and camera; all simulation mutations go through callbacks. */
export async function createRenderer(host: HTMLElement, initial: SimulationSnapshot, onSelect: (id:string)=>void, onMove:(point:Point)=>void): Promise<MapRenderer> {
  const app=new Application();
  await app.init({resizeTo:host,background:0x17241e,antialias:false,resolution:Math.min(window.devicePixelRatio||1,2),autoDensity:true,preference:'webgl'});
  const scene=new Container(), terrain=new Container(), people=new Container(), overlay=new Graphics();
  scene.addChild(terrain,overlay,people); app.stage.addChild(scene); people.sortableChildren=true;
  host.appendChild(app.canvas); app.canvas.style.touchAction='none';
  app.canvas.setAttribute('aria-label','48×48 쿼터뷰 지역 지도. 드래그로 이동, 휠 또는 핀치로 확대, 인물 선택 후 땅을 눌러 이동.');
  let state=initial, selected:string|null=null, currentMap=initial.world.map, following=false;
  const sprites=new Map<string,Container>();
  const scenery: Graphics[]=[];
  const colors:Record<Terrain,number>={grass:0x71805a,forest:0x4c674a,river:0x416f76,rock:0x777c70};
  function drawTerrain() {
    terrain.removeChildren().forEach(c=>c.destroy());
    scenery.splice(0).forEach(c=>c.destroy());
    const map=state.world.map;
    // Tiles are static; only regenerate when the world changes.
    for(let sum=0;sum<map.width+map.height-1;sum++) for(let x=0;x<map.width;x++) {
      const y=sum-x;if(y<0||y>=map.height)continue;
      const type=map.tiles[y*map.width+x], p=toIso({x,y}), g=new Graphics();
      const base=colors[type];
      g.poly([0,-16,32,0,0,16,-32,0]).fill(base).stroke({color:0x17241e,alpha:.12,width:1});
      const variation=((x*17+y*31)%7)-3;
      if(type==='grass') {g.rect(-9+variation,-3,2,3).fill(0x8a9467);g.rect(6,3+variation,3,2).fill(0x5f744d);}
      if(type==='river') {g.moveTo(-14,0).lineTo(2,4).lineTo(16,1).stroke({color:0x80a5a0,width:1,alpha:.6});}
      const decor=new Graphics();
      if(type==='rock') {decor.poly([-15,3,-9,-9,6,-14,17,0,8,8]).fill(0x92958a);decor.poly([-9,-9,0,0,8,8,-15,3]).fill(0x60695f);}
      if(type==='forest') {
        decor.rect(-2,-32,4,33).fill(0x514e37);
        decor.poly([-15,-13,0,-48,16,-13]).fill(0x304e38);
        decor.poly([-12,-26,0,-51,12,-26]).fill(0x405b3d);
      }
      g.position.set(p.x,p.y);terrain.addChild(g);
      if(type==='forest'||type==='rock'){decor.position.set(p.x,p.y);decor.zIndex=p.y;people.addChild(decor);scenery.push(decor);}else decor.destroy();
    }
  }
  function drawPeople() {
    const ids=new Set(state.world.humans.filter(h=>h.alive).map(h=>h.id));
    for(const [id,node] of sprites) if(!ids.has(id)){node.destroy({children:true});sprites.delete(id);}
    for(const [i,h] of state.world.humans.filter(h=>h.alive).entries()) {
      let node=sprites.get(h.id);
      if(!node){node=new Container();node.addChild(new Graphics());people.addChild(node);sprites.set(h.id,node);}
      const g=node.children[0] as Graphics;g.clear();
      if(h.id===state.player.humanId)g.circle(0,-40,3).fill(0x8bd8ef);
      g.ellipse(0,0,7,3).fill({color:0x15231b,alpha:.5});
      // Adult proportions: head 4px, body height 26px, simple layered clothing.
      if(h.id===selected) g.ellipse(0,0,10,5).stroke({color:0xf0d68c,width:2});
      g.rect(-4,-10,3,10).rect(1,-10,3,10).fill(0x554b39);
      g.poly([-4,-22,4,-22,6,-9,-6,-9]).fill([0xb7a177,0x95866d,0xb7b19a][i%3]);
      g.rect(-7,-20,3,12).rect(4,-20,3,12).fill(0xb89572);
      g.rect(-2,-27,4,5).fill(0xc3a17c);g.rect(-2,-28,4,2).fill(0x423e31);
      const activityColor={idle:0x9da793,move:0xddd0a0,gather:0xd0ae67,explore:0x91b887,rest:0x8caabb,socialize:0xc4a0a1}[h.action];
      g.circle(8,-29,2).fill(activityColor);
      if(h.id===selected)g.poly([-4,-35,4,-35,0,-31]).fill(0xf0d68c);
      const p=toIso(h.position);node.position.set(p.x,p.y);node.zIndex=p.y;
    }
    overlay.clear();
    const human=state.world.humans.find(h=>h.id===selected);
    if(human) for(const tile of human.path){const p=toIso(tile);overlay.ellipse(p.x,p.y,4,2).fill(0xf0d68c);}
  }
  const pointers=new Map<number,Point>();let origin:Point|null=null, moved=false, distance=0;
  function local(e:PointerEvent|WheelEvent):Point {const r=app.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  function zoom(factor:number, anchor:Point) {
    const before={x:(anchor.x-scene.x)/scene.scale.x,y:(anchor.y-scene.y)/scene.scale.y};
    const scale=Math.min(2.5,Math.max(.22,scene.scale.x*factor));scene.scale.set(scale);
    scene.position.set(anchor.x-before.x*scale,anchor.y-before.y*scale);
  }
  const down=(e:PointerEvent)=>{if(e.button!==0)return;const p=local(e);pointers.set(e.pointerId,p);app.canvas.setPointerCapture(e.pointerId);origin=p;moved=false;distance=0;if(pointers.size>1)moved=true;};
  const move=(e:PointerEvent)=>{
    const last=pointers.get(e.pointerId);if(!last)return;const p=local(e);pointers.set(e.pointerId,p);
    if(pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(distance)zoom(d/distance,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});distance=d;moved=true;return;}
    if(origin&&Math.hypot(p.x-origin.x,p.y-origin.y)>5)moved=true;
    if(moved){scene.x+=p.x-last.x;scene.y+=p.y-last.y;}
  };
  const up=(e:PointerEvent)=>{
    if(!pointers.has(e.pointerId))return;
    const p=local(e);pointers.delete(e.pointerId);
    if(e.type==='pointerup'&&!moved&&origin){
      const world={x:(p.x-scene.x)/scene.scale.x,y:(p.y-scene.y)/scene.scale.y};
      const human=[...state.world.humans.filter(h=>h.alive)].sort((a,b)=>(b.position.x+b.position.y)-(a.position.x+a.position.y)).find(h=>{const at=toIso(h.position);return Math.abs(at.x-world.x)<11&&world.y>=at.y-32&&world.y<=at.y+6;});
      if(human)onSelect(human.id);else onMove(fromIso(world));
    }
    moved=true;distance=0;if(!pointers.size)origin=null;
  };
  const wheel=(e:WheelEvent)=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.001),local(e));};
  app.canvas.addEventListener('pointerdown',down);app.canvas.addEventListener('pointermove',move);app.canvas.addEventListener('pointerup',up);app.canvas.addEventListener('pointercancel',up);app.canvas.addEventListener('wheel',wheel,{passive:false});
  function center(){const human=state.world.humans.find(h=>h.id===selected);const p=toIso(human?.position??{x:23,y:23});scene.scale.set(.85);scene.position.set(host.clientWidth/2-p.x*.85,host.clientHeight/2-p.y*.85);}
  terrain.cacheAsTexture(true);
  drawTerrain();terrain.updateCacheTexture();drawPeople();center();
  return {update(next,id){state=next;selected=id;if(currentMap!==next.world.map){
    // Snapshots are cloned each tick; compare seed instead through map content identity below.
    if(currentMap.tiles.join()!==next.world.map.tiles.join()){drawTerrain();terrain.updateCacheTexture();}currentMap=next.world.map;
  }drawPeople();if(following){const h=state.world.humans.find(h=>h.id===selected);if(h){const p=toIso(h.position);scene.position.set(host.clientWidth/2-p.x*scene.scale.x,host.clientHeight/2-p.y*scene.scale.y);}}},center,follow(enabled){following=enabled;},destroy(){app.canvas.removeEventListener('pointerdown',down);app.canvas.removeEventListener('pointermove',move);app.canvas.removeEventListener('pointerup',up);app.canvas.removeEventListener('pointercancel',up);app.canvas.removeEventListener('wheel',wheel);app.destroy(true,{children:true});}};
}
