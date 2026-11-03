import {expect,it} from 'vitest';
import {Simulation} from '../simulation/Simulation';
import {SAVE_KEY,BACKUP_KEY,readAutosave,writeAutosave} from './persistence';
function store(){const values=new Map<string,string>();return{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};}
it('restores current identity, chronology, RNG and pending action',()=>{
 const storage=store(),s=new Simulation();s.choosePlayer('human-1');s.act('human-1','rest');
 expect(writeAutosave(storage,s.snapshot())).toBe(true);
 expect(readAutosave(storage).simulation?.snapshot()).toEqual(s.snapshot());
});
it('recovers a valid backup when the newest save is damaged, without destroying it on the next write',()=>{
 const storage=store(),s=new Simulation();s.choosePlayer('human-1');const first=s.snapshot();
 writeAutosave(storage,first);s.step();writeAutosave(storage,s.snapshot());storage.setItem(SAVE_KEY,'broken');
 expect(readAutosave(storage).simulation?.snapshot()).toEqual(first);
 writeAutosave(storage,s.snapshot());expect(JSON.parse(storage.getItem(BACKUP_KEY)!)).toEqual(first);
});
it('reports blocked or full storage without corrupting the simulation',()=>{
 const s=new Simulation(),before=s.snapshot(),storage=store();storage.setItem=()=>{throw new Error('quota');};
 expect(writeAutosave(storage,before)).toBe(false);expect(s.snapshot()).toEqual(before);
 storage.getItem=()=>{throw new Error('blocked');};expect(readAutosave(storage).message).toContain('접근');
});
it('does not restore an invalid life phase',()=>{
 const storage=store(),s=new Simulation();s.choosePlayer('human-1');const d=s.snapshot();d.player.phase='summary';storage.setItem(SAVE_KEY,JSON.stringify(d));
 expect(readAutosave(storage).simulation).toBeNull();expect(readAutosave(storage).message).toContain('손상');
});
it('losslessly compresses long daily command histories for two browser save slots',()=>{
 const storage=store(),s=new Simulation();s.choosePlayer('human-1');const d=s.snapshot();
 for(let tick=0;tick<109500;tick++)d.commands.push({type:'wait',tick});
 expect(writeAutosave(storage,d)).toBe(true);
 expect(storage.getItem(SAVE_KEY)!.length).toBeLessThan(JSON.stringify(d).length/5);
 expect(readAutosave(storage).simulation?.snapshot()).toEqual(d);
});
