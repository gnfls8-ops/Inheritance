import {expect,it} from 'vitest';
import {Simulation} from './Simulation';
import type {SimulationSnapshot} from './model';
import {learn} from './technology';
import {nameOf,withParticle} from './chronicle';
function setup(){const s=new Simulation();s.choosePlayer('human-1');return s;}
function data(s:Simulation){return (s as unknown as {data:SimulationSnapshot}).data;}
it('restores a living retired v2 character without changing the world or choosing another person',()=>{
 const s=setup(),old:any=s.snapshot();old.version=2;old.world.day=123;
 old.player.phase='successor';old.player.summary={retired:true,humanId:'human-1',name:'아라',startedDay:0,diedDay:123,knowledge:[],relationships:{}};
 old.timeline.mode='history';delete old.world.legacy;delete old.timeline.requestUntil;
 for(const h of old.world.humans){delete h.command;delete h.socialCooldown;delete h.deathCause;}
 const before=structuredClone(old),r=Simulation.restore(old).snapshot();
 expect(r.version).toBe(4);expect(r.player).toMatchObject({humanId:'human-1',phase:'playing',summary:null});expect(r.timeline.mode).toBe('daily');
 expect(r.world.day).toBe(123);expect(r.world.resources).toEqual(before.world.resources);
 expect(r.world.humans.map(h=>h.position)).toEqual(before.world.humans.map((h:any)=>h.position));expect(old).toEqual(before);
});
it('rejects forged living succession in current saves and blocks retirement',()=>{
 const s=setup();expect(s.retire()).toBe(false);const d=s.snapshot();d.player.phase='successor';
 d.player.summary={humanId:'human-1',name:'아라',startedDay:0,diedDay:0,knowledge:[],relationships:{}};
 expect(()=>Simulation.restore(d)).toThrow();expect(s.setMode('history')).toBe(false);
});
it('repeated paused food requests do not consume RNG or resources',()=>{
 const s=setup();s.requestFood('human-2');const before=s.snapshot();
 expect(s.requestFood('human-2')).toBe('cooldown');expect(s.snapshot()).toEqual(before);
});
it('same-day deaths do not count dead people as surviving influence',()=>{
 const s=setup(),d=data(s);for(const h of d.world.humans.slice(0,2)){h.health=0;h.knowledge=['fire'];}
 s.step();expect(s.snapshot().player.summary?.impact?.[0].holders).toEqual([]);
});
it('records discoveries separately from direct, social and history transmission with durable names',()=>{
 const s=setup(),d=data(s),[a,b,c,e]=d.world.humans;
 learn(d.world,a,'fire',{method:'experiment'});
 for(const [h,method] of [[b,'direct'],[c,'social'],[e,'history']] as const)learn(d.world,h,'fire',{teacher:a,method});
 d.world.day=1;expect(d.world.legacy.people[a.id].entries.filter(e=>e.kind==='discovery')).toHaveLength(1);
 expect(d.world.legacy.transmissions.map(e=>e.method)).toEqual(['direct','social','history']);
 d.world.humans=d.world.humans.filter(h=>h.id!==b.id);
 expect(nameOf(d.world,b.id)).toBe(b.name);expect(Simulation.restore(s.snapshot()).snapshot()).toEqual(s.snapshot());
});
it('manual action feedback transitions from queued to completed and cancellation is explicit',()=>{
 const s=setup();s.act('human-1','rest');expect(s.snapshot().world.humans[0].command?.status).toBe('queued');
 s.step();expect(s.snapshot().world.humans[0].command?.status).toBe('completed');
 s.act('human-1','explore');s.resumeAuto('human-1');expect(s.snapshot().world.humans[0].command?.status).toBe('cancelled');
});
it('encounters identify real people, handle distance and allow skipping without rewards',()=>{
 const s=setup(),d=data(s);d.timeline.pending={id:'encounter',title:'만남',important:true,day:0,otherId:'human-2'};
 d.world.humans[1].position={x:40,y:40};const before=s.snapshot().world;
 expect(s.respondToEncounter('talk')).toContain('멀리');expect(s.snapshot().timeline.pending).not.toBeNull();
 s.respondToEncounter('skip');expect(s.snapshot().timeline.pending).toBeNull();expect(s.snapshot().world).toEqual(before);
});
it('uses Korean particles for names and numbered descendants',()=>{expect(withParticle('해솔')).toBe('해솔과');expect(withParticle('아라')).toBe('아라와');expect(withParticle('후대 12')).toBe('후대 12와');});
it('non-blocking invitations offer interaction after 45 game days and cannot be reopened repeatedly',()=>{
 const s=setup(),d=data(s);d.world.day=44;
 for(const h of d.world.humans){h.position={x:22,y:22};h.control='player';h.action='rest';h.path=[];}
 s.step();const event=s.snapshot().timeline.events.find(e=>e.id==='opportunity');
 expect(event?.day).toBe(45);expect(s.snapshot().timeline.pending).toBeNull();
 expect(s.openEncounter()).toBe(true);expect(s.canAdvance()).toBe(false);
 s.respondToEncounter('skip');expect(s.openEncounter()).toBe(false);expect(s.canAdvance()).toBe(true);
});
