export const INITIAL={ai:30,automation:18,productivity:45,employment:72,equality:42,stability:65,freedom:70,welfare:48,access:35,trust:50,environment:55,wellbeing:58};
export type Metric=keyof typeof INITIAL;
export type Metrics=Record<Metric,number>;
export const METRICS:Record<Metric,string>={ai:'AI 역량',automation:'자동화',productivity:'생산성',employment:'고용 기회',equality:'분배 균형',stability:'사회 안정',freedom:'자유',welfare:'사회보장',access:'AI 접근성',trust:'공공 신뢰',environment:'환경',wellbeing:'삶의 질'};
export const ACTIONS={work:'노동',learn:'학습',ai:'AI 활용',create:'창작',social:'교류',rest:'휴식',search:'기회 탐색',community:'공동체 활동'};
export type Action=keyof typeof ACTIONS;
export const PRIORITIES={balance:'안정적인 생활',wealth:'경제적 성공',knowledge:'지식과 탐구',expression:'창작과 자아실현',connection:'관계와 공동체'};
export type Priority=keyof typeof PRIORITIES;
export type Job='office'|'tech'|'factory'|'service'|'education'|'art'|'business'|'unemployed';
export interface Traits {curiosity:number;stability:number;sociability:number;riskTaking:number}
export interface Human {id:string;name:string;birthDay:number;ageDays:number;retired:boolean;region:string;appearance:{skin:number;clothing:number;gender:'여성'|'남성'|'논바이너리'};job:Job;previousJob:Job;employed:boolean;income:number;expenses:number;assets:number;education:number;skill:number;aiSkill:number;health:number;stress:number;happiness:number;relationships:number;family:string;familyId:string|null;achievement:number;energy:number;jobSecurity:number;traits:Traits;deathDay:number|null;alive:boolean;action:Action;recent:Action[];priority:Priority;order:Action|null;workUnits:number;creativeIncome:number;trainingDue:number|null;trained:boolean;jobChangedDay:number|null;lastEvents:Record<string,number>;history:Array<{day:number;text:string}>;thought:string;position:{x:number;y:number};target:{x:number;y:number};}
export interface Rules {innovation:number;training:number;tax:number;dividend:number;workHours:number;creative:number;autonomy:number;efficiency:number}
export const INITIAL_RULES:Rules={innovation:0,training:0,tax:0,dividend:0,workHours:0,creative:0,autonomy:0,efficiency:0};
export interface PolicyChoice {label:string;benefit:string;risk:string;instant:Partial<Metrics>;delayed:Partial<Metrics>;months:number;rules:Partial<Rules>}
export interface WorldEvent {id:string;title:string;description:string;earliest:number;requires?:string;threshold:Partial<Metrics>;choices:PolicyChoice[]}
export interface PersonalChoice {label:string;detail:string;effects:Partial<Record<'assets'|'health'|'stress'|'happiness'|'skill'|'aiSkill'|'relationships'|'achievement',number>>;job?:'new'|'lose';training?:boolean;priority?:Priority}
export interface PersonalEvent {id:string;title:string;description:string;condition:(h:Human,s:State)=>boolean;choices:PersonalChoice[]}
export interface LifeRecord {id:string;name:string;job:Job;startDay:number;endDay:number;status:'interim'|'deceased';reason:string;startAssets:number;endAssets:number;startHappiness:number;endHappiness:number;worldStart:Metrics;worldEnd:Metrics;entries:Array<{day:number;text:string}>}
export interface Ending {title:string;description:string;traits:string[];largestChange:string;unintended:string}
export interface GlobalLayer {technology:number;energyEfficiency:number;connectivity:number}
export interface CityBuilding {id:string;kind:'office'|'school'|'factory'|'art'|'lab'|'home'|'shop';x:number;y:number;w:number;d:number;height:number;level:number;phase:'existing'|'construction'|'complete';progress:number;startedDay:number|null;completedDay:number|null}
export interface CityLayer {id:'arcadia-capital';name:string;buildings:CityBuilding[];transit:number;automation:number;green:number;education:number;history:Array<{day:number;buildingId:string;text:string}>}
export interface CityFrame {day:number;city:CityLayer;metrics:Metrics;global:GlobalLayer}
export interface State {version:23;global:GlobalLayer;nation:{id:'arcadia';name:'아르카디아';metrics:Metrics};city:CityLayer;seed:number;randomState:number;day:number;phase:'world-event'|'assignment'|'tutorial'|'playing'|'personal-event'|'life-summary'|'ending';rules:Rules;population:Human[];playerId:string|null;observedId:string|null;assignment:{day:number;assets:number;happiness:number;world:Metrics}|null;pending:string|null;policies:Array<{id:string;choice:number;day:number}>;delayed:Array<{id:string;due:number;effects:Partial<Metrics>}>;applied:string[];chronicle:Array<{day:number;kind:string;text:string}>;lives:LifeRecord[];perspectives:number[];lastPersonalDay:number;causes:Record<Metric,{delta:number;text:string}>;ending:Ending|null;commands:Array<{day:number;type:string;value:string}>;tutorialSeen:boolean}
export const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
export const EPOCH=Date.UTC(2026,0,1),DAY=86400000;
export const dateOf=(day:number)=>new Date(EPOCH+day*DAY);
export const yearOf=(day:number)=>dateOf(day).getUTCFullYear();
export const dayOfYear=(year:number)=>Math.round((Date.UTC(year,0,1)-EPOCH)/DAY);
export const END_DAY=dayOfYear(2050);
export const dateLabel=(day:number)=>dateOf(day).toLocaleDateString('ko-KR',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric'});
export function monthsLater(day:number,months:number){const d=dateOf(day),wanted=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(wanted,last));return Math.round((d.getTime()-EPOCH)/DAY);}

export function ageYears(h:Human){const born=dateOf(h.birthDay),now=dateOf(h.birthDay+h.ageDays);return now.getUTCFullYear()-born.getUTCFullYear()-(now.getUTCMonth()<born.getUTCMonth()||now.getUTCMonth()===born.getUTCMonth()&&now.getUTCDate()<born.getUTCDate()?1:0);}
