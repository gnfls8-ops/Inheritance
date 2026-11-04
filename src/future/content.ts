import {ageYears} from './model';
import type {Job,WorldEvent,PolicyChoice,PersonalEvent,PersonalChoice} from './model';
export const JOBS:Record<Job,{name:string;salary:number;exposure:number;weight:number}>={office:{name:'사무직',salary:260,exposure:.9,weight:23},tech:{name:'개발·기술직',salary:390,exposure:.35,weight:12},factory:{name:'제조·현장직',salary:245,exposure:.75,weight:17},service:{name:'서비스직',salary:205,exposure:.5,weight:20},education:{name:'교육·연구직',salary:300,exposure:.3,weight:10},art:{name:'예술·창작직',salary:190,exposure:.65,weight:6},business:{name:'자영업',salary:280,exposure:.45,weight:7},unemployed:{name:'구직·무직',salary:0,exposure:0,weight:5}};
const c=(label:string,benefit:string,risk:string,instant:PolicyChoice['instant'],delayed:PolicyChoice['delayed'],rules:PolicyChoice['rules'],months=24):PolicyChoice=>({label,benefit,risk,instant,delayed,rules,months});
export const WORLD_EVENTS:WorldEvent[]=[
{id:'E01',title:'AI의 대중화',description:'2026년. AI가 사무실과 교실, 작업실로 들어옵니다. 누가 기술을 만들고, 누가 이용할 수 있어야 할까요?',earliest:2026,threshold:{},choices:[
c('민간 중심 AI 개발 촉진','투자와 기술 활용이 빨라집니다.','접근 격차와 전환 비용이 개인에게 쏠릴 수 있습니다.',{ai:5,productivity:3,equality:-3},{ai:3,automation:4,trust:-3},{innovation:.25,tax:-.02}),
c('공공 AI 접근성 확대','일상과 교육에서 기술을 사용할 기회가 넓어집니다.','재정과 운영 비용을 함께 부담합니다.',{access:10,welfare:3,productivity:-2},{access:5,equality:4},{training:.12,tax:.03}),
c('안전성 검증 우선','검증과 책임을 토대로 신뢰를 쌓습니다.','개발과 도입 속도가 늦어질 수 있습니다.',{trust:9,stability:4,ai:-2},{trust:4,ai:2},{innovation:-.12,autonomy:-.08})]},
{id:'E02',title:'노동 자동화의 확산',description:'반복 업무가 줄어드는 만큼 새로운 역할을 배울 시간과 비용이 필요합니다.',earliest:2027,requires:'E01',threshold:{automation:20},choices:[
c('자동화 촉진','생산성과 사업 확장에 힘을 싣습니다.','전환에 준비되지 않은 노동자의 고용이 흔들립니다.',{automation:8,productivity:5,employment:-5},{productivity:4,equality:-4},{innovation:.15,workHours:.08}),
c('재교육 확대','직업을 바꿀 수 있는 능력과 경로를 만듭니다.','효과가 나타나기까지 비용과 시간이 듭니다.',{welfare:3,productivity:-2},{employment:7,access:4},{training:.3,tax:.04}),
c('노동 보호 강화','급격한 해고와 소득 충격을 줄입니다.','신규 고용과 자동화 확산이 느려집니다.',{employment:5,stability:5,automation:-3},{equality:3,productivity:-2},{workHours:-.15,innovation:-.08})]},
{id:'E03',title:'AI 교육 혁명',description:'개인별 교육 도구가 확산됩니다. 교육의 기회를 어떻게 나눌까요?',earliest:2029,requires:'E02',threshold:{ai:32,access:25},choices:[
c('공공 교육 투자','직업과 소득에 관계없이 학습 기회를 넓힙니다.','현재의 소득 일부를 미래 교육에 투자합니다.',{access:6,welfare:4},{employment:5,equality:5},{training:.25,tax:.04}),
c('민간 교육 경쟁 촉진','전문 교육과 새로운 서비스의 공급이 늘어납니다.','좋은 교육에 드는 비용과 격차가 커질 수 있습니다.',{ai:4,productivity:3,equality:-4},{access:4,ai:3},{innovation:.15,training:.08}),
c('전통적 교육 체계 유지','사람이 가르치는 관계와 안정성을 지킵니다.','새 도구에 적응하는 속도가 상대적으로 느립니다.',{trust:5,stability:3,access:-2},{employment:2,ai:-2},{training:.05,autonomy:.05})]},
{id:'E04',title:'창작의 대중화',description:'누구나 이미지와 음악, 소프트웨어를 만들 수 있습니다. 새로운 기회와 기존 창작자의 생계가 충돌합니다.',earliest:2031,requires:'E03',threshold:{ai:38},choices:[
c('창작 도구 접근성 확대','더 많은 사람이 표현하고 새로운 수입을 찾습니다.','공급 증가로 기존 작품의 수입이 흔들릴 수 있습니다.',{access:7,freedom:4,equality:-2},{wellbeing:3,productivity:3},{creative:.25,autonomy:.1}),
c('창작자 권리 보호 강화','기존 창작자의 권리와 수입을 보호합니다.','도구 이용 비용과 허가 절차가 늘어납니다.',{trust:5,equality:3,access:-3},{stability:3},{creative:.12,tax:.02}),
c('기존 제도 유지','새 제도의 전환 비용을 피합니다.','불확실한 권리와 플랫폼 격차가 남습니다.',{stability:2,trust:-2},{equality:-3,freedom:2},{creative:.04,innovation:.04})]},
{id:'E05',title:'자동화 이익의 분배',description:'생산은 늘었지만 모두가 같은 몫을 얻지는 못합니다. 자동화의 이익을 어떻게 나눌까요?',earliest:2033,requires:'E04',threshold:{automation:25,productivity:40},choices:[
c('시장 중심 분배','투자와 기업 성과에 높은 보상을 둡니다.','자산과 기회의 격차가 커질 수 있습니다.',{productivity:6,equality:-8},{ai:4,equality:-4},{innovation:.2,tax:-.04}),
c('사회보장 확대','실직과 빈곤의 충격을 함께 나눕니다.','세금과 행정 비용이 늘어납니다.',{welfare:10,equality:5,productivity:-2},{stability:5,wellbeing:4},{tax:.08,dividend:.08}),
c('공공 기술 배당 실험','기술 성과의 일부를 모든 주민에게 돌립니다.','지속 가능한 재원과 제도 신뢰가 필요합니다.',{welfare:6,equality:6,trust:-2},{trust:4,wellbeing:4},{dividend:.25,tax:.06})]},
{id:'E06',title:'인간과 AI의 신뢰',description:'AI가 채용·의료·금융 판단에 깊게 관여합니다. 편리함과 책임, 자유를 함께 따져야 합니다.',earliest:2036,requires:'E05',threshold:{ai:43,automation:25},choices:[
c('자율적 활용 확대','선택과 실험의 자유가 늘어납니다.','실패에 대한 책임이 개인에게 돌아올 수 있습니다.',{freedom:7,access:4,trust:-5},{ai:3,stability:-3},{autonomy:.2,innovation:.1}),
c('투명성·책임 규제 강화','판단을 설명하고 이의를 제기할 길을 만듭니다.','검증과 운영 비용이 증가합니다.',{trust:9,freedom:2,productivity:-2},{stability:4},{autonomy:.05,tax:.03}),
c('고위험 분야 사용 제한','중대한 피해를 예방하는 데 우선순위를 둡니다.','편익과 접근성도 제한될 수 있습니다.',{trust:5,stability:5,access:-4},{ai:-2},{innovation:-.08,autonomy:-.1})]},
{id:'E07',title:'새로운 노동의 의미',description:'생존을 위한 노동과 삶의 의미가 분리되기 시작합니다. 늘어난 생산 능력을 무엇에 쓸까요?',earliest:2038,requires:'E06',threshold:{automation:30,welfare:25},choices:[
c('노동 중심 경제 유지','일과 성취에 대한 경제적 보상을 유지합니다.','소득 밖의 삶과 휴식이 뒤로 밀릴 수 있습니다.',{productivity:5,employment:3,wellbeing:-3},{productivity:3},{workHours:.2}),
c('노동시간 단축','휴식과 관계를 위한 시간을 확보합니다.','임금과 생산의 조정이 필요합니다.',{wellbeing:5,productivity:-3},{employment:3,stability:3},{workHours:-.3,tax:.02}),
c('노동 외 활동 지원','돌봄·학습·창작의 가치를 넓힙니다.','재원과 사회적 합의를 유지해야 합니다.',{freedom:4,welfare:4},{wellbeing:5},{creative:.15,dividend:.1,tax:.04})]},
{id:'E08',title:'에너지와 기술',description:'AI와 자동화 설비의 전력 수요가 늘어납니다. 공급과 환경, 효율의 균형이 필요합니다.',earliest:2040,requires:'E07',threshold:{ai:48},choices:[
c('에너지 인프라 투자','산업과 생활의 전력 공급을 늘립니다.','건설 비용과 환경 부담이 발생합니다.',{productivity:6,environment:-6},{ai:4,stability:3},{innovation:.12,tax:.02}),
c('환경 규제 강화','장기 건강과 지속가능성을 지킵니다.','현재의 생활비와 생산 비용이 늘어납니다.',{environment:9,productivity:-3},{environment:4,wellbeing:3},{efficiency:.12,tax:.04}),
c('기술 효율화 우선','같은 자원으로 더 많은 일을 시도합니다.','연구 성과가 늦거나 기대에 미치지 못할 수 있습니다.',{ai:2,productivity:-2},{environment:6,productivity:5},{efficiency:.3,training:.05},36)]},
{id:'E09',title:'인간 능력의 확장',description:'지능형 도구가 인간의 기억과 판단, 협업을 보조합니다. 어떤 능력을 함께 키워야 할까요?',earliest:2043,requires:'E08',threshold:{ai:53,access:25},choices:[
c('인간과 AI 협업 확대','사람과 도구의 강점을 결합합니다.','도구 의존과 접근 격차가 커질 수 있습니다.',{ai:5,productivity:5,access:3,equality:-2},{productivity:4},{innovation:.12,training:.15}),
c('인간의 독립적 역량 유지','도구 없이 판단하고 배우는 능력을 지원합니다.','단기적 효율의 일부를 포기합니다.',{freedom:5,trust:4,productivity:-2},{employment:3},{training:.2,autonomy:.12}),
c('고도 기술의 신중한 도입','사회가 변화에 적응할 시간을 확보합니다.','일부 새로운 기회는 늦게 찾아옵니다.',{stability:6,ai:-2},{trust:4},{innovation:-.05,training:.08})]},
{id:'E10',title:'미래 사회의 방향',description:'누적된 결정이 도시와 사람들의 삶을 바꿨습니다. 마지막 몇 년 동안 무엇을 우선할까요?',earliest:2045,requires:'E09',threshold:{ai:45},choices:[
c('생산성 중심 사회','더 큰 생산과 경제적 가능성을 추구합니다.','격차와 소진을 함께 살펴야 합니다.',{productivity:8,automation:4,equality:-4},{productivity:4,environment:-2},{workHours:.15,innovation:.15}),
c('자유와 자아실현 중심 사회','자신의 삶을 선택할 여지를 넓힙니다.','일관된 사회적 조정이 어려워질 수 있습니다.',{freedom:9,wellbeing:4,stability:-3},{access:4},{autonomy:.2,creative:.15}),
c('안정과 공동체 중심 사회','서로를 돌보는 제도와 신뢰를 강화합니다.','혁신과 개인 선택의 폭이 줄 수 있습니다.',{stability:8,welfare:5,freedom:-3},{trust:4},{dividend:.12,tax:.04,innovation:-.06})]}
];
const p=(label:string,detail:string,effects:PersonalChoice['effects'],extra:Partial<PersonalChoice>={}):PersonalChoice=>({label,detail,effects,...extra});
export const PERSONAL_EVENTS:PersonalEvent[]=[
{id:'P01',title:'AI 도입으로 업무가 변경됨',description:'일하던 방식이 바뀌고 있습니다. 새 도구를 배우거나 익숙한 업무에 집중할 수 있습니다.',condition:(h,s)=>ageYears(h)>=20&&h.employed&&s.nation.metrics.automation>=23,choices:[p('새 도구를 배우기','수강 비용을 내고 AI 숙련을 높입니다.',{assets:-35,aiSkill:12,stress:5}),p('익숙한 업무에 집중','현재 부담을 낮추고 직무 경험을 쌓습니다.',{skill:5,stress:-5,achievement:3})]},
{id:'P02',title:'직업 상실 위기',description:'업무 수요와 고용 조건이 달라졌습니다. 전환의 비용이 내 삶에 도착했습니다.',condition:(h,s)=>ageYears(h)>=20&&!h.retired&&(!h.employed||h.jobSecurity<50)&&s.nation.metrics.automation>24,choices:[p('재교육으로 준비','시간과 비용을 들여 전환을 준비합니다.',{assets:-45,stress:6},{training:true}),p('새 일자리 탐색','당장 다른 직업의 기회를 시도합니다.',{stress:8,achievement:2},{job:'new'})]},
{id:'P03',title:'새로운 직업 제안',description:'현재 경험을 다른 일에서 활용할 기회가 생겼습니다. 조건과 적응의 부담을 비교합니다.',condition:(h)=>ageYears(h)>=20&&(!h.employed||h.recent.includes('search')&&h.skill>35),choices:[p('제안을 받아들이기','현재 사회의 고용 기회에 따라 새 일자리를 시도합니다.',{stress:6},{job:'new'}),p('지금의 방향 유지','전환 비용을 아끼고 현재 생활에 집중합니다.',{stress:-4,achievement:3})]},
{id:'P04',title:'재교육 기회',description:'다른 일을 배울 수 있는 과정이 열렸습니다. 교육의 효과는 수료 후에 나타납니다.',condition:(h,s)=>!h.trainingDue&&h.education<80&&(s.rules.training>.05||s.nation.metrics.access>42),choices:[p('교육에 참여','90일 뒤 숙련이 높아지고 전환 기회가 생깁니다.',{assets:-30,stress:4},{training:true}),p('현재 일과 생활에 집중','비용을 아끼지만 배움은 뒤로 미룹니다.',{stress:-3})]},
{id:'P05',title:'AI를 활용한 창작 기회',description:'새 도구가 표현의 문턱을 낮춥니다. 관심과 시장 성과는 같지 않을 수 있습니다.',condition:(h,s)=>s.nation.metrics.access>40&&(h.job==='art'||h.recent.includes('create')||h.traits.curiosity>65),choices:[p('작품을 만들어 공개','도구 비용을 쓰고 숙련과 성취를 얻습니다.',{assets:-20,achievement:14,aiSkill:5,happiness:4}),p('개인 작업으로 남기기','시장 진출 없이 표현과 휴식에 집중합니다.',{achievement:7,stress:-7})]},
{id:'P06',title:'생활비 증가',description:'이번 달 지출이 생활의 여유를 좁힙니다. 선택은 자산과 스트레스에 다른 흔적을 남깁니다.',condition:(h)=>h.assets<h.expenses*1.5,choices:[p('지출을 줄이고 버티기','작은 여유를 확보하지만 생활 만족이 줄어듭니다.',{assets:45,happiness:-5,stress:4}),p('지원과 새 기회 찾기','주변과 제도의 도움을 요청하며 일자리를 탐색합니다.',{relationships:5,stress:-4},{priority:'wealth'})]},
{id:'P07',title:'가족과의 갈등',description:'일과 학습에 쏟은 시간이 가까운 관계에 영향을 주었습니다.',condition:(h)=>h.relationships<48&&h.stress>45,choices:[p('함께 보내는 시간 늘리기','경제적 기회 일부를 양보하고 관계를 돌봅니다.',{assets:-15,relationships:16,stress:-8},{priority:'connection'}),p('현재 목표를 설명하기','목표를 유지하지만 관계의 거리는 남습니다.',{achievement:6,relationships:-4,stress:3})]},
{id:'P08',title:'공동체 지원',description:'어려움을 함께 나누려는 지역의 제안이 도착했습니다.',condition:(h,s)=>s.nation.metrics.welfare>52&&h.assets<h.expenses*4,choices:[p('지원을 받아 재정비','안전망으로 생활을 정리합니다.',{assets:65,stress:-10,relationships:4}),p('함께 돕는 역할 맡기','현금 대신 관계와 성취를 쌓습니다.',{relationships:14,achievement:10},{priority:'connection'})]},
{id:'P09',title:'새로운 인간관계',description:'함께 배우고 시간을 보낼 사람을 만났습니다. 새로운 관계에는 관심과 시간이 필요합니다.',condition:(h)=>h.traits.sociability>55||h.recent.includes('social'),choices:[p('관계를 이어가기','작은 지출과 시간을 관계에 투자합니다.',{assets:-10,relationships:14,happiness:5}),p('내 시간을 지키기','혼자 쉬며 현재의 부담을 줄입니다.',{stress:-7,achievement:3})]},
{id:'P10',title:'직업 전환 성공',description:'배움이 쌓여 새로운 역할에 도전할 준비가 됐습니다. 실제 채용은 사회의 기회와 내 역량에 달려 있습니다.',condition:(h)=>ageYears(h)>=20&&h.trained,choices:[p('새 역할에 지원하기','수료한 역량으로 채용을 시도합니다.',{skill:6,achievement:8},{job:'new'}),p('현재 분야에 배움을 적용','현재의 숙련과 생활 안정을 높입니다.',{skill:10,stress:-5})]},
{id:'P11',title:'건강과 스트레스 문제',description:'몸과 마음이 일상의 속도를 따라가지 못합니다. 회복에 시간을 쓸 필요가 있습니다.',condition:(h)=>h.stress>72||h.health<58,choices:[p('치료와 휴식 우선','진료비와 시간을 쓰고 회복합니다.',{assets:-40,health:15,stress:-25},{priority:'balance'}),p('부담을 줄이며 생활 유지','작은 회복과 현재 목표 사이에서 조정합니다.',{health:5,stress:-12,achievement:-3})]},
{id:'P12',title:'삶의 방향을 다시 선택할 기회',description:'사회의 변화 속에서 내가 원하는 생활을 돌아봅니다. 우선순위는 이후에도 언제든 바꿀 수 있습니다.',condition:(h,s)=>!!s.assignment&&s.day-s.assignment.day>600&&h.achievement>30,choices:[p('탐구와 표현에 무게 두기','학습과 창작을 중심으로 일상을 재편합니다.',{achievement:8,stress:3},{priority:'knowledge'}),p('관계와 안정을 돌보기','주변 사람과 회복에 시간을 나눕니다.',{relationships:8,stress:-8},{priority:'connection'})]}
];
