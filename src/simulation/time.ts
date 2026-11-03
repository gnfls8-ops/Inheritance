export type TimeMode='daily'|'life'|'history';
export const TIME_MODES={daily:{label:'생활',days:1},life:{label:'생애',days:30},history:{label:'역사',days:1825}} as const;
export interface WorldEvent {id:string;day:number;title:string;important:boolean;otherId?:string;otherName?:string;reason?:string}
export interface Timeline {requestUntil:Record<string,number>;mode:TimeMode;pending:WorldEvent|null;last:Record<string,number>;events:WorldEvent[];culture:{cooperation:number;tradition:number};nextHuman:number;births:number;deaths:number}
export function initialTimeline():Timeline{return{requestUntil:{},mode:'daily',pending:null,last:{},events:[],culture:{cooperation:25,tradition:25},nextHuman:13,births:0,deaths:0};}
/** Stateless daily hazard: batching, rendering FPS and mode never enter this hash. */
export function dayChance(seed:number,day:number,salt:number):number {let n=(seed^Math.imul(day+1,2654435761)^salt)>>>0;n=Math.imul(n^(n>>>16),2246822507);return ((n^(n>>>13))>>>0)/4294967296;}
