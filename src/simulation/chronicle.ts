import type {HumanState,WorldState} from './model';
import type {TechnologyId} from './technology';
export type TransmissionMethod='direct'|'social'|'history';
export interface LifeEntry {day:number;kind:'discovery'|'learning'|'teaching'|'help'|'refusal'|'death'|'world'|'loss';text:string;technology?:TechnologyId;otherId?:string;otherName?:string}
export interface PersonChronicle {name:string;entries:LifeEntry[]}
export interface Transmission {technology:TechnologyId;fromId:string;fromName:string;toId:string;toName:string;day:number;method:TransmissionMethod}
export interface Legacy {people:Record<string,PersonChronicle>;transmissions:Transmission[]}
export function remember(w:WorldState,h:HumanState,entry:LifeEntry){w.legacy.people[h.id]??={name:h.name,entries:[]};w.legacy.people[h.id].entries.push(entry);}
export function nameOf(w:WorldState,id:string){return w.humans.find(h=>h.id===id)?.name??w.legacy.people[id]?.name??id;}
export function calendar(day:number){return `제 ${day+1}일`;}
export function withParticle(name:string){const char=name.charCodeAt(name.length-1);const digit=name.at(-1);const consonant=char>=0xac00&&char<=0xd7a3?(char-0xac00)%28!==0:!!digit&&'013678'.includes(digit);return `${name}${consonant?'과':'와'}`;}
export function years(h:HumanState){return Math.floor(h.ageDays/365);}
