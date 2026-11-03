import {initialLandscape,landscapeDay} from './landscape';
import {populationDay} from './population';
import {remember,nameOf,withParticle} from './chronicle';
import {validateSnapshot} from './validation';
import {TIME_MODES,initialTimeline,dayChance} from './time';
import type {TimeMode} from './time';
import {historyDay} from './history';
import { TECHNOLOGIES, canExperiment, resolveTechnology, updateTechnology } from './technology';
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
    const map=generateMap(this.random);
    const world: WorldState = {
      landscape:initialLandscape(map),
      legacy:{people:{},transmissions:[]},era: 'prehistory', day: 0, map,
      technologies:{cultivation:{holders:0,adopted:false,everDiscovered:false},fire:{holders:0,adopted:false,everDiscovered:false},stone:{holders:0,adopted:false,everDiscovered:false},storage:{holders:0,adopted:false,everDiscovered:false}},technologyLog:[],resources: [], activityLog: [],
      region: { id: 'valley', name: '이름 없는 골짜기', humanIds: [] }, humans: [],
    };
    world.resources=world.map.tiles.map(t=>t==='forest'?6:t==='grass'?3:0);
    for (let i=0;i<12;i++) {
      const id = `human-${i+1}`;
      world.humans.push({id,name:['아라','누리','이솔','마루','가람','여울','하람','다온','나래','도담','해솔','새나'][i],position:{x:21+i%4,y:22+Math.floor(i/4)},path:[],ageDays:(18+i*2)*365,work:null,command:null,socialCooldown:{},deathCause:null,alive:true,deathDay:null,health:100,hunger:15,fatigue:10,loneliness:20,food:2,traits:{curiosity:Math.floor(this.random.next()*101),stability:Math.floor(this.random.next()*101),sociability:Math.floor(this.random.next()*101),riskTaking:Math.floor(this.random.next()*101)},techOrder:null,learnedAt:{},knowledge:[],relationships:{},action:'idle',control:'auto',targetHumanId:null,visited:[(22+Math.floor(i/4))*48+21+i%4],reason:'자율 행동 대기'});
      world.region.humanIds.push(id);world.legacy.people[id]={name:world.humans.at(-1)!.name,entries:[]};
    }
    this.data = { player:{humanId:null,phase:'choose',startedDay:0,summary:null}, timeline:initialTimeline(), version: 4, seed, randomState: this.random.state, world, commands: [] };
  }
  static restore(raw:unknown):Simulation {
    if(!raw||typeof raw!=='object')throw new Error('잘못된 스냅샷');
    const value=structuredClone(raw) as SimulationSnapshot;
    const version=(raw as {version?:number}).version;
    if(![1,2,3,4].includes(version??0)||!value.world||!Array.isArray(value.world.humans)||!value.player||!Array.isArray(value.commands)||!Number.isInteger(value.world.day)||value.world.day<0)throw new Error('지원하지 않는 저장 데이터');
    if(version===1){value.timeline=initialTimeline();value.timeline.nextHuman=Math.max(13,...value.world.humans.map(h=>Number(h.id.replace('human-',''))+1).filter(Number.isFinite));value.version=4;}
    if(version===1||version===2){
      value.version=4;value.world.legacy??={people:{},transmissions:[]};value.timeline.requestUntil??={};
      for(const h of value.world.humans){h.command??=null;h.socialCooldown??={};h.deathCause??=h.alive?null:h.ageDays>=80*365?'노령':'건강 악화 (이전 기록)';value.world.legacy.people[h.id]??={name:h.name,entries:[]};}
      for(const e of value.world.activityLog)e.humanName??=nameOf(value.world,e.humanId);
      const old=value.world.humans.find(h=>h.id===value.player.humanId);
      if(value.player.summary?.retired&&old?.alive){value.player.phase='playing';value.player.summary=null;value.timeline.mode='daily';}
      else if(value.player.summary?.retired&&old&&!old.alive){value.player.summary.retired=false;value.player.summary.diedDay=old.deathDay??value.world.day;value.player.summary.cause=old.deathCause??'이전 기록';}
    }
    if(version!==4){value.version=4;value.world.landscape=initialLandscape(value.world.map);value.world.technologies.cultivation={holders:0,adopted:false,everDiscovered:false};for(const h of value.world.humans)h.work=null;}
    if(!value.timeline||!['daily','life','history'].includes(value.timeline.mode))throw new Error('잘못된 시간 상태');
    validateSnapshot(value);
    const sim=new Simulation(value.seed);sim.random=new SeededRandom(value.randomState);sim.data=value;return sim;
  }
  setMode(mode:TimeMode):boolean {
    if(!['daily','life','history'].includes(mode)||this.data.timeline.pending)return false;
    if(mode==='history'?(this.data.player.phase!=='successor'||this.data.world.humans.some(h=>h.id===this.data.player.humanId&&h.alive)):this.data.player.phase!=='playing')return false;
    this.data.timeline.mode=mode;this.data.commands.push({tick:this.data.world.day,type:'mode',mode});return true;
  }
  retire():boolean {return false;}
  acknowledgeEvent():boolean {if(!this.data.timeline.pending)return false;this.data.timeline.pending=null;this.data.commands.push({tick:this.data.world.day,type:'event',humanId:this.data.player.humanId??''});return true;}
  canAdvance():boolean {return !this.data.timeline.pending&&(this.data.player.phase==='playing'||this.data.player.phase==='successor'&&this.data.timeline.mode==='history');}
  advance(days:number=TIME_MODES[this.data.timeline.mode].days):number {
    if(!Number.isInteger(days)||days<0||days>365000)throw new Error('잘못된 진행 일수');
    let n=0;while(n<days&&this.canAdvance()){this.tick();n++;}return n;
  }
  private events(){
    const s=this.data,w=s.world,t=s.timeline;
    const emit=(id:string,title:string,important:boolean,cooldown:number,other?:import('./model').HumanState)=>{if(w.day-(t.last[id]??-Infinity)<cooldown)return;t.last[id]=w.day;const e={id,title,important,day:w.day,...(other?{otherId:other.id,otherName:other.name,reason:other.hunger>60?'식량이 부족해 보입니다.':other.loneliness>50?'누군가와 이야기하고 싶어 합니다.':'서로의 생활과 지식을 나눌 기회입니다.'}:{})};if(important){const person=w.humans.find(h=>h.id===s.player.humanId);if(person)remember(w,person,{day:w.day,kind:'world',text:title});}t.events.push(e);t.events=t.events.slice(-200);if(important)t.pending=e;};
    const h=w.humans.find(h=>h.id===s.player.humanId&&h.alive);
    if(s.player.phase==='playing'&&h&&(h.health<=15||h.ageDays>=80*365-30))emit('danger',h.ageDays>=80*365-30?`노령 위기: 80세까지 ${Math.max(0,80*365-h.ageDays)}일 남음`:`건강 위기: 건강 ${h.health}/100`,true,30);
    // Non-blocking invitations give daily play an interaction prompt without changing time-mode hazards.
    if(h&&s.player.phase==='playing'&&w.day-(t.last.opportunity??s.player.startedDay)>=45){
      const nearby=w.humans.filter(o=>o.alive&&o.id!==h.id&&Math.abs(o.position.x-h.position.x)+Math.abs(o.position.y-h.position.y)<=8).sort((a,b)=>a.id.localeCompare(b.id))[0];
      if(nearby)emit('opportunity',`${withParticle(nearby.name)} 이야기를 나눌 기회`,false,45,nearby);
    }
    if(!t.pending&&s.player.phase==='playing'&&w.day-s.player.startedDay>=900&&w.humans.some(o=>o.alive&&o.id!==h?.id)&&dayChance(s.seed,w.day,721)<1/600){const other=w.humans.filter(o=>o.alive&&o.id!==h?.id).sort((a,b)=>Math.abs(a.position.x-h!.position.x)+Math.abs(a.position.y-h!.position.y)-Math.abs(b.position.x-h!.position.x)-Math.abs(b.position.y-h!.position.y))[0];if(other)emit('encounter',`${withParticle(other.name)} 만날 기회`,true,900,other);}
    if(!t.pending&&Object.values(w.technologies).some(v=>v.adopted))emit('adoption','기술이 공동체의 관습으로 자리 잡았습니다',true,365*500);
    if(!t.pending&&t.culture.tradition>=30&&w.day>=365*500&&dayChance(s.seed,w.day,722)<1/(365*1000))emit('culture','오랜 전승이 새로운 공동체 문화로 성장했습니다',true,365*1000);
    if(dayChance(s.seed,w.day,723)<1/20)emit('daily','골짜기의 일상과 관계가 이어집니다',false,30);
  }
  snapshot(): SimulationSnapshot { return structuredClone(this.data); }
  choosePlayer(id:string):boolean {
    const p=this.data.player,h=this.data.world.humans.find(h=>h.id===id&&h.alive);
    if(!h||p.phase==='successor'&&this.data.world.humans.some(o=>o.id===p.humanId&&o.alive)||!['choose','successor'].includes(p.phase))return false;
    if(this.data.timeline.pending)return false;
    this.data.timeline.mode='daily';
    this.data.player={humanId:id,phase:'playing',startedDay:this.data.world.day,summary:null};
    this.data.commands.push({tick:this.data.world.day,type:'choose',humanId:id});return true;
  }
  reviewLife():boolean {
    if(this.data.player.phase!=='summary'||this.data.world.humans.some(h=>h.id===this.data.player.humanId&&h.alive))return false;
    this.data.commands.push({tick:this.data.world.day,type:'review',humanId:this.data.player.humanId!});
    this.data.player.phase='successor';return true;
  }
  private controls(id:string):boolean {return this.data.player.phase==='playing'&&this.data.player.humanId===id&&!!this.data.world.humans.find(h=>h.id===id&&h.alive);}
  requestFood(targetId:string):'accepted'|'refused'|'unavailable'|'cooldown' {
    const p=this.data.player,h=this.data.world.humans.find(h=>h.id===p.humanId),other=this.data.world.humans.find(h=>h.id===targetId&&h.alive);
    if(!h||!this.controls(h.id)||!other||other===h||Math.abs(h.position.x-other.position.x)+Math.abs(h.position.y-other.position.y)>3)return 'unavailable';
    const key=`food:${h.id}:${other.id}`;if((this.data.timeline.requestUntil[key]??-1)>this.data.world.day)return 'cooldown';this.data.timeline.requestUntil[key]=this.data.world.day+7;
    const trust=other.relationships[h.id]?.trust??0;
    const chance=Math.max(.05,Math.min(.9,.2+other.traits.sociability/200+trust/300-other.hunger/150-other.traits.stability/500));
    const accepted=other.food>1&&this.random.next()<chance;
    if(accepted){other.food--;h.food++;const r=h.relationships[other.id]??{trust:0,familiarity:0};h.relationships[other.id]={...r,trust:Math.min(100,r.trust+3)};}
    remember(this.data.world,h,{day:this.data.world.day,kind:accepted?'help':'refusal',text:`${other.name}: 식량 나눔 ${accepted?'수락 · 식량 +1':'거절'}`,otherId:other.id,otherName:other.name});
    this.data.commands.push({tick:this.data.world.day,type:'request',humanId:other.id});
    this.data.world.activityLog.push({day:this.data.world.day,humanId:h.id,humanName:h.name,text:`${other.name}: 식량 나눔 부탁 ${accepted?'수락':'거절'}`});
    this.data.world.activityLog=this.data.world.activityLog.slice(-100);this.data.randomState=this.random.state;
    return accepted?'accepted':'refused';
  }
  openEncounter():boolean {
    const s=this.data,w=s.world,h=w.humans.find(h=>h.id===s.player.humanId&&h.alive);
    const e=s.timeline.events.filter(e=>e.id==='opportunity').at(-1),other=w.humans.find(o=>o.id===e?.otherId&&o.alive);
    if(!h||s.player.phase!=='playing'||s.timeline.pending||!e||!other||w.day-e.day>=45||s.timeline.last.openOpportunity===e.day)return false;
    s.timeline.last.openOpportunity=e.day;
    s.timeline.pending={...e,id:'encounter',important:true};
    s.commands.push({tick:w.day,type:'event',humanId:h.id});return true;
  }
  respondToEncounter(choice:'talk'|'food'|'skip'|'teach',technology?:import('./technology').TechnologyId):string {
    const event=this.data.timeline.pending;if(event?.id!=='encounter')return '대화 사건이 없습니다.';
    const w=this.data.world,h=w.humans.find(h=>h.id===this.data.player.humanId&&h.alive),other=w.humans.find(h=>h.id===event.otherId&&h.alive);
    if(choice==='skip'||!h||!other){this.acknowledgeEvent();return !other?'상대가 더 이상 살아 있지 않습니다.':'지금은 지나갑니다.';}
    if(Math.abs(h.position.x-other.position.x)+Math.abs(h.position.y-other.position.y)>3)return '3칸보다 멀리 있습니다. 지금은 지나간 뒤 가까이 이동하세요.';
    if(choice==='food'){const result=this.requestFood(other.id);this.acknowledgeEvent();return result==='accepted'?'식량 나눔 수락 · 식량 +1':result==='cooldown'?'같은 부탁은 7일 뒤 다시 할 수 있습니다.':'식량 나눔 부탁을 거절했습니다.';}
    if(choice==='teach'){
      if(!technology||!h.knowledge.includes(technology)||other.knowledge.includes(technology))return '전할 수 있는 지식이 없습니다.';
      const key=`teach:${h.id}:${other.id}`;if((this.data.timeline.requestUntil[key]??-1)>w.day)return '같은 전승 요청은 7일 뒤 다시 할 수 있습니다.';
      this.data.timeline.requestUntil[key]=w.day+7;
      this.technology(h.id,{kind:'teach',id:technology,targetId:other.id});this.acknowledgeEvent();return '지식 전승을 예약했습니다. 다음 날 결과가 표시됩니다.';
    }
    const key=`talk:${h.id}:${other.id}`;if((this.data.timeline.requestUntil[key]??-1)>w.day)return '같은 대화 요청은 7일 뒤 다시 할 수 있습니다.';
    this.data.timeline.requestUntil[key]=w.day+7;h.fatigue=Math.min(100,h.fatigue+3);
    const trust=other.relationships[h.id]?.trust??0;
    const accepted=this.random.next()<Math.max(.05,Math.min(.95,.3+other.traits.sociability/200+trust/300-other.hunger/200));
    if(accepted)for(const [a,b] of [[h,other],[other,h]]){const r=a.relationships[b.id]??{familiarity:0,trust:0};a.relationships[b.id]={familiarity:Math.min(100,r.familiarity+8),trust:Math.min(100,r.trust+5)};a.loneliness=Math.max(0,a.loneliness-20);}
    const text=`${other.name}: 대화 ${accepted?'수락 · 친밀 +8 / 신뢰 +5 / 외로움 −20':'거절'} · 피로 +3`;
    remember(w,h,{day:w.day,kind:accepted?'help':'refusal',text,otherId:other.id,otherName:other.name});this.data.randomState=this.random.state;this.acknowledgeEvent();return text;
  }
  private feedback(h:import('./model').HumanState,kind:string){h.command={id:this.data.commands.length,kind,status:'queued',text:`${kind} 예약`,day:this.data.world.day};}
  move(humanId: string, target: Point): boolean {
    const human = this.data.world.humans.find(h => h.id === humanId);
    if (!human||!this.controls(humanId)) return false;
    const path = findPath(this.data.world.map, human.position, target);
    if (!path) return false;
    human.work=null;human.techOrder=null;human.path = path; human.control='player';human.action='move';human.targetHumanId=null;human.reason='플레이어 이동 지시';this.feedback(human,'이동');
    this.data.commands.push({tick:this.data.world.day,type:'move',humanId,target:{...target}});
    return true;
  }
  act(humanId:string,action:Activity):boolean {
    const human=this.data.world.humans.find(h=>h.id===humanId);
    if(!human||!this.controls(humanId)||!['gather','explore','rest','socialize','fish','build','tend'].includes(action))return false;
    const previous=structuredClone(human), previousRandom=this.random.state;
    if(!planAction(this.data.world,human,action,this.random)){Object.assign(human,previous);this.random=new SeededRandom(previousRandom);return false;}
    human.techOrder=null;human.control='player';human.reason='플레이어 행동 지시';this.feedback(human,({gather:'채집',explore:'탐험',rest:'휴식',socialize:'교류',fish:'낚시',build:'거처 짓기',tend:'밭 돌보기'})[action]);
    this.data.commands.push({tick:this.data.world.day,type:'action',humanId,action});
    this.data.randomState=this.random.state;return true;
  }
  resumeAuto(humanId:string):boolean {
    const human=this.data.world.humans.find(h=>h.id===humanId);if(!human||!this.controls(humanId))return false;
    human.work=null;human.techOrder=null;human.control='auto';human.path=[];human.action='idle';human.targetHumanId=null;human.reason='지시 취소 · 자율 행동 복귀';if(human.command)human.command={...human.command,status:'cancelled',text:'지시 취소 · 자율 행동 복귀',day:this.data.world.day};
    this.data.commands.push({tick:this.data.world.day,type:'auto',humanId});return true;
  }
  technology(humanId:string,order:TechOrder):boolean {
    const h=this.data.world.humans.find(h=>h.id===humanId);
    if(!h||!this.controls(humanId)||!['fire','stone','storage','cultivation'].includes(order.id)||!['experiment','teach'].includes(order.kind))return false;
    if(order.kind==='experiment'?!canExperiment(this.data.world,h,order.id):!h.knowledge.includes(order.id))return false;
    h.work=null;h.techOrder={...order};h.path=[];h.control='player';h.action='idle';h.reason=order.kind==='experiment'?'실험 예약':'지식 전파 예약';this.feedback(h,order.kind==='experiment'?'실험':'전파');
    this.data.commands.push({tick:this.data.world.day,type:'technology',humanId,order:{...order}});return true;
  }
  step():SimulationSnapshot {this.tick();return this.snapshot();}
  private tick():void {
    if(!this.canAdvance())return;
    this.data.commands.push({ tick: this.data.world.day, type: 'wait' });
    if(this.data.timeline.mode==='history')historyDay(this.data);
    else for (const human of this.data.world.humans) {
      if(!human.alive)continue;
      if(human.control==='auto'&&!human.work&&this.data.world.day%30===29&&human.food>=3&&human.traits.curiosity>=50){
        const tech=TECHNOLOGIES.find(t=>canExperiment(this.data.world,human,t.id));
        if(tech&&dayChance(this.data.seed,this.data.world.day,Number(human.id.replace('human-',''))+600)<.2)human.techOrder={kind:'experiment',id:tech.id};
      }
      if(human.techOrder){resolveTechnology(this.data.world,human,this.random);human.control='player';}
      if(human.health>0)stepHuman(this.data.world,human,this.random);
      if((this.data.world.day+1)%7===0&&!human.knowledge.includes('storage')&&human.food>0)human.food--; 
    }
    populationDay(this.data);
    updateTechnology(this.data.world,this.random);
    this.data.world.day += 1;
    landscapeDay(this.data);
    this.events();
    this.data.randomState = this.random.state;
  }
}
