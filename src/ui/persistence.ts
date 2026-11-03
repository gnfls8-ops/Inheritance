import {Simulation} from '../simulation/Simulation';
import type {SimulationSnapshot} from '../simulation/model';
export const SAVE_KEY='inheritance.autosave.v3';
export const BACKUP_KEY=SAVE_KEY+'.backup';
// Daily wait commands dominate long histories. Lossless run encoding keeps two saves within browser quotas.
function decode(raw:string):Simulation {
 const data=JSON.parse(raw);
 if(data.storageEncoding==='wait-runs-v1'){
  let total=0;
  data.commands=data.commands.flatMap((command:{type:string;tick:number;count?:number})=>{
   if(command.type!=='wait-run'){total++;return[command];}
   if(!Number.isInteger(command.count)||command.count!<2||command.count!>1_000_000||!Number.isInteger(command.tick))throw new Error('Invalid wait run');
   total+=command.count!;if(total>1_000_000)throw new Error('Save exceeds command limit');
   return Array.from({length:command.count!},(_,i)=>({type:'wait',tick:command.tick+i}));
  });
  delete data.storageEncoding;
 }
 return Simulation.restore(data);
}
function encode(snapshot:SimulationSnapshot):string{
 const commands:Array<{type:string;tick:number;count?:number}>=[];let compressed=false;
 for(const command of snapshot.commands){
  const last=commands.at(-1);
  if(command.type==='wait'&&last&&(last.type==='wait'||last.type==='wait-run')&&command.tick===last.tick+(last.count??1)){
   last.type='wait-run';last.count=(last.count??1)+1;compressed=true;
  }else commands.push({...command});
 }
 return JSON.stringify(compressed?{...snapshot,commands,storageEncoding:'wait-runs-v1'}:snapshot);
}
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function readAutosave(storage:Store):{simulation:Simulation|null;message:string}{
 let damaged=false;
 try{
  for(const key of [SAVE_KEY,BACKUP_KEY]){
   const raw=storage.getItem(key);if(!raw)continue;
   try{return{simulation:decode(raw),message:key===SAVE_KEY?'자동 저장 복원 · 일시정지':'이전 자동 저장 복원 · 일시정지'};}
   catch{damaged=true;}
  }
  return{simulation:null,message:damaged?'자동 저장이 손상되었습니다. 저장 파일을 불러오거나 새 삶을 시작하세요.':''};
 }catch{return{simulation:null,message:'브라우저 저장소에 접근할 수 없습니다. 파일 저장을 이용하세요.'};}
}
export function writeAutosave(storage:Store,snapshot:SimulationSnapshot):boolean{
 try{
  const value=encode(snapshot),previous=storage.getItem(SAVE_KEY);
  // Never promote a damaged primary over a recoverable backup.
  if(previous&&previous!==value){try{decode(previous);storage.setItem(BACKUP_KEY,previous);}catch{/* keep the existing backup */}}
  storage.setItem(SAVE_KEY,value);return true;
 }catch{return false;}
}
export function browserSave():ReturnType<typeof readAutosave>{
 try{return readAutosave(window.localStorage);}catch{return{simulation:null,message:'자동 저장을 사용할 수 없습니다. 파일 저장을 이용하세요.'};}
}
