import {INITIAL,METRICS,clamp,ageYears} from './model';
import type {Human,Metrics,Metric,State,Ending,Job} from './model';
import {JOBS} from './content';
import {SeededRandom} from '../simulation/random';
import {personalLog} from './people';
export function applyMetrics(s:State,effects:Partial<Metrics>,text:string){
 for(const [key,value] of Object.entries(effects)){const k=key as Metric,before=s.nation.metrics[k];s.nation.metrics[k]=clamp(before+value!);s.causes[k]={delta:s.nation.metrics[k]-before,text};}
}
export function worldMonth(s:State){
 const w=s.nation.metrics,r=s.rules;
 const changes:Partial<Metrics>={ai:(.10+r.innovation*.055)*(.6+w.stability/200)+(s.global.technology-w.ai)*.002*(.5+w.access/100),automation:(w.ai-w.automation)*.006,productivity:(w.automation-18)*.004+r.efficiency*.06,employment:(72-w.employment)*.012-(w.automation-18)*.0025+r.training*.15,equality:(w.welfare-48)*.002+r.dividend*.13-(w.automation-18)*.0015-r.innovation*.025,stability:(w.trust+w.equality-100)*.002,freedom:r.autonomy*.035,welfare:r.tax*.05,access:.05+r.training*.06+(s.global.connectivity-48)*.001,trust:(w.stability-60)*.002,environment:-(w.ai-25)*.0015+r.efficiency*.09+(s.global.energyEfficiency-35)*.0008};
 applyMetrics(s,changes,'월간 변화 · 기술 확산, 재교육, 분배와 신뢰의 상호작용');
}
export function security(h:Human,s:State){const j=JOBS[h.job];return clamp(82-s.nation.metrics.automation*j.exposure*.65+h.skill*.15+h.aiSkill*s.nation.metrics.access/1000+s.rules.training*12);}
export function seekJob(h:Human,s:State,rng:SeededRandom){
 if(ageYears(h)<20)return false;
 const chance=clamp(s.nation.metrics.employment*.006+h.skill*.002+s.rules.training*.15,.08,.95);
 if(rng.next()>chance){personalLog(h,s.day,'지원 결과: 채용으로 이어지지 않았습니다.');return false;}
 const jobs=(Object.keys(JOBS) as Job[]).filter(j=>j!=='unemployed');
 const old=h.job;h.job=jobs[Math.floor(rng.next()*jobs.length)];h.previousJob=h.job;h.employed=true;h.retired=false;h.jobChangedDay=s.day;
 personalLog(h,s.day,`${JOBS[old].name} → ${JOBS[h.job].name} · 새로운 직업`);return true;
}
export function economyMonth(s:State,rng:SeededRandom){
 const w=s.nation.metrics,r=s.rules;
 for(const h of s.population){
  if(!h.alive)continue;
  const adult=ageYears(h)>=20;
  if(!adult){h.employed=false;h.job='unemployed';h.income=0;}
  h.jobSecurity=security(h,s);
  if(h.employed&&rng.next()<(100-h.jobSecurity)/100*.025){h.previousJob=h.job;h.job='unemployed';h.employed=false;h.stress=clamp(h.stress+14*(1-w.welfare/140));personalLog(h,s.day,'업무 수요 변화로 직장을 잃었습니다. 사회보장과 재교육 조건이 다음 생활을 바꿉니다.');}
  if(adult&&!h.employed&&!h.retired&&h.recent.includes('search')&&rng.next()<.25)seekJob(h,s,rng);
  if(h.trainingDue!==null&&s.day>=h.trainingDue){h.skill=clamp(h.skill+12*(1+r.training));h.education=clamp(h.education+8);h.trained=true;h.trainingDue=null;personalLog(h,s.day,'재교육 수료 · 숙련과 직업 전환 준비가 높아졌습니다.');}
  const base=JOBS[h.job].salary;
  const aiBenefit=h.aiSkill/100*w.access/100;
  const gross=h.employed?base*(.75+w.productivity/180)*(.65+h.skill/140)*clamp(h.workUnits/11,.45,1.6)*(1+aiBenefit*.35+s.city.automation*.001):0;
  const benefits=adult?(h.retired?w.welfare*1.4:!h.employed?w.welfare*1.05:0)+w.productivity*r.dividend:0;
  const retailOpen=s.city.buildings.find(b=>b.kind==='shop')!.operating;
  h.income=Math.max(0,gross*(!retailOpen&&['service','business'].includes(h.job)?.55:1)*(1-clamp(.08+r.tax,0,.5))+h.creativeIncome+benefits);
  const housing=adult?140:50;h.expenses=housing*(1+(100-w.environment)*.002+(100-w.equality)*.001)*(1-s.city.transit*.001);
  h.assets+=h.income-h.expenses;h.workUnits=0;h.creativeIncome=0;
  if(h.assets<0)h.stress=clamp(h.stress+5*(1-w.welfare/150));
  if(h.id===s.playerId)personalLog(h,s.day,`월 결산 · 수입 ${Math.round(h.income)} / 생활비 ${Math.round(h.expenses)} / 자산 ${Math.round(h.assets)} · 복지 ${Math.round(w.welfare)}, 접근성 ${Math.round(w.access)}`);
 }
 // Household support transfers existing wealth, instead of granting children adult jobs.
 for(const h of s.population.filter(p=>p.alive&&ageYears(p)<20)){
  const guardian=s.population.find(p=>p.id===h.familyId&&p.alive&&ageYears(p)>=20);
  const amount=guardian?Math.min(h.expenses,Math.max(0,guardian.assets)):0;
  if(guardian){guardian.assets-=amount;h.assets+=amount;}
  const publicSupport=(h.expenses-amount)*w.welfare/100;h.assets+=publicSupport;h.income=amount+publicSupport;
 }
 const live=s.population.filter(h=>h.alive);const wellbeing=live.reduce((a,h)=>a+h.happiness,0)/Math.max(1,live.length);
 applyMetrics(s,{wellbeing:(wellbeing-w.wellbeing)*.12},'가상 주민의 건강·관계·성취·경제 안정과 스트레스');
}
export function classifyEnding(s:State):Ending{
 const w=s.nation.metrics;
 const title=w.stability<38||w.trust<30?'불안정한 전환 사회':w.automation>=48&&w.equality<40?'불평등한 자동화 사회':w.freedom>=75&&w.welfare>=60&&w.wellbeing>=55?'인간 중심 사회':w.productivity>=65&&w.access>=55?'기술 번영 사회':'안정 중심 사회';
 const descriptions:Record<string,string>={'불안정한 전환 사회':'기술의 속도와 사회가 적응하는 속도 사이에 틈이 남았습니다.','불평등한 자동화 사회':'더 많은 것을 생산하지만 기회와 보상이 고르게 닿지는 않았습니다.','인간 중심 사회':'기술의 성과를 선택의 여유와 삶의 안전망으로 나누려 했습니다.','기술 번영 사회':'높은 생산성과 접근성이 새로운 가능성을 열었습니다.','안정 중심 사회':'급격한 전환 속에서도 생활의 연속성과 안정에 무게를 두었습니다.'};
 const entries=(Object.keys(INITIAL) as Metric[]).map(k=>({k,delta:w[k]-INITIAL[k]})).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
 const most=entries[0];const problems=entries.filter(e=>e.delta<0).sort((a,b)=>a.delta-b.delta);
 return{title,description:descriptions[title],traits:[w.equality<45?'분배의 격차가 남았습니다.':'분배 균형을 지켰습니다.',w.environment<45?'환경 비용이 다음 세대에 남았습니다.':'환경의 지속성을 고려했습니다.',w.freedom<60?'자유의 제약을 함께 돌아봐야 합니다.':'개인의 선택 여지를 유지했습니다.'],largestChange:`${METRICS[most.k]} ${Math.round(INITIAL[most.k])} → ${Math.round(w[most.k])}`,unintended:problems.length?`${METRICS[problems[0].k]} 하락 ${Math.round(problems[0].delta)} · 선택의 편익과 함께 남은 비용`:'어떤 지표의 개선도 모든 개인의 행복을 보장하지는 않았습니다.'};
}
