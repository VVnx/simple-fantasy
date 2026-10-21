'use client';
/* eslint-disable @next/next/no-img-element -- Preserve original covers and use the restricted athlete image endpoint. */
import {Fragment,useEffect,useMemo,useState,type ReactNode} from 'react';
import {normalize,resolveSearch} from '@/lib/aliases';
import {gradeTone,playerCardLink,type StructuredBriefing} from '@/lib/briefing-structure';
import type {BoardDay} from '@/lib/surprise-board';

type Sort='rank'|'pts'|'reb'|'ast'|'three'|'st'|'blk'|'minutes';
const minuteValue=(value:string)=>{const [min,sec='0']=value.split(':');return Number(min)+Number(sec)/60;};
function Grade({value}:{value?:string}){return <span className={`bm-grade bm-grade-${gradeTone(value)}`}>{value||'未分档'}</span>;}

export default function BriefingMatchView({data,original}:{data:StructuredBriefing;original:ReactNode}){
  const [view,setView]=useState<'data'|'original'>('data'),[gameKey,setGameKey]=useState('all'),[grade,setGrade]=useState('all');
  const [query,setQuery]=useState(''),[sort,setSort]=useState<Sort>('rank'),[expanded,setExpanded]=useState('');
  const [portraits,setPortraits]=useState<Record<string,string>>({});
  useEffect(()=>{
    if(!data.performances.length)return;
    const controller=new AbortController();
    fetch(`/api/surprise-board?date=${data.date}`,{signal:controller.signal}).then(async response=>{
      if(!response.ok)return;
      const result=await response.json() as BoardDay;
      if(controller.signal.aborted||result.date!==data.date||!Array.isArray(result.players))return;
      const entries=result.players.filter(p=>/^\d+$/.test(p.id)&&p.team&&p.boardName).map(p=>[`${normalize(p.team)}:${normalize(p.boardName)}`,p.id]);
      setPortraits(Object.fromEntries(entries));
    }).catch(()=>{/* Photos are optional; the saved briefing remains readable offline from upstream data. */});
    return ()=>controller.abort();
  },[data.date,data.performances.length]);
  const grades=[...new Set(data.performances.map(p=>p.grade).filter((g):g is string=>!!g))];
  const rows=useMemo(()=>{
    const raw=normalize(query),resolved=normalize(resolveSearch(query));
    return data.performances.filter(p=>(gameKey==='all'||p.gameKey===gameKey)&&(grade==='all'||p.grade===grade)&&(!raw||normalize(p.name+p.team).includes(raw)||normalize(resolveSearch(p.name)).includes(resolved)))
      .sort((a,b)=>{const order=(a.rank??999)-(b.rank??999);if(sort==='rank')return order;if(sort==='minutes')return minuteValue(b.minutes)-minuteValue(a.minutes)||order;return b.stats[sort]-a.stats[sort]||order;});
  },[data.performances,gameKey,grade,query,sort]);
  const otherRankings=data.rankings.filter(r=>!r.performanceKey);
  function reset(){setGameKey('all');setGrade('all');setQuery('');setSort('rank');setExpanded('');}
  return <div className="briefing-match-view">
    <div className="bm-view-bar"><div className="bm-view-switch" role="group" aria-label="简报视图"><button type="button" aria-pressed={view==='data'} onClick={()=>setView('data')}>比赛与数据</button><button type="button" aria-pressed={view==='original'} onClick={()=>setView('original')}>简报原文</button></div><span>内容以本期简报为准</span></div>
    <div hidden={view!=='original'} className="bm-original">{original}</div>
    <div hidden={view!=='data'}>
      <nav className="bm-overview" aria-label="本期内容"><a href="#briefing-games"><strong>{data.games.length}</strong><span>场比赛</span></a><a href="#briefing-performances"><strong>{data.rankings.length||data.performances.length}</strong><span>位惊喜球员</span></a><a href="#briefing-lineup"><strong>{data.lineupUpdates.length}</strong><span>条阵容动态</span></a></nav>
      {data.notes.filter(n=>n.section==='简报导语').map((n,i)=><p className="bm-intro" key={i}>{n.text}</p>)}
      {data.games.length>0&&<section id="briefing-games" className="bm-section" aria-label="逐场比赛"><div className="bm-section-heading"><h2>逐场比赛</h2><span>点击比赛筛选球员 · 展开查看简评</span></div>
        <div className="bm-game-grid">{data.games.map((game,i)=>{
          const members=data.performances.filter(p=>p.gameKey===game.key);
          return <article className={`bm-game ${gameKey===game.key?'is-active':''}`} key={game.key}>
            <button className="bm-game-score" type="button" aria-label={`筛选${game.teams.map(t=>t.name).join('对')}的球员`} aria-pressed={gameKey===game.key} onClick={()=>setGameKey(gameKey===game.key?'all':game.key)}>
              <span className="bm-game-label">{String(i+1).padStart(2,'0')} / 比赛结果</span>
              {game.teams.map((team,index)=><span className={`bm-team-score ${team.score>game.teams[1-index].score?'is-winner':''}`} key={team.name}><span>{team.name}</span><b>{team.score}</b></span>)}
              <span className="bm-game-count">{members.length} 位惊喜球员 <span aria-hidden="true">↗</span></span>
            </button>
            {game.headline&&<h3>{game.headline}</h3>}
            <details className="bm-game-review"><summary>展开逐场简评</summary>{game.paragraphs.map((p,index)=><p key={index}>{p}</p>)}</details>
          </article>;
        })}</div>
      </section>}
      <section id="briefing-performances" className="bm-section" aria-label="惊喜球员表现">
        <div className="bm-section-heading"><div><h2>每日惊喜球员</h2><p>按简报从夯到拉排列；点击球员姓名查看评价。</p></div><a href={`/surprise-board?date=${data.date}`}>去拖拽榜摆头像 ↗</a></div>
        {data.performances.length>0&&<>
          <div className="bm-filters">
            <label>比赛<select aria-label="筛选比赛" value={gameKey} onChange={e=>setGameKey(e.target.value)}><option value="all">全部比赛</option>{data.games.map(g=><option key={g.key} value={g.key}>{g.teams.map(t=>t.name).join(' vs ')}</option>)}</select></label>
            <label>档位<select aria-label="筛选档位" value={grade} onChange={e=>setGrade(e.target.value)}><option value="all">全部档位</option>{grades.map(g=><option key={g} value={g}>{g}</option>)}</select></label>
            <label className="bm-player-search">查找球员<input aria-label="查找惊喜球员" value={query} onChange={e=>setQuery(e.target.value)} placeholder="姓名或球队"/></label>
            <label>排序<select aria-label="数据排序" value={sort} onChange={e=>setSort(e.target.value as Sort)}><option value="rank">从夯到拉</option><option value="pts">得分从高到低</option><option value="reb">篮板从高到低</option><option value="ast">助攻从高到低</option><option value="three">三分从高到低</option><option value="st">抢断从高到低</option><option value="blk">盖帽从高到低</option><option value="minutes">时间从高到低</option></select></label>
            <button type="button" onClick={reset}>重置</button>
          </div>
          <div className="bm-result-count" role="status">显示 {rows.length} / {data.performances.length} 位惊喜球员</div>
          <div className="bm-table-scroll" tabIndex={0} role="region" aria-label="惊喜球员数据表，可横向滚动"><table className="bm-table">
            <thead><tr>{['球员 / 球队','档位','出场','得分','篮板','助攻','三分','投篮','罚球','抢断','盖帽','失误','卡片'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{rows.map(p=>{
              const stats=p.stats,id=portraits[p.key];
              return <Fragment key={p.key}><tr>
                <th scope="row"><button type="button" className="bm-player-name" aria-label={`查看${p.name}简评`} aria-expanded={expanded===p.key} aria-controls={`review-${p.key}`} onClick={()=>setExpanded(expanded===p.key?'':p.key)}><span className="bm-avatar">{id?<img src={`/api/player-headshot?id=${id}`} alt="" loading="lazy"/>:p.name.slice(0,1)}</span><span><strong>{p.name}</strong><small>{p.team}</small></span><span className="bm-expand" aria-hidden="true">{expanded===p.key?'−':'+'}</span></button></th>
                <td><Grade value={p.grade}/></td><td>{p.minutes}<small className="bm-unit">{p.minutes.includes(':')?'分:秒':'分钟'}</small></td>
                {[stats.pts,stats.reb,stats.ast,stats.three].map((value,index)=><td className={index===0?'bm-points':''} key={index}>{value}</td>)}
                <td>{stats.fgm}/{stats.fga}</td><td>{stats.ftm}/{stats.fta}</td><td>{stats.st}</td><td>{stats.blk}</td><td>{stats.to}</td>
                <td><a className="bm-make-card" href={playerCardLink(p)} aria-label={`制作${p.name}数据卡片`}>生成 ↗</a></td>
              </tr><tr id={`review-${p.key}`} className="bm-player-review" hidden={expanded!==p.key}><td colSpan={13}><Grade value={p.grade}/><strong>{p.name}</strong><p>{p.reason||'本期附录列出了这名球员的数据，暂无单独评价。'}</p></td></tr></Fragment>;
            })}{!rows.length&&<tr><td colSpan={13} className="bm-empty">没有符合筛选条件的球员。<button type="button" onClick={reset}>查看全部</button></td></tr>}</tbody>
          </table></div>
          <p className="bm-table-note">投篮、罚球为命中 / 出手；三分为命中数。出场时间保留原文精度。小屏可左右滑动查看。</p>
        </>}
        {otherRankings.length>0&&<div className="bm-rankings">{otherRankings.map(r=><article key={r.key}><Grade value={r.grade}/><h3>{r.name}</h3><p>{r.reason}</p></article>)}</div>}
        {!data.performances.length&&!data.rankings.length&&<p className="bm-empty">本期没有单独列出惊喜球员。</p>}
      </section>
      {data.lineupUpdates.length>0&&<section id="briefing-lineup" className="bm-section" aria-label="影响后续阵容"><div className="bm-section-heading"><div><h2>影响后续阵容</h2><p>伤病、复出、轮换机会与加人建议。</p></div><span>{data.lineupUpdates.length} 条动态</span></div>
        <div className="bm-lineup">{data.lineupUpdates.map((update,i)=><details key={update.key}><summary><span>{String(i+1).padStart(2,'0')}</span><strong>{update.title}</strong><b aria-hidden="true">+</b></summary><div>{update.paragraphs.map((p,index)=><p key={index}>{p}</p>)}</div></details>)}</div>
      </section>}
      {data.notes.filter(n=>n.section!=='简报导语').length>0&&<section className="bm-section bm-retained"><h2>简报补充</h2>{data.notes.filter(n=>n.section!=='简报导语').map((n,i)=><div key={i}><h3>{n.section}</h3><p>{n.text}</p></div>)}</section>}
      {data.warnings.length>0&&<details className="bm-parse-notes"><summary>部分内容按原文保留</summary>{data.warnings.map((w,i)=><p key={i}>{w}</p>)}</details>}
    </div>
  </div>;
}
