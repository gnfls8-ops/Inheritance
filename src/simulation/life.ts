import type {Activity,HumanState,WorldState} from './model';
import type {Point} from './map';
export type LifeStage='child'|'youth'|'adult'|'elder';
export interface LifeProfile {home:Point;caregiverId:string|null;skills:Partial<Record<Activity,number>>;decision:'stay'|'migrate'|'invite'|null;decisionDay:number|null;destination:Point|null;arrivedDay:number|null;companionId:string|null;followup:'settle'|'roam'|null}
export function initialLife(home:Point,caregiverId:string|null=null):LifeProfile{return{home:{...home},caregiverId,skills:{},decision:null,decisionDay:null,destination:null,arrivedDay:null,companionId:null,followup:null};}
export function lifeStage(h:HumanState):LifeStage {return h.ageDays<12*365?'child':h.ageDays<18*365?'youth':h.ageDays<60*365?'adult':'elder';}
export const STAGES={child:'유년기',youth:'청소년기',adult:'성년기',elder:'노년기'};
export function lifeEffects(h:HumanState){
 const stage=lifeStage(h),frail=h.health<50;
 return{stage,effort:(stage==='child'?2:stage==='elder'?1:0)+(frail?2:0),recovery:stage==='child'?34:stage==='elder'?24:30,learning:stage==='child'?1.6:stage==='youth'?1.4:1};
}
export function practice(h:HumanState,action:Activity){h.life.skills[action]=Math.min(100,(h.life.skills[action]??0)+lifeEffects(h).learning);}
export function effort(h:HumanState,action:Activity){return Math.max(0,lifeEffects(h).effort-Math.floor((h.life.skills[action]??0)/40));}
export function caregiver(w:WorldState,h:HumanState){return w.humans.find(o=>o.id===h.life.caregiverId&&o.alive)??w.humans.filter(o=>o.id!==h.id&&o.alive&&o.ageDays>=18*365).sort((a,b)=>Math.abs(a.position.x-h.position.x)+Math.abs(a.position.y-h.position.y)-Math.abs(b.position.x-h.position.x)-Math.abs(b.position.y-h.position.y))[0];}
export function lifeDescription(h:HumanState){const e=lifeEffects(h);return `${STAGES[e.stage]} · 작업 피로 +${e.effort} · 휴식 회복 ${e.recovery} · 배움 ${e.learning}배${h.health<50?' · 건강 악화로 부담 증가':''}`;}
