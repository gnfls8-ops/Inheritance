import { TECHNOLOGIES, canExperiment } from '../simulation/technology';
import type { TechOrder } from '../simulation/technology';
import { useEffect, useRef, useState } from 'react';
import { Simulation } from '../simulation/Simulation';
import { GameClock } from '../simulation/clock';
import { WorldMap } from './WorldMap';
import type { Point } from '../simulation/map';
import { ACTION_LABELS } from '../simulation/human';
import type { Activity, Speed } from '../simulation/model';

export function App() {
  const [initialSimulation] = useState(() => new Simulation());
  const simulation = useRef(initialSimulation);
  const clock = useRef(new GameClock());
  const [world, setWorld] = useState(() => simulation.current.snapshot());
  const [paused, setPaused] = useState(true);
  const [speed, setSpeed] = useState<Speed>(1);
  const [seed, setSeed] = useState('2026');
  const [error, setError] = useState('');
  const [help, setHelp] = useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [message,setMessage]=useState('인물을 선택한 뒤 땅을 누르면 이동을 예약합니다.');
  const human=world.world.humans.find(h=>h.id===selected);
  function move(target:Point) {
    if(!selected){setMessage('먼저 지도 또는 목록에서 인물을 선택하세요.');return;}
    const ok=simulation.current.move(selected,target);
    setMessage(ok ? `(${target.x}, ${target.y}) 이동 예약 · 재생하면 하루에 한 칸 이동합니다.` : '이동할 수 없는 지형이거나 경로가 없습니다.');
    if(ok)setWorld(simulation.current.snapshot());
  }
  function act(action:Activity) {
    if(!selected)return;
    const ok=simulation.current.act(selected,action);
    setMessage(ok ? `${ACTION_LABELS[action]} 지시 예약 · 완료 후 자율 행동으로 복귀합니다.` : '주변에 도달 가능한 자원 또는 교류 상대가 없습니다.');
    if(ok)setWorld(simulation.current.snapshot());
  }
  function technology(order:TechOrder){if(!selected)return;const ok=simulation.current.technology(selected,order);setMessage(ok?'지시가 예약됐습니다. 시간을 재생하세요.':'기술 조건을 확인하세요.');if(ok)setWorld(simulation.current.snapshot());}
  function cancel() {
    if(selected&&simulation.current.resumeAuto(selected)){setWorld(simulation.current.snapshot());setMessage('지시를 취소하고 자율 행동으로 복귀했습니다.');}
  }
  function pause(value: boolean) { clock.current.setPaused(value); setPaused(value); }
  useEffect(() => {
    let previous = performance.now();
    let frame = 0;
    const update = (now: number) => {
      // A queued RAF timestamp can predate effect/visibility initialization.
      const ticks = clock.current.advance(Math.max(0, now - previous), () => simulation.current.step());
      previous = now;
      if (ticks) setWorld(simulation.current.snapshot());
      frame = requestAnimationFrame(update);
    };
    const onVisibility = () => { previous = performance.now(); if (document.hidden) pause(true); };
    document.addEventListener('visibilitychange', onVisibility);
    frame = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  function restart() {
    if (!/^\d+$/.test(seed) || Number(seed) > 0xffffffff) { setError('0~4294967295의 정수 시드를 입력하세요.'); return; }
    simulation.current = new Simulation(Number(seed));
    setSelected(null); setMessage('새로운 세계를 시작했습니다. 인물을 선택하세요.');
    pause(true); setWorld(simulation.current.snapshot()); setError('');
  }
  return <div className="app">
    <header><a className="brand" href="#">INHERITANCE<span>인간이 남긴 것들</span></a><div className="chapter">CHAPTER 01 <span>역사가 시작되기 전</span></div><button className="help" onClick={() => setHelp(!help)} aria-expanded={help}>안내 {help ? '−' : '+'}</button></header>
    {help && <div className="notice">STEP 4 개발 빌드입니다. 1틱은 1일이며, 1배속에서 1초마다 하루가 흐릅니다. 같은 시드로 다시 시작하면 같은 초기 상태를 재현합니다. 인물을 선택하고 땅을 누르면 경로를 예약합니다. 강·암석은 통과할 수 없습니다. 모든 인물은 욕구와 기질에 따라 자율 행동합니다. 행동 지시는 한 번 수행 후 자율 행동으로 돌아갑니다.</div>}
    <div className="timebar"><div><span className="status-dot"/> 선사시대 <span className="divider">/</span> <strong>제 {world.world.day + 1}일</strong></div><div className="controls"><span className="clock-label" aria-live="polite">{paused ? '일시정지' : '시간이 흐르는 중'}</span><button aria-label={paused ? '시간 재생' : '시간 일시정지'} onClick={() => pause(!paused)}>{paused ? '▶' : 'Ⅱ'}</button>{([1,2,4] as Speed[]).map(value => <button key={value} aria-pressed={speed === value} onClick={() => {clock.current.setSpeed(value); setSpeed(value);}}>{value}×</button>)}</div></div>
    <main><section className="world"><div className="world-label">THE FIRST CHAPTER <span>01 — 기원</span></div><WorldMap state={world} selected={selected} onSelect={setSelected} onMove={move}/><div className="world-bottom"><span>이름 없는 골짜기</span><span>48 × 48 · 아이소메트릭</span></div></section>
    <aside><p className="eyebrow">YOUR WORLD</p><h2>세계의 시작</h2><p className="muted">아직 아무도 이름 붙이지 않은 땅.<br/>이곳에서 새로운 이야기가 시작됩니다.</p><div className="stats"><div><span>시대</span><strong>선사시대</strong></div><div><span>경과 시간</span><strong>{world.world.day} <small>일</small></strong></div><div><span>시뮬레이션 틱</span><strong>{world.world.day.toLocaleString()}</strong></div></div><div className="person"><h3>{human ? human.name : '인물을 선택하세요'}</h3>{human && <p>위치 ({human.position.x}, {human.position.y}) · {human.path.length ? `${human.path.length}칸 이동 예정` : ACTION_LABELS[human.action]}</p>}<label className="human-select">관찰할 인간<select aria-label="관찰할 인간" value={selected??''} onChange={e=>setSelected(e.target.value||null)}><option value="">선택하세요</option>{world.world.humans.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label>{human && <div className="human-details"><p className="control-state">{human.control==='player'?'플레이어 지시 중':'자율 행동 중'} · {ACTION_LABELS[human.action]}</p><p>{human.reason}</p><dl className="vitals">{([['건강',human.health],['허기',human.hunger],['피로',human.fatigue],['외로움',human.loneliness]] as const).map(([label,value])=><div key={label}><dt>{label}</dt><dd><meter min="0" max="100" value={value} aria-label={label}/><span>{value}</span></dd></div>)}</dl><p>소지 식량 {human.food}개 · 탐험한 땅 {human.visited.length}칸<br/>현재 타일 먹을거리 {world.world.resources[human.position.y*world.world.map.width+human.position.x]}개</p><div className="traits">{([['호기심',human.traits.curiosity],['안정 추구',human.traits.stability],['사회성',human.traits.sociability],['위험 감수',human.traits.riskTaking]] as const).map(([name,value])=><span key={name}>{name} <strong>{value}</strong></span>)}</div><div className="action-buttons" aria-label="행동 지시">{(['gather','explore','rest','socialize'] as Activity[]).map(action=><button key={action} onClick={()=>act(action)}>{ACTION_LABELS[action]}</button>)}<button className="auto-button" onClick={cancel}>지시 취소 · 자율 복귀</button></div><details className="tech-panel" open><summary>기술 · 실험과 전승</summary>{TECHNOLOGIES.map(t=><div className="tech-card" key={t.id}><strong>{t.name} · {human.knowledge.includes(t.id)?'알고 있음':'미발견'}</strong><p>{t.condition} · 식량 {t.cost}개 · 피로 ≤85<br/>{t.effect}</p><p>보유 {world.world.technologies[t.id].holders}/12명 · {world.world.technologies[t.id].adopted?'공동체 정착':'개인 지식 단계'}</p><button disabled={!canExperiment(world.world,human,t.id)} onClick={()=>technology({kind:'experiment',id:t.id})}>실험: {t.name}</button><button disabled={!human.knowledge.includes(t.id)} onClick={()=>technology({kind:'teach',id:t.id})}>전파: {t.name}</button></div>)}<p>전파는 3칸 이내의 미보유자에게 시도합니다. 신뢰와 기질에 따라 거부할 수 있습니다.</p>{human.techOrder&&<p role="status">예약: {human.techOrder.kind==='experiment'?'실험':'전파'} · {TECHNOLOGIES.find(t=>t.id===human.techOrder?.id)?.name}</p>}</details><details><summary>관계 ({Object.keys(human.relationships).length}명)</summary>{Object.entries(human.relationships).map(([id,rel])=><p key={id}>{world.world.humans.find(h=>h.id===id)?.name} · 친밀 {rel.familiarity} / 신뢰 {rel.trust}</p>)}{!Object.keys(human.relationships).length&&<p>교류를 통해 관계를 형성합니다.</p>}</details></div>}<p role="status">{message}</p></div><div className="seed"><label htmlFor="seed">세계 시드 <span>결정론적 시뮬레이션</span></label><div><input id="seed" inputMode="numeric" value={seed} onChange={e => setSeed(e.target.value)} aria-describedby={error ? 'seed-error' : undefined}/><button onClick={restart}>다시 시작</button></div>{error && <p id="seed-error" role="alert">{error}</p>}<p>적용된 시드 {world.seed} · 같은 시작, 같은 시간의 흐름</p></div></aside></main>
    <footer><div><span className="eyebrow">CHRONICLE</span><h2>골짜기의 하루</h2></div><div className="technology-log"><h3>기술의 발자취</h3>{world.world.technologyLog.slice(-8).reverse().map((e,i)=><p key={i}>제 {e.day}일 · {e.text}</p>)}{!world.world.technologyLog.length&&<p>인물을 선택해 식량 저장부터 실험해 보세요.</p>}</div><div className="daily-log" aria-label="최근 행동 기록">{world.world.activityLog.length ? world.world.activityLog.slice(-6).reverse().map((entry,i)=><p key={`${entry.day}-${entry.humanId}-${i}`}><span>제 {entry.day}일</span> {world.world.humans.find(h=>h.id===entry.humanId)?.name} · {entry.text}</p>) : <p>재생하면 인간들이 스스로 하루를 살아갑니다.</p>}</div><span className="build">PROTOTYPE / STEP 04</span></footer>
  </div>;
}
