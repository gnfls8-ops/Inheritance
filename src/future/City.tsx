import {useEffect,useRef} from 'react';
import {Application,Container,Graphics,Text} from 'pixi.js';
import type {State,CityFrame} from './model';
import {ageYears,ACTIONS} from './model';
import {cityPath} from './path';
import {MotionTrack} from '../rendering/motion';
const iso=(x:number,y:number)=>({x:(x-y)*19,y:(x+y)*9.5});
export function City({state,paused,onObserve,follow,frame}:{state:State;paused:boolean;onObserve:(id:string)=>void;follow:number;frame?:CityFrame}){
 const host=useRef<HTMLDivElement>(null),latest=useRef({state,paused,onObserve,follow,frame});latest.current={state,paused,onObserve,follow,frame};
 useEffect(()=>{
  const app=new Application();let disposed=false,ready=false,resize:ResizeObserver|undefined;
  const cleanup: Array<()=>void>=[];
  void app.init({resizeTo:host.current!,background:0x10282e,antialias:false,resolution:1,autoDensity:true,preference:'webgl'}).then(()=>{
   if(disposed){app.destroy(true);return;}ready=true;host.current!.appendChild(app.canvas);
   const city=new Container();app.stage.addChild(city);let zoom=.9;city.scale.set(zoom);
   const ground=new Graphics();city.addChild(ground);const objects=new Container();objects.sortableChildren=true;city.addChild(objects);
   const polygon=(g:Graphics,points:number[],color:number)=>g.poly(points).fill(color);
   for(let x=0;x<30;x++)for(let y=0;y<30;y++){
    const p=iso(x,y),road=[10,11,18,19].includes(x)||[10,11,18,19].includes(y);
    polygon(ground,[p.x,p.y,p.x+19,p.y+9.5,p.x,p.y+19,p.x-19,p.y+9.5],road?0x35464b:(x+y)%3===0?0x65816d:0x607b67);
    if(road&&((x===10&&y%2===0)||(y===10&&x%2===0)))ground.moveTo(p.x,p.y+8).lineTo(p.x+7,p.y+11).stroke({color:0xb4b6a3,width:1});
   }
   const structures:Array<{g:Graphics;x:number;y:number;w:number;d:number;h:number;kind:string;id:string}>=[];
   function building(x:number,y:number,w:number,d:number,h:number,kind:string,id:string){const g=new Graphics(),p=iso(x,y);g.position.set(p.x,p.y);g.zIndex=x+y;objects.addChild(g);structures.push({g,x,y,w,d,h,kind,id});}
   for(const b of latest.current.state.city.buildings)building(b.x,b.y,b.w,b.d,b.height,b.kind,b.id);
   let visual='';
   function redraw(){const s=latest.current.state,frame=latest.current.frame,cityState=frame?.city??s.city,wld=frame?.metrics??s.nation.metrics,green=wld.environment>50?1:0;const key=cityState.buildings.map(b=>`${b.level}/${b.phase}/${Math.floor(b.progress/10)}`).join(',')+green;if(key===visual)return;visual=key;
    for(const {g,w,d,h,kind,id} of structures){const data=cityState.buildings.find(b=>b.id===id)!,level=data.level;g.clear();const height=h+level*12,a=iso(w,0),b=iso(w,d),c=iso(0,d),color=kind==='school'?0xc1ae83:kind==='home'?0xc0a58d:kind==='art'?0xa7918b:0x8ba7ad;
     polygon(g,[0,0,a.x,a.y,b.x,b.y,c.x,c.y],0x344d49);
     polygon(g,[c.x,c.y,c.x,c.y-height,b.x,b.y-height,b.x,b.y],color);
     polygon(g,[a.x,a.y,a.x,a.y-height,b.x,b.y-height,b.x,b.y],kind==='home'?0x947a6a:0x54717a);
     polygon(g,[0,-height,a.x,a.y-height,b.x,b.y-height,c.x,c.y-height],kind==='school'?0xd8c9a5:0xb8c7bf);
     for(let row=12;row<height-7;row+=10)for(let col=1;col<w*2;col++){const p=iso(col/2,d);g.poly([p.x-3,p.y-row,p.x+2,p.y-row+2,p.x+2,p.y-row+7,p.x-3,p.y-row+5]).fill(level?0xa6e1d5:0xf1d6a0);}
     if(level)g.poly([0,-height-1,22,-height+10,5,-height+19,-17,-height+8]).fill(0x335c74);
     if(green&&kind==='home')g.ellipse(-10,-height+5,13,6).fill(0x577d58);
     // Rooftop vents, parapets and masonry keep the district legible at pixel scale.
     g.moveTo(c.x,c.y-height).lineTo(b.x,b.y-height).lineTo(a.x,a.y-height).stroke({color:0xe1dfce,width:2});
     for(let i=0;i<3;i++){const p=iso(i*.6+.4,.8);g.rect(p.x-4,p.y-height-5,8,5).fill(0x748c89).rect(p.x-3,p.y-height-4,6,1).fill(0xb3c1af);}
     if(data.phase==='construction'){
      const top=height+25+data.progress*.2;
      g.moveTo(c.x-5,c.y).lineTo(c.x-5,c.y-top).lineTo(b.x+15,b.y-top).stroke({color:0xc3a262,width:2});
      g.moveTo(c.x-5,c.y-top).lineTo(c.x+15,c.y-top-22).lineTo(b.x+15,b.y-top).moveTo(b.x+4,b.y-top).lineTo(b.x+4,b.y-height-8).stroke({color:0xdec38c,width:1});
      for(let row=0;row<height;row+=12)g.moveTo(c.x-3,c.y-row).lineTo(b.x+3,b.y-row).stroke({color:0xbba88b,alpha:.55,width:1});
      g.poly([c.x,c.y+2,b.x,b.y+2,b.x,b.y+6,c.x,c.y+6]).fill(0xd8b565);
      for(let i=0;i<6;i++)g.rect(c.x+i*6,c.y+i*3,3,5).fill(0x413c37);
     }

    }
   }
   for(const [x,y] of [[13,13],[15,13],[17,14],[13,16],[26,7],[27,9],[2,20],[8,21],[20,26]]){const p=iso(x,y),g=new Graphics();g.position.set(p.x,p.y);g.zIndex=x+y;g.ellipse(0,2,13,6).fill({color:0x173e37,alpha:.25}).rect(-2,-23,4,24).fill(0x76644d).ellipse(0,-28,14,19).fill(0x3e6655).ellipse(-5,-32,10,12).fill(0x6b9270);objects.addChild(g);}
   for(let n=2;n<29;n+=4){for(const [x,y] of [[n,11.8],[19.8,n]]){const p=iso(x,y),g=new Graphics();g.position.set(p.x,p.y);g.zIndex=x+y;g.rect(-1,-20,2,20).fill(0x859994).rect(-1,-22,7,2).fill(0xbcc8b7).rect(3,-21,5,2).fill(0xf5d596);objects.addChild(g);}}
   for(const [x,y,label] of [[7,8,'ARCADIA'],[22,8,'LEARN'],[6,18,'STUDIO'],[16,27,'MARKET']] as [number,number,string][]){const p=iso(x,y),g=new Graphics();g.position.set(p.x,p.y);g.zIndex=x+y;g.rect(-20,-16,40,10).fill(0x28454e).rect(-17,-6,2,7).fill(0x76887f).rect(16,-6,2,7).fill(0x76887f);const text=new Text({text:label,style:{fontSize:6,fontFamily:'monospace',fill:0xe4ce9b}});text.anchor.set(.5);text.position.set(0,-11);g.addChild(text);objects.addChild(g);}
   for(const [x,y] of [[12,14],[16,17],[27,8],[2,22]]){const p=iso(x,y),g=new Graphics();g.position.set(p.x,p.y);g.zIndex=x+y;g.poly([-7,0,5,6,8,4,-4,-2]).fill(0xb3996d).moveTo(-5,1).lineTo(-5,5).moveTo(6,5).lineTo(6,9).stroke({color:0x2e4849,width:2});objects.addChild(g);}
   const plaza=iso(15,16);ground.ellipse(plaza.x,plaza.y,40,18).fill(0xadc3b6).ellipse(plaza.x,plaza.y,27,12).fill(0x568a96);
   for(const [x,y,label] of [[7,11,'업무 지구'],[23,9,'배움의 집'],[6,19,'창작 공방'],[16,19,'시민 광장'],[6,28,'주거 지구']] as [number,number,string][]){const p=iso(x,y),t=new Text({text:label,style:{fontFamily:'sans-serif',fontSize:11,fill:0xe3e7d1,dropShadow:{color:0x12312b,blur:2,distance:1}}});t.anchor.set(.5);t.position.set(p.x,p.y+8);ground.addChild(t);}
   const sprites=new Map<string,{container:Container;body:Graphics;ring:Graphics;label:Text;track:MotionTrack;target:string}>();
   let seenFollow=-1,seenPlayer='',lastDay=-1,time=0,following=true;
   function center(){city.position.set(app.screen.width/2,Math.max(120,app.screen.height*.16));}
   center();resize=new ResizeObserver(()=>center());resize.observe(host.current!);
   const pointers=new Map<number,{x:number;y:number}>();let lastDistance=0,moved=false;
   const canvas=app.canvas;canvas.style.touchAction='none';
   const down=(e:PointerEvent)=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);moved=false;};
   const move=(e:PointerEvent)=>{const p=pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(Math.abs(dx)+Math.abs(dy)>2){moved=true;following=false;}if(pointers.size===1){city.x+=dx;city.y+=dy;}else{const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(lastDistance)zoom=Math.min(2.2,Math.max(.35,zoom*distance/lastDistance));city.scale.set(zoom);lastDistance=distance;}};
   const up=(e:PointerEvent)=>{pointers.delete(e.pointerId);lastDistance=0;};
   const wheel=(e:WheelEvent)=>{e.preventDefault();following=false;zoom=Math.min(2.2,Math.max(.35,zoom*Math.exp(-e.deltaY*.001)));city.scale.set(zoom);};
   canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});cleanup.push(()=>{canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);});
   const traffic=new Container();traffic.zIndex=11;objects.addChild(traffic);
   const cars=Array.from({length:8},(_,i)=>{const g=new Graphics();g.poly([-9,-2,0,-7,10,-2,1,3]).fill(i%2?0x829ea7:0xdac6a8).rect(-3,-7,8,4).fill(0x49636c).rect(-7,0,3,2).fill(0x172a2e).rect(5,0,3,2).fill(0x172a2e);traffic.addChild(g);return g;});
   app.ticker.add(ticker=>{
    const {state:s,paused,onObserve,follow,frame}=latest.current;redraw();if(!paused||frame)time+=ticker.deltaMS/1000;
    cars.forEach((g,i)=>{const c=frame?.city??s.city,p=iso((time*(1+c.transit/100)+i*4)%30,i%2?10.4:18.6);g.position.set(p.x,p.y);g.visible=i<3+Math.floor(c.transit/15);});
    const visible=frame?[]:s.population.filter(h=>h.alive).slice(0,23);const player=frame?undefined:s.population.find(h=>h.id===s.playerId);if(player?.alive&&!visible.includes(player))visible.push(player);
    const ids=new Set(visible.map(h=>h.id));for(const [id,v] of sprites)if(!ids.has(id)){v.container.destroy({children:true});sprites.delete(id);}
    for(const h of visible){let v=sprites.get(h.id);if(!v){const container=new Container(),ring=new Graphics(),body=new Graphics(),label=new Text({text:'',style:{fontFamily:'sans-serif',fontSize:10,fill:0xffe6ad}});container.addChild(ring,body,label);label.anchor.set(.5,1);label.y=-30;container.eventMode='static';container.cursor='pointer';container.on('pointertap',()=>{if(!moved)onObserve(h.id);});objects.addChild(container);v={container,ring,body,label,track:new MotionTrack(h.position),target:''};sprites.set(h.id,v);}
     const targetKey=`${h.target.x}:${h.target.y}`;if(v.target!==targetKey){v.target=targetKey;v.track.retarget(cityPath(v.track.position,h.target,s.city),1.6);}
     const p=v.track.advance(Math.min(ticker.deltaMS/1000,.05),paused),screen=iso(p.x,p.y),mine=h.id===s.playerId,walk=v.track.moving?Math.sin(time*12):Math.sin(time*2)*.1,scale=ageYears(h)<13?.8:1;
     v.container.position.set(screen.x,screen.y);v.container.zIndex=p.x+p.y+.5;v.body.clear();const skin=[0xf0c9aa,0xd9a878,0xb88159,0x8f6047,0x62483c][h.appearance.skin],cloth=[0x7e9aaf,0xb47f6e,0x6b9c89,0xd5b881,0x9c8aaa][h.appearance.clothing];
     v.body.ellipse(0,1,5,2).fill({color:0x132a2c,alpha:.35}).moveTo(-1,-8*scale).lineTo(-2-walk*2,0).moveTo(1,-8*scale).lineTo(2+walk*2,0).stroke({color:0x293d4b,width:2}).roundRect(-3,-19*scale,6,11*scale,1).fill(cloth).circle(0,-23*scale,3).fill(skin).moveTo(-3,-17*scale).lineTo(-5+walk,-10*scale).moveTo(3,-17*scale).lineTo(5-walk,-10*scale).stroke({color:skin,width:1.5});
     v.ring.clear();if(mine)v.ring.ellipse(0,1,9,4).stroke({color:0xf2c87a,width:1.7});v.label.text=mine?`${h.name} · ${ACTIONS[h.action]}`:'';
    }
    if(!frame&&(follow!==seenFollow||s.playerId!==seenPlayer)){seenFollow=follow;seenPlayer=s.playerId??'';following=true;}if(following&&!frame){const v=player&&sprites.get(player.id);if(v){const p=iso(v.track.position.x,v.track.position.y),x=app.screen.width/2-p.x*zoom,y=app.screen.height*.56-p.y*zoom;city.x+=(x-city.x)*.12;city.y+=(y-city.y)*.12;}}
    if(lastDay!==s.day)lastDay=s.day;
   });
  }).catch(()=>{if(host.current&&!disposed)host.current.textContent='도시 그래픽을 불러오지 못했습니다. 아래 인물·세계 패널에서 플레이할 수 있습니다.';});
  return()=>{disposed=true;resize?.disconnect();cleanup.forEach(fn=>fn());if(ready)app.destroy(true,{children:true});};
 },[]);
 return <div className="city-canvas" ref={host} aria-label="현대 도시 관찰 화면"/>;
}
