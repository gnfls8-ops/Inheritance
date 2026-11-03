import { useEffect, useRef, useState } from 'react';

import type { Playback, MapRenderer } from '../rendering/createRenderer';
import type { SimulationSnapshot } from '../simulation/model';
import type { Point } from '../simulation/map';
interface Props { playback:Playback; state:SimulationSnapshot; selected:string|null; onSelect:(id:string)=>void; onMove:(p:Point)=>void }
export function WorldMap(props:Props) {
  const host=useRef<HTMLDivElement>(null), renderer=useRef<MapRenderer|null>(null), latest=useRef(props);
  const [error,setError]=useState(''), [loading,setLoading]=useState(true);
  const [following,setFollowing]=useState(false);
  latest.current=props;
  useEffect(()=>{
    let disposed=false;
    import('../rendering/createRenderer').then(({createRenderer})=>createRenderer(host.current!,latest.current.state,id=>latest.current.onSelect(id),p=>latest.current.onMove(p))).then(value=>{
      if(disposed){value.destroy();return;}
      renderer.current=value;value.update(latest.current.state,latest.current.selected,latest.current.playback);setLoading(false);
    }).catch(()=>{if(!disposed){setError('지도를 초기화하지 못했습니다. WebGL을 지원하는 브라우저에서 하드웨어 가속을 확인하고 새로고침하세요.');setLoading(false);}});
    return ()=>{disposed=true;renderer.current?.destroy();renderer.current=null;};
  },[]);
  useEffect(()=>renderer.current?.update(props.state,props.selected,props.playback),[props.state,props.selected,props.playback.paused,props.playback.speed]);
  return <><div ref={host} className="map-host"/>{loading&&<p className="map-message" role="status">지역 지도를 불러오는 중…</p>}{error&&<p className="map-message" role="alert">{error}</p>}<div className="map-tools"><button onClick={()=>renderer.current?.center()}>선택 인물 / 중앙으로</button><button aria-pressed={following} onClick={()=>{const next=!following;setFollowing(next);renderer.current?.follow(next);if(next)renderer.current?.center();}}>인물 추적 {following ? '켜짐' : '꺼짐'}</button><span>드래그 · 휠 / 핀치 확대</span></div></>;
}
