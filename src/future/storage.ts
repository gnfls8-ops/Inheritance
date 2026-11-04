import type {State} from './model';
import {migrate} from './layers';
import {validate} from './validation';
const DB='inheritance-future-v2';
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('saves');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('다른 탭에서 저장소를 사용 중입니다.'));});}
export async function save(state:State){validate(state);const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(structuredClone(state),'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export async function load():Promise<State|null>{const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('saves','readonly'),req=tx.objectStore('saves').get('current');req.onsuccess=()=>{try{const value=req.result?migrate(req.result):null;if(value)validate(value);resolve(value);}catch(e){reject(e);}};req.onerror=()=>reject(req.error);});}finally{db.close();}}
export function exportSave(state:State){const url=URL.createObjectURL(new Blob([JSON.stringify(state)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`INHERITANCE-2.4-${state.seed}-${state.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function importSave(file:File){if(file.size>8_000_000)throw new Error('저장 파일이 너무 큽니다.');const raw:unknown=JSON.parse(await file.text());const value=migrate(raw);validate(value);return value;}
