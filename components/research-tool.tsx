'use client';
import { useEffect, useRef, useState } from 'react';
import type { Player, RowResult, SeasonRow, Selection, TableRow } from '@/lib/types';
import { currentEndYear, defaultSelections, seasonLabel, selectionKey, selectionLabel } from '@/lib/seasons';
import { headers, statCells, minuteConversion, conversionLabel, comparisonSelections } from '@/lib/format';
import { exportCsv, exportPng } from '@/lib/export';

type SearchState = { query: string; players: Player[]; error?: string; resolvedQuery?: string };
const timeLabel = (s:string) => new Date(s).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : '请求失败，请稍后重试。';
    throw new Error(message);
  }
  return body as T;
}
function useResults(playerId: string | undefined, selections: Selection[], revision:number) {
  const [state,setState]=useState<{identity:string;items:Record<string,RowResult>}>({identity:'',items:{}});
  const identity=`${playerId}:${revision}`;
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
  const [selections,setSelections]=useState(()=>defaultSelections(new Date(today)));
  const [showSeasons,setShowSeasons]=useState(false);
  const [revision,setRevision]=useState(0);
  const [exporting,setExporting]=useState(false);
  const [exportError,setExportError]=useState('');
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
  },[q,revision]);
  const defaults=defaultSelections(new Date(today));
  const history=defaults.slice(0,2);
  const currentPreseason=defaults.find(s=>s.type==='preseason')!;
  const requests=[...new Map([...selections,...history].map(s=>[selectionKey(s),s])).values()];
  const results=useResults(player?.id,requests,revision);
  const loading=!!player&&requests.some(s=>!results[selectionKey(s)]);
  const ready=!!player&&requests.every(s=>results[selectionKey(s)]?.row);
  const sourceRows=requests.map(s=>results[selectionKey(s)]?.row).filter((r):r is SeasonRow=>!!r);
  const preseason=results[selectionKey(currentPreseason)]?.row;
  const conversionOptions=history.map(s=>({year:s.year,value:minuteConversion(preseason,results[selectionKey(s)]?.row)}));
  const conversion=conversionOptions.find(o=>String(o.year)===conversionYear)?.value;
  const displaySelections=comparisonSelections(selections,history,conversion?currentPreseason:undefined);
  const rows:TableRow[]=displaySelections.flatMap(s=>{
    const row=results[selectionKey(s)]?.row;
    return row ? [{...row,mode:s.mode,conversion:s.converted?conversion:undefined}] : [];
  });
  const through=sourceRows.map(r=>r.fetchedAt).sort()[0];
  const searching=q.length>=2&&search.query!==q;
  const shownPlayers=search.query===q?search.players:[];
  const endYear=currentEndYear(new Date(today));
  const seasonYears=Array.from({length:endYear-2000},(_,i)=>endYear-i);
  const name=player ? `${player.chineseName?player.chineseName+' · ':''}${player.name}` : '';
  function toggle(s:Selection) {
    setConversionYear('original');
    setSelections(prev=>prev.some(p=>selectionKey(p)===selectionKey(s))?prev.filter(p=>selectionKey(p)!==selectionKey(s)):prev.length>=8?prev:[...prev,s].sort((a,b)=>a.year-b.year||a.type.localeCompare(b.type)));
  }
  async function downloadImage() {
    setExportError('');setExporting(true);
    try{await exportPng(name,rows);}catch(e){setExportError(e instanceof Error?e.message:'导出失败');}finally{setExporting(false);}
  }
  return <main>
    <header className="site-header"><h1>Simple Fantasy</h1><span className="header-note">球员对比 · 11 CAT</span></header>
    <section className="search-section" aria-label="查找球员"><label className="field-label" htmlFor="player-search">搜索球员</label>
      <div className="search-field"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input id="player-search" autoComplete="off" placeholder="输入中文或英文姓名，如 里萨谢 / Risacher" value={query} maxLength={80} onChange={e=>setQuery(e.target.value)}/>{q&&<button className="clear-search" onClick={()=>setQuery('')} aria-label="清空搜索">×</button>}</div>
      <div aria-live="polite" className="search-feedback">
        {q.length===1&&<p className="muted">再输入一个字符即可搜索。</p>}
        {searching&&<p className="muted">正在查找球员…</p>}
        {q.length>=2&&search.query===q&&search.error&&<p role="alert" className="error">{search.error} <button className="text-button" onClick={()=>{setSearch({query:'',players:[]});setRevision(v=>v+1);}}>重试搜索</button></p>}
        {q.length>=2&&!searching&&!search.error&&shownPlayers.length===0&&<p className="muted">未找到球员，请尝试英文全名或其他译名。</p>}
      </div>
      {q.length>=2&&shownPlayers.length>0&&<div className="candidate-panel"><p className="candidate-label">选择球员 <span>{shownPlayers.length} 位候选{search.resolvedQuery!==q?` · 搜索 ${search.resolvedQuery}`:''}</span></p><ul aria-label="球员候选">{shownPlayers.map(p=><li key={p.id}><button onClick={()=>{setPlayer(p);setQuery('');setConversionYear('original');}}><span className="player-initial">{p.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span><strong>{p.chineseName??p.name}</strong><small>{p.chineseName?`${p.name} · `:''}{p.team}</small></span><span className="candidate-id">#{p.id}<span> →</span></span></button></li>)}</ul></div>}
    </section>
    <section className="workspace" aria-label="赛季数据对比"><div className="workspace-heading"><div><h2>{player?`${player.chineseName??player.name} · 赛季数据对比`:'赛季对比'}</h2>{player&&<p className="muted">{player.name}</p>}</div><div className="export-actions"><button disabled={!ready} onClick={()=>exportCsv(name,rows)} title="导出含来源与读取时间的 CSV">↓ CSV</button><button disabled={!ready||exporting} onClick={downloadImage}>{exporting?'生成中…':'↓ 图片'}</button></div></div>
      <div className="table-toolbar"><div className="season-tags">{selections.map(s=><span key={selectionKey(s)} className={s.type==='preseason'?'season-tag preseason':'season-tag'}>{selectionLabel(s)}</span>)}{!selections.length&&<span className="muted">尚未选择赛季</span>}</div><div className="toolbar-actions"><button className="text-button" aria-expanded={showSeasons} onClick={()=>setShowSeasons(v=>!v)}>选择赛季 {showSeasons?'−':'＋'}</button>{player&&<button className="text-button" disabled={loading} onClick={()=>setRevision(v=>v+1)} title="重新读取，服务器在缓存期内复用已验证数据">{loading?'读取中…':'↻ 重新读取'}</button>}</div></div>
      {showSeasons&&<div className="season-picker"><div className="picker-heading"><p>赛季 <span className="muted small">最多 8 行</span></p><button className="text-button" onClick={()=>{setSelections(defaultSelections(new Date(today)));setConversionYear('original');}}>恢复默认</button></div><div className="season-options">{seasonYears.map(year=><fieldset key={year}><legend>{seasonLabel(year)}</legend>{(['regular','preseason'] as const).map(type=>{const s={year,type};return <label key={type}><input type="checkbox" checked={selections.some(p=>selectionKey(p)===selectionKey(s))} onChange={()=>toggle(s)} disabled={selections.length>=8&&!selections.some(p=>selectionKey(p)===selectionKey(s))}/>{type==='regular'?'常规赛':'季前赛'}</label>;})}</fieldset>)}</div></div>}
      {selections.some(s=>selectionKey(s)===selectionKey(currentPreseason))&&<div className="minute-controls"><label htmlFor="minute-conversion">季前赛分钟</label><select id="minute-conversion" value={conversion?conversionYear:'original'} onChange={e=>setConversionYear(e.target.value)}><option value="original">原始</option>{conversionOptions.map(o=><option key={o.year} value={o.year} disabled={!o.value}>按{seasonLabel(o.year)}场均分钟</option>)}</select><span>仅等比例换算计数，GP、DD 与比率不变；非预测。</span></div>}
      {exportError&&<p className="error" role="alert">{exportError}</p>}
      <div className="table-scroll" tabIndex={0} role="region" aria-label="球员数据表，可横向滚动"><table><caption className="sr-only">{player?name:'未选择球员'} · Yahoo Fantasy 11 CAT 赛季数据对比</caption><thead><tr>{headers.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{displaySelections.map((s,index)=>{
        const result=player?results[selectionKey(s)]:undefined;
        const source=result?.row;
        const row:TableRow|undefined=source?{...source,mode:s.mode,conversion:s.converted?conversion:undefined}:undefined;
        const className=s.mode==='total'?`total-row${displaySelections[index-1]?.mode!=='total'?' total-start':''}`:s.type==='preseason'?'preseason-row':'';
        return <tr key={`${selectionKey(s)}:${s.mode}:${s.converted?'converted':'observed'}`} className={className}><th scope="row">{selectionLabel(s)}{s.mode==='total'?' · 总计':''}{row?.conversion&&<small>{conversionLabel(row)}</small>}{row?.status==='unavailable'&&<small>暂无出场记录</small>}{row?.minutePrecision==='rounded-game-minutes'&&row.totals&&<small>MIN 为近似值</small>}</th>{!player?<td colSpan={15} className="empty-cell">—</td>:!result?<td colSpan={15} className="state-cell"><span className="loading-dot"/> 正在读取 ESPN 数据…</td>:result.error?<td colSpan={15} className="error state-cell" role="alert">读取失败：{result.error}</td>:statCells(row?.totals??null,row).map((cell,i)=><td key={i} title={i===1&&row?.minutePrecision==='rounded-game-minutes'?'基于逐场整数分钟，近似值':undefined}>{cell}{i===1&&row?.minutePrecision==='rounded-game-minutes'&&row.totals?<sup> ≈</sup>:null}</td>)}</tr>;
      })}</tbody></table></div>
      <div className="table-footnotes">GP 为出场数；DD = 两双次数（DD/GP 占比）。总计行含总分钟，其余行计数为场均；— 为缺失或分母为 0；MIN ≈ 为近似值。</div>
      {!!player&&<div className="source-section"><div className="source-heading"><span><span className="dot"/> 数据来源 · ESPN</span><span>{through?`本表最早读取：${timeLabel(through)}（北京时间）`:'正在连接数据源'}</span></div>{requests.map(s=>{const row=results[selectionKey(s)]?.row;return row&&<details key={selectionKey(s)}><summary>{selectionLabel(s)} · 来源与统计说明</summary><div className="source-detail"><p>读取：{timeLabel(row.fetchedAt)}（北京时间）{row.dataThrough?` · 已收录比赛截至 ${timeLabel(row.dataThrough)}`:' · 源未提供赛季总数最后更新时间'}</p>{row.notes.map(n=><p key={n}>{n}</p>)}<p>{row.sources.map(source=><a href={source.url} key={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</p></div></details>;})}</div>}
    </section>

  </main>;
}
