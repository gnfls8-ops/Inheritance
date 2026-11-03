import type {Timeline,TimeMode} from './time';
import type { TechOrder, TechStatus, TechRecord, TechnologyId } from './technology';
import type { Point, TileMap } from './map';
export type Speed = 1 | 2 | 4;
export type Activity = 'gather' | 'explore' | 'rest' | 'socialize';
export type HumanAction = Activity | 'idle' | 'move';
export interface Traits { curiosity: number; stability: number; sociability: number; riskTaking: number }
export interface Relationship { familiarity: number; trust: number }
export interface HumanState {
  id: string; name: string; position: Point; path: Point[]; ageDays: number;
  alive: boolean; deathDay: number | null; health: number; hunger: number; fatigue: number; loneliness: number; food: number;
  techOrder: TechOrder | null; learnedAt: Partial<Record<TechnologyId,number>>; traits: Traits; knowledge: string[]; relationships: Record<string, Relationship>;
  action: HumanAction; control: 'auto' | 'player'; targetHumanId: string | null;
  visited: number[]; reason: string;
}
export interface RegionState { id: string; name: string; humanIds: string[] }
export interface ActivityRecord { day: number; humanId: string; text: string }
export interface WorldState {
  era: 'prehistory'; day: number; map: TileMap; region: RegionState; humans: HumanState[];
  technologies: Record<TechnologyId,TechStatus>; technologyLog: TechRecord[]; resources: number[]; activityLog: ActivityRecord[];
}
export type Command = {tick:number;type:'mode';mode:TimeMode}|{tick:number;type:'retire'|'event';humanId:string}
  | {tick:number;type:'choose'|'review'|'request';humanId:string}
  | { tick: number; type: 'wait' }
  | { tick: number; type: 'move'; humanId: string; target: Point }
  | { tick: number; type: 'action'; humanId: string; action: Activity }
  | {tick:number;type:'technology';humanId:string;order:TechOrder}
  | { tick: number; type: 'auto'; humanId: string };
export interface LifeSummary {humanId:string;name:string;startedDay:number;diedDay:number;retired?:boolean;knowledge:string[];relationships:Record<string,Relationship>}
export interface PlayerState {humanId:string|null;phase:'choose'|'playing'|'summary'|'successor';startedDay:number;summary:LifeSummary|null}
export interface SimulationSnapshot { timeline:Timeline; player:PlayerState; version: 2; seed: number; randomState: number; world: WorldState; commands: Command[] }
