'use client';
import { useEffect, useRef, useState } from 'react';
import type { Player, RowResult, Selection, TableRow } from '@/lib/types';
import { defaultSelections, seasonLabel, selectionKey, selectionLabel } from '@/lib/seasons';
import { headers, statCells, minuteConversion, conversionLabel, comparisonSelections } from '@/lib/format';

type SearchState = { query: string; players: Player[]; error?: string; resolvedQuery?: string };
async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : '请求失败，请稍后重试。';
    throw new Error(message);
  }
  return body as T;
}
function useResults(playerId: string | undefined, selections: Selection[]) {
  const [state,setState]=useState<{identity:string;items:Record<string,RowResult>}>({identity:'',items:{}});
  const identity=playerId??'';
  const signature=selections.map(selectionKey).join(',');
  useEffect(()=>{
    if (!playerId || !signature) return;
    const controller=new AbortController();
    const requested=signature.split(',').map(key=>{const [year,type]=key.split('-');return {year:Number(year),type:type as Selection['type']};});
    for (const s of requested) {
      const params=new URLSearchParams({player:playerId,year:String(s.year),type:s.type});
      fetch(`/api/stats?${params}`,{signal:controller.signal}).then(readJson<RowResult>).then((body)=>{
        if(!controller.signal.aborted)setState(prev=>({identity,items:{...(prev.identity===identity?prev.items:{}),[selectionKey(s)]:body}}));
      }).catch(error=>{
        if(!controller.signal.aborted)setState(prev=>({identity,items:{...(prev.identity===identity?prev.items:{}),[selectionKey(s)]:{error:error instanceof Error?error.message:'请求失败'}}}));
      });
    }
    return ()=>controller.abort();
  },[playerId,identity,signature]);
  return state.identity===identity ? state.items : {};
}
export default function ResearchTool({today}:{today:string}) {
  const [query,setQuery]=useState('');
  const [search,setSearch]=useState<SearchState>({query:'',players:[]});
  const [player,setPlayer]=useState<Player>();
  const selections=defaultSelections(new Date(today));
  const [searchRevision,setSearchRevision]=useState(0);
  const [conversionYear,setConversionYear]=useState('original');
  const searchSeq=useRef(0);
  const q=query.trim();
  useEffect(()=>{
    const seq=++searchSeq.current;
    if(q.length<2)return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      fetch(`/api/players?q=${encodeURIComponent(q)}`,{signal:controller.signal}).then(readJson<{players:Player[];resolvedQuery:string}>).then(body=>{
        if(seq===searchSeq.current&&!controller.signal.aborted)setSearch({query:q,players:body.players,resolvedQuery:body.resolvedQuery});
      }).catch(error=>{
        if(seq===searchSeq.current&&!controller.signal.aborted)setSearch({query:q,players:[],error:error instanceof Error?error.message:'搜索失败'});
      });
    },300);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[q,searchRevision]);
  const history=selections.slice(0,2);
  const currentPreseason=selections.find(s=>s.type==='preseason')!;
  const results=useResults(player?.id,selections);
  const preseason=results[selectionKey(currentPreseason)]?.row;
  const conversionOptions=history.map(s=>({year:s.year,value:minuteConversion(preseason,results[selectionKey(s)]?.row)}));
  const conversion=conversionOptions.find(o=>String(o.year)===conversionYear)?.value;
  const displaySelections=comparisonSelections(selections,history,conversion?currentPreseason:undefined);
  const searching=q.length>=2&&search.query!==q;
  const shownPlayers=search.query===q?search.players:[];
  const name=player ? `${player.chineseName?player.chineseName+' ':''}${player.name}` : '';
  return <main>
    <header className="site-header"><h1>Fantasy Timeline</h1><span className="header-note">球员对比 · 11 CAT</span></header>
    <section className="search-section" aria-label="查找球员"><label className="sr-only" htmlFor="player-search">搜索球员</label>
      <div className="search-field"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input id="player-search" autoComplete="off" placeholder="输入中文或英文姓名，如 里萨谢 / Risacher" value={query} maxLength={80} onChange={e=>setQuery(e.target.value)}/>{q&&<button className="clear-search" onClick={()=>setQuery('')} aria-label="清空搜索">×</button>}</div>
      <div aria-live="polite" className="search-feedback">
        {q.length===1&&<p className="muted">再输入一个字符即可搜索。</p>}
        {searching&&<p className="muted">正在查找球员…</p>}
        {q.length>=2&&search.query===q&&search.error&&<p role="alert" className="error">{search.error} <button className="text-button" onClick={()=>{setSearch({query:'',players:[]});setSearchRevision(v=>v+1);}}>重试搜索</button></p>}
        {q.length>=2&&!searching&&!search.error&&shownPlayers.length===0&&<p className="muted">未找到球员，请尝试英文全名或其他译名。</p>}
      </div>
      {q.length>=2&&shownPlayers.length>0&&<div className="candidate-panel"><p className="candidate-label">选择球员 <span>{shownPlayers.length} 位候选{search.resolvedQuery!==q?` · 搜索 ${search.resolvedQuery}`:''}</span></p><ul aria-label="球员候选">{shownPlayers.map(p=><li key={p.id}><button onClick={()=>{setPlayer(p);setQuery('');setConversionYear('original');}}><span className="player-initial">{p.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span><strong>{p.chineseName??p.name}</strong><small>{p.chineseName?`${p.name} · `:''}{p.team}</small></span><span className="candidate-id">#{p.id}<span> →</span></span></button></li>)}</ul></div>}
    </section>
    <section className="workspace" aria-label="球员数据">{player&&<div className="workspace-heading"><h2>{name}</h2></div>}
      {selections.some(s=>selectionKey(s)===selectionKey(currentPreseason))&&<div className="minute-controls"><label htmlFor="minute-conversion">季前赛分钟</label><select id="minute-conversion" value={conversion?conversionYear:'original'} onChange={e=>setConversionYear(e.target.value)}><option value="original">原始</option>{conversionOptions.map(o=><option key={o.year} value={o.year} disabled={!o.value}>按{seasonLabel(o.year)}场均分钟</option>)}</select><span>仅等比例换算计数，GP、DD 与比率不变；非预测。</span></div>}
      <div className="table-scroll" tabIndex={0} role="region" aria-label="球员数据表，可横向滚动"><table><caption className="sr-only">{player?name:'未选择球员'} · Yahoo Fantasy 11 CAT 赛季数据对比</caption><thead><tr>{headers.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{displaySelections.map((s,index)=>{
        const result=player?results[selectionKey(s)]:undefined;
        const source=result?.row;
        const row:TableRow|undefined=source?{...source,mode:s.mode,conversion:s.converted?conversion:undefined}:undefined;
        const className=s.mode==='total'?`total-row${displaySelections[index-1]?.mode!=='total'?' total-start':''}`:s.type==='preseason'?'preseason-row':'';
        return <tr key={`${selectionKey(s)}:${s.mode}:${s.converted?'converted':'observed'}`} className={className}><th scope="row">{selectionLabel(s)}{s.mode==='total'?' · 总计':''}{row?.conversion&&<small>{conversionLabel(row)}</small>}{row?.status==='unavailable'&&<small>暂无出场记录</small>}{row?.minutePrecision==='rounded-game-minutes'&&row.totals&&<small>MIN 为近似值</small>}</th>{!player?<td colSpan={15} className="empty-cell">—</td>:!result?<td colSpan={15} className="state-cell"><span className="loading-dot"/> 正在读取 ESPN 数据…</td>:result.error?<td colSpan={15} className="error state-cell" role="alert">读取失败：{result.error}</td>:statCells(row?.totals??null,row).map((cell,i)=><td key={i} title={i===1&&row?.minutePrecision==='rounded-game-minutes'?'基于逐场整数分钟，近似值':undefined}>{cell}{i===1&&row?.minutePrecision==='rounded-game-minutes'&&row.totals?<sup> ≈</sup>:null}</td>)}</tr>;
      })}</tbody></table></div>
      <div className="table-footnotes">GP 为出场数；DD = 两双次数（DD/GP 占比）。总计行含总分钟，其余行计数为场均；— 为缺失或分母为 0；MIN ≈ 为近似值。</div>

    </section>

  </main>;
}
