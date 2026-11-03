import {validateSnapshot} from './validation';
import {TIME_MODES,initialTimeline,dayChance} from './time';
import type {TimeMode} from './time';
import {historyDay} from './history';
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
      world.humans.push({id,name:['아라','누리','이솔','마루','가람','여울','하람','다온','나래','도담','해솔','새나'][i],position:{x:21+i%4,y:22+Math.floor(i/4)},path:[],ageDays:(18+i*2)*365,alive:true,deathDay:null,health:100,hunger:15,fatigue:10,loneliness:20,food:2,traits:{curiosity:Math.floor(this.random.next()*101),stability:Math.floor(this.random.next()*101),sociability:Math.floor(this.random.next()*101),riskTaking:Math.floor(this.random.next()*101)},techOrder:null,learnedAt:{},knowledge:[],relationships:{},action:'idle',control:'auto',targetHumanId:null,visited:[(22+Math.floor(i/4))*48+21+i%4],reason:'자율 행동 대기'});
      world.region.humanIds.push(id);
    }
    this.data = { player:{humanId:null,phase:'choose',startedDay:0,summary:null}, timeline:initialTimeline(), version: 2, seed, randomState: this.random.state, world, commands: [] };
  }
  static restore(raw:unknown):Simulation {
    if(!raw||typeof raw!=='object')throw new Error('잘못된 스냅샷');
    const value=structuredClone(raw) as SimulationSnapshot;
    const version=(raw as {version?:number}).version;
    if(![1,2].includes(version??0)||!value.world||!Array.isArray(value.world.humans)||!value.player||!Array.isArray(value.commands)||!Number.isInteger(value.world.day)||value.world.day<0)throw new Error('지원하지 않는 저장 데이터');
    if(version===1){value.timeline=initialTimeline();value.timeline.nextHuman=Math.max(13,...value.world.humans.map(h=>Number(h.id.replace('human-',''))+1).filter(Number.isFinite));value.version=2;}
    if(!value.timeline||!['daily','life','history'].includes(value.timeline.mode))throw new Error('잘못된 시간 상태');
    validateSnapshot(value);
    const sim=new Simulation(value.seed);sim.random=new SeededRandom(value.randomState);sim.data=value;return sim;
  }
  setMode(mode:TimeMode):boolean {
    if(!['daily','life','history'].includes(mode)||this.data.timeline.pending)return false;
    if(mode==='history'?this.data.player.phase!=='successor':this.data.player.phase!=='playing')return false;
    this.data.timeline.mode=mode;this.data.commands.push({tick:this.data.world.day,type:'mode',mode});return true;
  }
  retire():boolean {
    const p=this.data.player,h=this.data.world.humans.find(h=>h.id===p.humanId);
    if(p.phase!=='playing'||!h||this.data.timeline.pending)return false;
    h.path=[];h.techOrder=null;h.control='auto';p.phase='summary';
    p.summary={humanId:h.id,name:h.name,startedDay:p.startedDay,diedDay:this.data.world.day,retired:true,knowledge:[...h.knowledge],relationships:structuredClone(h.relationships)};
    this.data.commands.push({tick:this.data.world.day,type:'retire',humanId:h.id});return true;
  }
  acknowledgeEvent():boolean {if(!this.data.timeline.pending)return false;this.data.timeline.pending=null;this.data.commands.push({tick:this.data.world.day,type:'event',humanId:this.data.player.humanId??''});return true;}
  canAdvance():boolean {return !this.data.timeline.pending&&(this.data.player.phase==='playing'||this.data.player.phase==='successor'&&this.data.timeline.mode==='history');}
  advance(days:number=TIME_MODES[this.data.timeline.mode].days):number {
    if(!Number.isInteger(days)||days<0||days>365000)throw new Error('잘못된 진행 일수');
    let n=0;while(n<days&&this.canAdvance()){this.tick();n++;}return n;
  }
  private events(){
    const s=this.data,w=s.world,t=s.timeline;
    const emit=(id:string,title:string,important:boolean,cooldown:number)=>{if(w.day-(t.last[id]??-Infinity)<cooldown)return;t.last[id]=w.day;const e={id,title,important,day:w.day};t.events.push(e);t.events=t.events.slice(-200);if(important)t.pending=e;};
    const h=w.humans.find(h=>h.id===s.player.humanId&&h.alive);
    if(s.player.phase==='playing'&&h&&(h.health<=15||h.ageDays>=80*365-30))emit('danger','삶의 위기: 건강 또는 노령을 확인하세요',true,30);
    if(!t.pending&&s.player.phase==='playing'&&w.day-s.player.startedDay>=900&&w.humans.some(o=>o.alive&&o.id!==h?.id)&&dayChance(s.seed,w.day,721)<1/600)emit('encounter','새로운 대화의 기회: 주변 인간과 교류해 보세요',true,900);
    if(!t.pending&&Object.values(w.technologies).some(v=>v.adopted))emit('adoption','기술이 공동체의 관습으로 자리 잡았습니다',true,365*500);
    if(!t.pending&&t.culture.tradition>=30&&w.day>=365*500&&dayChance(s.seed,w.day,722)<1/(365*1000))emit('culture','오랜 전승이 새로운 공동체 문화로 성장했습니다',true,365*1000);
    if(dayChance(s.seed,w.day,723)<1/20)emit('daily','골짜기의 일상과 관계가 이어집니다',false,30);
  }
  snapshot(): SimulationSnapshot { return structuredClone(this.data); }
  choosePlayer(id:string):boolean {
    const p=this.data.player,h=this.data.world.humans.find(h=>h.id===id&&h.alive);
    if(!h||p.phase==='successor'&&p.summary?.retired&&p.humanId===id||!['choose','successor'].includes(p.phase))return false;
    if(this.data.timeline.pending)return false;
    this.data.timeline.mode='daily';
    this.data.player={humanId:id,phase:'playing',startedDay:this.data.world.day,summary:null};
    this.data.commands.push({tick:this.data.world.day,type:'choose',humanId:id});return true;
  }
  reviewLife():boolean {
    if(this.data.player.phase!=='summary')return false;
    this.data.commands.push({tick:this.data.world.day,type:'review',humanId:this.data.player.humanId!});
    this.data.player.phase='successor';return true;
  }
  private controls(id:string):boolean {return this.data.player.phase==='playing'&&this.data.player.humanId===id&&!!this.data.world.humans.find(h=>h.id===id&&h.alive);}
  requestFood(targetId:string):'accepted'|'refused'|'unavailable' {
    const p=this.data.player,h=this.data.world.humans.find(h=>h.id===p.humanId),other=this.data.world.humans.find(h=>h.id===targetId&&h.alive);
    if(!h||!this.controls(h.id)||!other||other===h||Math.abs(h.position.x-other.position.x)+Math.abs(h.position.y-other.position.y)>3)return 'unavailable';
    const trust=other.relationships[h.id]?.trust??0;
    const chance=Math.max(.05,Math.min(.9,.2+other.traits.sociability/200+trust/300-other.hunger/150-other.traits.stability/500));
    const accepted=other.food>1&&this.random.next()<chance;
    if(accepted){other.food--;h.food++;}
    this.data.commands.push({tick:this.data.world.day,type:'request',humanId:other.id});
    this.data.world.activityLog.push({day:this.data.world.day,humanId:h.id,text:`${other.name}: 식량 나눔 부탁 ${accepted?'수락':'거절'}`});
    this.data.world.activityLog=this.data.world.activityLog.slice(-100);this.data.randomState=this.random.state;
    return accepted?'accepted':'refused';
  }
  move(humanId: string, target: Point): boolean {
    const human = this.data.world.humans.find(h => h.id === humanId);
    if (!human||!this.controls(humanId)) return false;
    const path = findPath(this.data.world.map, human.position, target);
    if (!path) return false;
    human.techOrder=null;human.path = path; human.control='player';human.action='move';human.targetHumanId=null;human.reason='플레이어 이동 지시';
    this.data.commands.push({tick:this.data.world.day,type:'move',humanId,target:{...target}});
    return true;
  }
  act(humanId:string,action:Activity):boolean {
    const human=this.data.world.humans.find(h=>h.id===humanId);
    if(!human||!this.controls(humanId)||!['gather','explore','rest','socialize'].includes(action))return false;
    const previous=structuredClone(human), previousRandom=this.random.state;
    if(!planAction(this.data.world,human,action,this.random)){Object.assign(human,previous);this.random=new SeededRandom(previousRandom);return false;}
    human.techOrder=null;human.control='player';human.reason='플레이어 행동 지시';
    this.data.commands.push({tick:this.data.world.day,type:'action',humanId,action});
    this.data.randomState=this.random.state;return true;
  }
  resumeAuto(humanId:string):boolean {
    const human=this.data.world.humans.find(h=>h.id===humanId);if(!human||!this.controls(humanId))return false;
    human.techOrder=null;human.control='auto';human.path=[];human.action='idle';human.targetHumanId=null;human.reason='지시 취소 · 자율 행동 복귀';
    this.data.commands.push({tick:this.data.world.day,type:'auto',humanId});return true;
  }
  technology(humanId:string,order:TechOrder):boolean {
    const h=this.data.world.humans.find(h=>h.id===humanId);
    if(!h||!this.controls(humanId)||!['fire','stone','storage'].includes(order.id)||!['experiment','teach'].includes(order.kind))return false;
    if(order.kind==='experiment'?!canExperiment(this.data.world,h,order.id):!h.knowledge.includes(order.id))return false;
    h.techOrder={...order};h.path=[];h.control='player';h.action='idle';h.reason=order.kind==='experiment'?'실험 예약':'지식 전파 예약';
    this.data.commands.push({tick:this.data.world.day,type:'technology',humanId,order:{...order}});return true;
  }
  step():SimulationSnapshot {this.tick();return this.snapshot();}
  private tick():void {
    if(!this.canAdvance())return;
    this.data.commands.push({ tick: this.data.world.day, type: 'wait' });
    if(this.data.timeline.mode==='history')historyDay(this.data);
    else for (const human of this.data.world.humans) {
      if(!human.alive)continue;
      if(human.techOrder){resolveTechnology(this.data.world,human,this.random);human.control='player';}
      if(human.health>0)stepHuman(this.data.world,human,this.random);
      human.ageDays++;
      if(human.health<=0||human.ageDays>=80*365){
        this.data.timeline.deaths++;human.alive=false;human.deathDay=this.data.world.day+1;human.path=[];human.techOrder=null;human.control='auto';
        if(human.id===this.data.player.humanId){
          this.data.player.phase='summary';
          this.data.player.summary={humanId:human.id,name:human.name,startedDay:this.data.player.startedDay,diedDay:human.deathDay,knowledge:[...human.knowledge],relationships:structuredClone(human.relationships)};
        }
      }
      if((this.data.world.day+1)%7===0&&!human.knowledge.includes('storage')&&human.food>0)human.food--; 
    }
    updateTechnology(this.data.world,this.random);
    this.data.world.day += 1;
    if(this.data.world.day%7===0)this.data.world.resources=this.data.world.resources.map((amount,i)=>Math.min(this.data.world.map.tiles[i]==='forest'?6:3,amount+(this.data.world.map.tiles[i]==='forest'||this.data.world.map.tiles[i]==='grass'?(this.data.world.technologies.storage.adopted?2:1):0)));
    this.events();
    this.data.randomState = this.random.state;
  }
}
