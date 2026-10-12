'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Player, RowResult, SeasonRow, Selection } from '@/lib/types';
import { currentEndYear, defaultSelections, seasonLabel, selectionKey, selectionLabel } from '@/lib/seasons';
import { headers, statCells } from '@/lib/format';
import { aliasCount } from '@/lib/aliases';
import { exportCsv, exportPng } from '@/lib/export';

type SearchState = { query: string; players: Player[]; error?: string; resolvedQuery?: string };
const timeLabel = (s:string) => new Date(s).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
async function readJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? '请求失败，请稍后重试。');
  return body;
}
function useResults(playerId: string | undefined, selections: Selection[], revision:number) {
  const [state,setState]=useState<{identity:string;items:Record<string,RowResult>}>({identity:'',items:{}});
  const identity=`${playerId}:${revision}`;
  const signature=selections.map(selectionKey).join(',');
  useEffect(()=>{
    if (!playerId) return;
    const controller=new AbortController();
    const requested=signature.split(',').map(key=>{const [year,type]=key.split('-');return {year:Number(year),type:type as Selection['type']};});
    for (const s of requested) {
      const params=new URLSearchParams({player:playerId,year:String(s.year),type:s.type});
      fetch(`/api/stats?${params}`,{signal:controller.signal}).then(readJson).then((body:RowResult)=>{
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
  const searchSeq=useRef(0);
  const q=query.trim();
  useEffect(()=>{
    const seq=++searchSeq.current;
    if(q.length<2)return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      fetch(`/api/players?q=${encodeURIComponent(q)}`,{signal:controller.signal}).then(readJson).then(body=>{
        if(seq===searchSeq.current&&!controller.signal.aborted)setSearch({query:q,players:body.players,resolvedQuery:body.resolvedQuery});
      }).catch(error=>{
        if(seq===searchSeq.current&&!controller.signal.aborted)setSearch({query:q,players:[],error:error instanceof Error?error.message:'搜索失败'});
      });
    },300);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[q,revision]);
  const results=useResults(player?.id,selections,revision);
  const loading=!!player&&selections.some(s=>!results[selectionKey(s)]);
  const ready=!!player&&selections.length>0&&selections.every(s=>results[selectionKey(s)]?.row);
  const rows=selections.map(s=>results[selectionKey(s)]?.row).filter((r):r is SeasonRow=>!!r);
  const through=rows.map(r=>r.fetchedAt).sort()[0];
  const searching=q.length>=2&&search.query!==q;
  const shownPlayers=search.query===q?search.players:[];
  const endYear=currentEndYear(new Date(today));
  const seasonYears=Array.from({length:endYear-2000},(_,i)=>endYear-i);
  const name=player ? `${player.chineseName?player.chineseName+' · ':''}${player.name}` : '';
  function toggle(s:Selection) {
    setSelections(prev=>prev.some(p=>selectionKey(p)===selectionKey(s))?prev.filter(p=>selectionKey(p)!==selectionKey(s)):prev.length>=8?prev:[...prev,s].sort((a,b)=>a.year-b.year||a.type.localeCompare(b.type)));
  }
  async function downloadImage() {
    setExportError('');setExporting(true);
    try{await exportPng(name,rows);}catch(e){setExportError(e instanceof Error?e.message:'导出失败');}finally{setExporting(false);}
  }
  return <main>
    <header className="site-header"><Link className="brand" href="/" aria-label="Simple Fantasy 首页"><span className="brand-mark">sf<span>↗</span></span><span>SIMPLE <strong>FANTASY</strong></span></Link><span className="header-note">球员研究室 <span className="dot"/> 11 CAT</span></header>
    <section className="intro"><p className="eyebrow">A CLEARER VIEW OF YOUR NEXT PICK</p><h1>研究球员，<br className="mobile-break"/>从数据开始。</h1><p className="intro-copy">过去两季的积累，本季季前赛的变化。<br className="mobile-break"/>同一张表，看清每一项贡献。</p></section>
    <section className="search-section" aria-label="查找球员"><label className="field-label" htmlFor="player-search">你想研究谁？</label>
      <div className="search-field"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input id="player-search" autoComplete="off" placeholder="输入中文或英文姓名，如 里萨谢 / Risacher" value={query} maxLength={80} onChange={e=>setQuery(e.target.value)} aria-describedby="search-help"/>{q&&<button className="clear-search" onClick={()=>setQuery('')} aria-label="清空搜索">×</button>}</div>
      <p id="search-help" className="muted small">支持常用中文译名、英文姓氏与全名。请从候选列表确认球员。</p>
      {!q&&<div className="suggestions"><span>试试看</span>{['里萨谢','约基奇','库里','詹姆斯'].map(n=><button key={n} onClick={()=>setQuery(n)}>{n}<span>↗</span></button>)}</div>}
      <div aria-live="polite" className="search-feedback">
        {q.length===1&&<p className="muted">再输入一个字符即可搜索。</p>}
        {searching&&<p className="muted">正在查找球员…</p>}
        {q.length>=2&&search.query===q&&search.error&&<p role="alert" className="error">{search.error} <button className="text-button" onClick={()=>{setSearch({query:'',players:[]});setRevision(v=>v+1);}}>重试搜索</button></p>}
        {q.length>=2&&!searching&&!search.error&&shownPlayers.length===0&&<p className="muted">没有找到匹配球员。试试英文全名或另一种译名。中文别名目前覆盖 {aliasCount} 组常用姓名，未收录的译名请用英文搜索。</p>}
      </div>
      {q.length>=2&&shownPlayers.length>0&&<div className="candidate-panel"><p className="candidate-label">选择球员 <span>{shownPlayers.length} 位候选{search.resolvedQuery!==q?` · 搜索 ${search.resolvedQuery}`:''}</span></p><ul aria-label="球员候选">{shownPlayers.map(p=><li key={p.id}><button onClick={()=>{setPlayer(p);setQuery('');}}><span className="player-initial">{p.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span><strong>{p.chineseName??p.name}</strong><small>{p.chineseName?`${p.name} · `:''}{p.team}</small></span><span className="candidate-id">#{p.id}<span> →</span></span></button></li>)}</ul><p className="small muted">球队为 ESPN 当前搜索资料；历史赛季会合并转队前后的数据。最多显示 50 个候选，可用全名缩小范围。</p></div>}
    </section>
    <section className="workspace" aria-label="赛季数据对比"><div className="workspace-heading"><div><p className="eyebrow">SEASON COMPARISON</p><h2>{player?`${player.chineseName??player.name} · 场均数据对比`:'你的下一份球员研究'}</h2><p className="muted">{player?`${player.name} · ESPN #${player.id} · Yahoo Fantasy 11 CAT`:'选择一位球员，生成常规赛与季前赛对比表。'}</p></div><div className="export-actions"><button disabled={!ready} onClick={()=>exportCsv(name,rows)} title="导出含来源与读取时间的 CSV">↓ CSV</button><button disabled={!ready||exporting} onClick={downloadImage}>{exporting?'生成中…':'↓ 图片'}</button></div></div>
      <div className="table-toolbar"><div className="season-tags">{selections.map(s=><span key={selectionKey(s)} className={s.type==='preseason'?'season-tag preseason':'season-tag'}>{selectionLabel(s)}</span>)}{!selections.length&&<span className="muted">尚未选择赛季</span>}</div><div className="toolbar-actions"><button className="text-button" aria-expanded={showSeasons} onClick={()=>setShowSeasons(v=>!v)}>选择赛季 {showSeasons?'−':'＋'}</button>{player&&<button className="text-button" disabled={loading} onClick={()=>setRevision(v=>v+1)} title="重新读取，服务器在缓存期内复用已验证数据">{loading?'读取中…':'↻ 重新读取'}</button>}</div></div>
      {showSeasons&&<div className="season-picker"><div className="picker-heading"><p>自由选择对比范围 <span className="muted small">最多 8 行 · 默认按日期自动更新</span></p><button className="text-button" onClick={()=>setSelections(defaultSelections(new Date(today)))}>恢复默认</button></div><div className="season-options">{seasonYears.map(year=><fieldset key={year}><legend>{seasonLabel(year)}</legend>{(['regular','preseason'] as const).map(type=>{const s={year,type};return <label key={type}><input type="checkbox" checked={selections.some(p=>selectionKey(p)===selectionKey(s))} onChange={()=>toggle(s)} disabled={selections.length>=8&&!selections.some(p=>selectionKey(p)===selectionKey(s))}/>{type==='regular'?'常规赛':'季前赛'}</label>;})}</fieldset>)}</div></div>}
      {exportError&&<p className="error" role="alert">{exportError}</p>}
      <div className="table-scroll" tabIndex={0} role="region" aria-label="球员数据表，可横向滚动"><table><caption className="sr-only">{player?name:'未选择球员'} · Yahoo Fantasy 11 CAT 赛季场均对比</caption><thead><tr>{headers.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{selections.map(s=>{
        const result=player?results[selectionKey(s)]:undefined;
        const row=result?.row;
        return <tr key={selectionKey(s)} className={s.type==='preseason'?'preseason-row':''}><th scope="row">{selectionLabel(s)}{row?.minutePrecision==='rounded-game-minutes'&&row.totals&&<small>MIN 为近似值</small>}</th>{!player?<td colSpan={15} className="empty-cell">{s===selections[0]?'搜索并选择球员后查看数据':'—'}</td>:!result?<td colSpan={15} className="state-cell"><span className="loading-dot"/> 正在读取 ESPN 数据…</td>:result.error?<td colSpan={15} className="error state-cell" role="alert">读取失败：{result.error}</td>:row?.status==='unavailable'?<td colSpan={15} className="state-cell muted">该赛季 / 赛事暂无可用出场记录，数值未填为 0。</td>:statCells(row?.totals??null).map((cell,i)=><td key={i} title={i===1&&row?.minutePrecision==='rounded-game-minutes'?'逐场整数分钟汇总，场均近似':undefined}>{cell}{i===1&&row?.minutePrecision==='rounded-game-minutes'?<sup> ≈</sup>:null}</td>)}</tr>;
      })}</tbody></table></div>
      <div className="table-footnotes"><p><strong>读表说明</strong> GP = 出场数；MIN = 场均分钟。除 GP、DD 外，计数均为场均；命中率和 A/T 按总数计算。</p><p>DD = 两双总次数（含三双）；— = 字段缺失或分母为 0。无罚球时 FT% 显示 —，真实零显示 0。季前赛小样本请结合角色与轮换判断。</p><p className="scroll-hint">↔ 手机可横向滑动查看全部列</p></div>
      {!!player&&<div className="source-section"><div className="source-heading"><span><span className="dot"/> 数据来源 · ESPN</span><span>{through?`最近读取：${timeLabel(through)}（北京时间）`:'正在连接数据源'}</span></div><p className="small muted">“读取时间”是本站获取源数据的时间，不代表 ESPN 的内部更新时间。季前赛缓存 5 分钟，历史常规赛缓存 6 小时。失败时不填充示例值。</p>{selections.map(s=>{const row=results[selectionKey(s)]?.row;return row&&<details key={selectionKey(s)}><summary>{selectionLabel(s)} · 来源与统计说明</summary><div className="source-detail"><p>读取：{timeLabel(row.fetchedAt)}（北京时间）{row.dataThrough?` · 已收录比赛截至 ${timeLabel(row.dataThrough)}`:' · 源未提供赛季总数最后更新时间'}</p>{row.notes.map(n=><p key={n}>{n}</p>)}<p>{row.sources.map(source=><a href={source.url} key={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</p></div></details>;})}</div>}
    </section>
    <footer><span>SIMPLE FANTASY <span className="footer-slash">/</span> 更清晰的选秀准备</span><span>免费公开数据 · 无需账号 · 非 Yahoo 官方产品</span></footer>
  </main>;
}
