import { canExperiment, resolveTechnology, updateTechnology } from './technology';
import type { TechOrder } from './technology';
import type { Activity, SimulationSnapshot, WorldState } from './model';
import { SeededRandom } from './random';
import { generateMap, findPath } from './map';
import type { Point } from './map';
import { planAction, stepHuman } from './human';
/** Pure daily simulation. No browser APIs, wall clock, rendering or React. */
export class Simulation {
  private random: SeededRandom;
  private data: SimulationSnapshot;
  constructor(seed = 2026) {
    this.random = new SeededRandom(seed);
    const world: WorldState = {
      era: 'prehistory', day: 0, map: generateMap(this.random),
      technologies:{fire:{holders:0,adopted:false,everDiscovered:false},stone:{holders:0,adopted:false,everDiscovered:false},storage:{holders:0,adopted:false,everDiscovered:false}},technologyLog:[],resources: [], activityLog: [],
      region: { id: 'valley', name: '이름 없는 골짜기', humanIds: [] }, humans: [],
    };
    world.resources=world.map.tiles.map(t=>t==='forest'?6:t==='grass'?3:0);
    for (let i=0;i<12;i++) {
      const id = `human-${i+1}`;
      world.humans.push({id,name:['아라','누리','이솔','마루','가람','여울','하람','다온','나래','도담','해솔','새나'][i],position:{x:21+i%4,y:22+Math.floor(i/4)},path:[],ageDays:(18+i*2)*365,health:100,hunger:15,fatigue:10,loneliness:20,food:2,traits:{curiosity:Math.floor(this.random.next()*101),stability:Math.floor(this.random.next()*101),sociability:Math.floor(this.random.next()*101),riskTaking:Math.floor(this.random.next()*101)},techOrder:null,learnedAt:{},knowledge:[],relationships:{},action:'idle',control:'auto',targetHumanId:null,visited:[(22+Math.floor(i/4))*48+21+i%4],reason:'자율 행동 대기'});
      world.region.humanIds.push(id);
    }
    this.data = { version: 1, seed, randomState: this.random.state, world, commands: [] };
  }
  snapshot(): SimulationSnapshot { return structuredClone(this.data); }
  move(humanId: string, target: Point): boolean {
    const human = this.data.world.humans.find(h => h.id === humanId);
    if (!human) return false;
    const path = findPath(this.data.world.map, human.position, target);
    if (!path) return false;
    human.techOrder=null;human.path = path; human.control='player';human.action='move';human.targetHumanId=null;human.reason='플레이어 이동 지시';
    this.data.commands.push({tick:this.data.world.day,type:'move',humanId,target:{...target}});
    return true;
  }
  act(humanId:string,action:Activity):boolean {
    const human=this.data.world.humans.find(h=>h.id===humanId);
    if(!human||!['gather','explore','rest','socialize'].includes(action))return false;
    const previous=structuredClone(human), previousRandom=this.random.state;
    if(!planAction(this.data.world,human,action,this.random)){Object.assign(human,previous);this.random=new SeededRandom(previousRandom);return false;}
    human.techOrder=null;human.control='player';human.reason='플레이어 행동 지시';
    this.data.commands.push({tick:this.data.world.day,type:'action',humanId,action});
    this.data.randomState=this.random.state;return true;
  }
  resumeAuto(humanId:string):boolean {
    const human=this.data.world.humans.find(h=>h.id===humanId);if(!human)return false;
    human.techOrder=null;human.control='auto';human.path=[];human.action='idle';human.targetHumanId=null;human.reason='지시 취소 · 자율 행동 복귀';
    this.data.commands.push({tick:this.data.world.day,type:'auto',humanId});return true;
  }
  technology(humanId:string,order:TechOrder):boolean {
    const h=this.data.world.humans.find(h=>h.id===humanId);
    if(!h||!['fire','stone','storage'].includes(order.id)||!['experiment','teach'].includes(order.kind))return false;
    if(order.kind==='experiment'?!canExperiment(this.data.world,h,order.id):!h.knowledge.includes(order.id))return false;
    h.techOrder={...order};h.path=[];h.control='player';h.action='idle';h.reason=order.kind==='experiment'?'실험 예약':'지식 전파 예약';
    this.data.commands.push({tick:this.data.world.day,type:'technology',humanId,order:{...order}});return true;
  }
  step(): SimulationSnapshot {
    this.data.commands.push({ tick: this.data.world.day, type: 'wait' });
    for (const human of this.data.world.humans) {
      if(human.techOrder){resolveTechnology(this.data.world,human,this.random);human.control='player';}
      stepHuman(this.data.world,human,this.random);
      if((this.data.world.day+1)%7===0&&!human.knowledge.includes('storage')&&human.food>0)human.food--; 
    }
    updateTechnology(this.data.world,this.random);
    this.data.world.day += 1;
    if(this.data.world.day%7===0)this.data.world.resources=this.data.world.resources.map((amount,i)=>Math.min(this.data.world.map.tiles[i]==='forest'?6:3,amount+(this.data.world.map.tiles[i]==='forest'||this.data.world.map.tiles[i]==='grass'?(this.data.world.technologies.storage.adopted?2:1):0)));
    this.data.randomState = this.random.state;
    return this.snapshot();
  }
}
