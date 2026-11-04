import {clamp,monthsLater,METRICS} from './model';
import type {State,Impact,PolicyChoice,Metrics} from './model';
export function trace(s:State,entry:Omit<Impact,'id'|'day'>,id?:string){const key=id??`${entry.policyId}:${s.day}:${s.impacts.length}`;if(s.impacts.some(e=>e.id===key))return;s.impacts.push({...entry,id:key,day:s.day});s.chronicle.push({day:s.day,kind:'cause',text:`[${entry.policyId} · ${entry.layer}] ${entry.text}`});}
export function startConsequences(s:State,id:string,index:number,c:PolicyChoice,before:Metrics){
 trace(s,{policyId:id,layer:'NATION',kind:'intended',text:`의도: ${c.benefit} / 예상 비용: ${c.risk}`,groups:['아르카디아 주민']});
 trace(s,{policyId:id,layer:'NATION',kind:'realized',text:'즉시 변화: '+Object.keys(c.instant).map(key=>{const k=key as keyof Metrics,delta=s.nation.metrics[k]-before[k];return `${METRICS[k]} ${delta>=0?'+':''}${delta.toFixed(1)}`;}).join(', '),groups:['아르카디아 주민']});
 // The independent global frontier is observed, not overwritten by one nation's policy.
 trace(s,{policyId:id,layer:'GLOBAL',kind:'intended',text:`세계 기술 최전선 ${s.global.technology.toFixed(1)}를 배경으로 국가의 도입·분배 방향 결정`,groups:['기술 도입 집단']});
 if(id==='E02'&&index===0)for(const [months,kind] of [[1,'investment'],[6,'displacement'],[36,'returns'],[48,'adaptation']] as const)s.chains.push({id:`E02:${kind}`,policyId:id,due:monthsLater(s.day,months),kind});
 if(id==='E03'&&s.policies.some(p=>p.id==='E02'&&p.choice===0))trace(s,{policyId:id,layer:'NATION',kind:index===0?'synergy':'conflict',text:index===0?'E02 자동화 전환과 공공 재교육의 시너지: 이후 고용 충격을 완화합니다.':'E02 자동화 전환과 교육 접근성의 긴장: 전환 기회가 고르게 닿지 않을 수 있습니다.',groups:['사무직','생산직','구직자']});
}
export function processConsequences(s:State){
 for(const effect of s.chains.filter(e=>e.due<=s.day)){
  const policyId=effect.policyId,w=s.nation.metrics;
  if(effect.kind==='investment'){
   const before=s.global.connectivity;s.global.connectivity=clamp(before+.5);trace(s,{policyId,layer:'GLOBAL',kind:'realized',text:`설비 수요와 기술 교역 증가: 세계 연결성 +${(s.global.connectivity-before).toFixed(1)}. 독립적인 기술 발전은 계속됩니다.`,groups:['기술 공급망']},effect.id+':global');
   for(const b of s.city.buildings.filter(b=>['office','factory'].includes(b.kind))){b.equipment=1;b.sourcePolicyId=policyId;}
   trace(s,{policyId,layer:'CITY',kind:'realized',text:'기업 투자 집행: 사무실과 공장에 자동화 설비 설치가 시작됐습니다.',groups:['기업','사무직','생산직']},effect.id);
  }else if(effect.kind==='displacement'){
   let lost=0,changed=0;const protection=clamp(s.rules.training*.25,0,.5);
   for(const h of s.population){if(!h.alive||!h.employed||!['office','factory'].includes(h.job))continue;
    const score=((Number(h.id.slice(1))*37+s.seed)%100)/100;
    const displaced=score<.28-protection,stressBefore=h.stress;h.stress=clamp(h.stress+(displaced?12:4));
    if(displaced){h.previousJob=h.job;h.job='unemployed';h.employed=false;if(h.order==='work')h.order=null;h.action='search';h.lastEvents.employmentShock=s.day;lost++;}else{h.action='ai';changed++;}
    h.history.push({day:s.day,text:`[${policyId}] ${displaced?'자동화 재편으로 실직 · 구직/재교육이 필요합니다.':'자동화 도구 도입으로 업무가 변경됐습니다.'}`});
    trace(s,{policyId,layer:'HUMAN',kind:'side-effect',humanId:h.id,change:displaced?'displaced':'work-changed',text:`${h.name}: ${displaced?'실직':'업무 변경'}, 스트레스 +${(h.stress-stressBefore).toFixed(1)}`,groups:[h.previousJob==='factory'?'생산직':'사무직']},effect.id+':'+h.id);
    if(h.id===s.playerId)s.followups.push({id:effect.id+':followup:'+h.id,humanId:h.id,policyId,due:s.day+1,eventId:'P13',resolved:false});
   }
   trace(s,{policyId,layer:'NATION',kind:'side-effect',text:`고용 재편: 실직 ${lost}명, 업무 변경 ${changed}명. 재교육 접근성이 충격을 조절했습니다.`,groups:['사무직','생산직']},effect.id);
  }else if(effect.kind==='returns'){
   const before={...w};w.productivity=clamp(w.productivity+6);w.environment=clamp(w.environment-3);const sharing=s.rules.dividend>0||s.rules.tax>.1;w.equality=clamp(w.equality+(sharing?2:-4));
   for(const b of s.city.buildings)if(b.sourcePolicyId===policyId)b.equipment=2;
   trace(s,{policyId,layer:'NATION',kind:sharing?'synergy':'side-effect',text:`3년 후: 생산성 +${(w.productivity-before.productivity).toFixed(1)}, 환경 ${(w.environment-before.environment).toFixed(1)}, 분배 ${(w.equality-before.equality).toFixed(1)} (${sharing?'분배 정책 시너지':'성과 집중'}). 도시의 자동화 설비가 가동됩니다.`,groups:['기업','노동자','환경 부담 집단']},effect.id);
  }else{
   const before={...w},trained=s.rules.training>.2;w.employment=clamp(w.employment+(trained?4:-2));w.trust=clamp(w.trust+(trained?2:-3));
   trace(s,{policyId,layer:'NATION',kind:trained?'synergy':'conflict',text:`4년 후: ${trained?'재교육과 자동화의 시너지':'전환 지원 부족의 충돌'}. 고용 ${(w.employment-before.employment).toFixed(1)}, 신뢰 ${(w.trust-before.trust).toFixed(1)}.`,groups:['구직자','재교육 참여자']},effect.id);
  }
 }
 s.chains=s.chains.filter(e=>e.due>s.day);
}
