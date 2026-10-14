'use client';
import { useEffect, useState } from 'react';
import ToolNavigation from './tool-navigation';
import { addDays, buildScheduleRows, countsAsGame, easternDate, GAME_TIMEZONE, mondayOf, NBA_TEAMS, SCHEDULE_TYPES, shortDate, validDate, weekDays, weekday, type ScheduleType, type TeamGame, type WeekSchedule } from '@/lib/schedule';

type LoadState={key:string;data?:WeekSchedule;error?:string};
const statuses={scheduled:'未开赛',live:'进行中',final:'已结束',postponed:'延期 / 待定',canceled:'取消'};
function GameCell({game}:{game:TeamGame}){
  const time=game.timeKnown?new Intl.DateTimeFormat('zh-CN',{timeZone:GAME_TIMEZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(game.tipoff)):'时间待定';
  const location=game.neutral?'中立':game.home?'主':'客';
  return <div className={`schedule-game${game.backToBack?' is-b2b':''}${!countsAsGame(game)?' is-canceled':''}${game.status==='final'?' is-finished':''}`}>
    <span className="game-opponent"><span className="game-location">{location}</span>{game.opponent}</span>
    <small>{game.status==='scheduled'?time:statuses[game.status]}{game.backToBack&&<b className="b2b-label">背靠背</b>}</small>
  </div>;
}
export default function ScheduleTool({today}:{today:string}){
  const [now,setNow]=useState(()=>new Date(today));
  const [week,setWeek]=useState(()=>mondayOf(easternDate(new Date(today))));
  const [type,setType]=useState<ScheduleType>('regular');
  const [fromChoice,setFromChoice]=useState('');
  const [sort,setSort]=useState('remaining');
  const [onlyPairs,setOnlyPairs]=useState(false);
  const [revision,setRevision]=useState(0);
  const [state,setState]=useState<LoadState>({key:''});
  const dates=weekDays(week), todayET=easternDate(now), end=dates[6];
  const from=fromChoice|| (todayET<week?week:todayET>end?end:todayET);
  const key=`${week}:${revision}`;
  useEffect(()=>{
    const timer=setInterval(()=>setNow(new Date()),60_000);
    return ()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`/api/schedule?week=${week}`,{signal:controller.signal}).then(async response=>{
      const body=await response.json() as WeekSchedule & {error?:string};
      if(!response.ok)throw new Error(body.error||'赛程暂时无法读取。');
      if(body.weekStart!==week||!Array.isArray(body.games))throw new Error('返回的赛程周次不匹配，请重试。');
      if(!controller.signal.aborted)setState({key,data:body});
    }).catch(error=>{
      if(!controller.signal.aborted)setState({key,error:error instanceof Error?error.message:'赛程读取失败。'});
    });
    return ()=>controller.abort();
  },[week,key]);
  const current=state.key===key?state:undefined, data=current?.data, loading=!current;
  const rows=data?buildScheduleRows(data,type,from,now):[];
  const pairTeams=rows.filter(row=>row.pairs.some(pair=>pair.available));
  const visible=rows.filter(row=>!onlyPairs||row.pairs.some(pair=>pair.available)).sort((a,b)=>{
    if(sort==='total')return b.total-a.total||a.team.abbreviation.localeCompare(b.team.abbreviation);
    if(sort==='two')return b.nextTwo-a.nextTwo||b.remaining-a.remaining||a.team.abbreviation.localeCompare(b.team.abbreviation);
    if(sort==='team')return a.team.abbreviation.localeCompare(b.team.abbreviation);
    return b.remaining-a.remaining||b.total-a.total||a.team.abbreviation.localeCompare(b.team.abbreviation);
  });
  const weeklyGames=data?.games.filter(game=>game.type===type&&game.date>=week&&game.date<=end&&countsAsGame(game));
  const dailyCounts=dates.map(date=>weeklyGames?.filter(game=>game.date===date).length??0);
  function changeWeek(date:string){
    if(!validDate(date))return;
    const next=mondayOf(date);
    if(next<'2002-01-01'||next>'2100-12-31')return;
    setWeek(next);setFromChoice('');
  }
  return <main className="schedule-page">
    <header className="site-header"><h1>Fantasy Timeline</h1><ToolNavigation active="schedule"/></header>
    <section className="schedule-heading">
      <div><h2>每周赛程</h2><p>先看场次，再找连续两天的补人机会。</p></div>
      <div className="week-controls" aria-label="选择赛程周次">
        <button onClick={()=>changeWeek(addDays(week,-7))} disabled={addDays(week,-7)<'2002-01-01'} aria-label="上一周">‹</button>
        <label className="week-picker"><span>{week.slice(0,4)} · {shortDate(week)} — {shortDate(end)}</span><input aria-label="选择周内任意日期" type="date" min="2002-01-07" max="2100-12-31" value={week} onInput={e=>changeWeek(e.currentTarget.value)} onChange={e=>changeWeek(e.target.value)}/></label>
        <button onClick={()=>changeWeek(addDays(week,7))} disabled={addDays(week,7)>'2100-12-31'} aria-label="下一周">›</button>
        <button onClick={()=>changeWeek(todayET)}>本周</button>
      </div>
    </section>
    <div className="schedule-controls">
      <label>赛事 <select value={type} onChange={e=>setType(e.target.value as ScheduleType)}>{Object.entries(SCHEDULE_TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>补人起始日 <select value={from} onChange={e=>setFromChoice(e.target.value)}>{dates.map(date=><option key={date} value={date}>{weekday(date)} {shortDate(date)}{date===todayET?' · 今天':''}</option>)}</select></label>
      <label>排序 <select value={sort} onChange={e=>setSort(e.target.value)}><option value="remaining">剩余场次优先</option><option value="two">起始两天场次优先</option><option value="total">全周场次优先</option><option value="team">球队缩写 A–Z</option></select></label>
      <label className="pair-filter"><input type="checkbox" checked={onlyPairs} onChange={e=>setOnlyPairs(e.target.checked)}/>只看可用背靠背</label>
    </div>
    <p className="schedule-timezone">按美东日期，周一至周日 · 时间为美东时间（ET） · 剩余场次不含已开赛、延期或取消的比赛</p>
    <div aria-live="polite">
      {loading&&<p className="schedule-message">正在读取一周赛程…</p>}
      {current?.error&&<p className="schedule-message error" role="alert">{current.error} <button onClick={()=>setRevision(value=>value+1)}>重试</button></p>}
      {data&&<div className="schedule-summary">
        <span>全联盟 <strong>{weeklyGames?.length}</strong> 场</span>
        <span>剩余 ≥ 3 场 <strong>{rows.filter(row=>row.remaining>=3).length}</strong> 队</span>
        <span>起始两天 ≥ 2 场 <strong>{rows.filter(row=>row.nextTwo>=2).length}</strong> 队</span>
        <span>可用背靠背 <strong>{pairTeams.length}</strong> 队 <small>含跨周</small></span>
      </div>}
      {data&&weeklyGames?.length===0&&<p className="schedule-message">数据源尚未列出本周的{SCHEDULE_TYPES[type]}比赛，可能处于休赛期或赛程尚未公布。可切换周次或赛事。{type==='regular'&&data.games.some(game=>game.type==='preseason'&&game.date>=week&&game.date<=end)&&<button onClick={()=>setType('preseason')}>查看本周季前赛</button>}</p>}
    </div>
    {type==='preseason'&&<p className="schedule-notice">当前为季前赛，仅用于观察，不计入 Fantasy 常规赛成绩。</p>}
    <div className="table-scroll schedule-scroll" tabIndex={0} role="region" aria-label="30 支球队每周比赛网格，可横向和纵向滚动" aria-busy={loading}>
      <table className="schedule-grid">
        <caption className="sr-only">{shortDate(week)}至{shortDate(end)}，{SCHEDULE_TYPES[type]}，30 支 NBA 球队全周场次、剩余场次、每日对手与背靠背</caption>
        <thead><tr><th scope="col" className="team-column">球队</th><th scope="col">全周</th><th scope="col">剩余<small>{weekday(from)}起</small></th>{dates.map((date,i)=><th key={date} scope="col" className={date===todayET?'is-today':''}><span>{weekday(date)}</span><small>{shortDate(date)}{date===todayET?' · 今天':''}</small><small>{data?`${dailyCounts[i]} 场`:'—'}</small></th>)}<th scope="col" className="pairs-column">背靠背<small>连续两天</small></th></tr></thead>
        <tbody>{!data?NBA_TEAMS.map(team=><tr key={team.id}><th scope="row" className="team-column">{team.name}<small>{team.abbreviation}</small></th><td>—</td><td>—</td>{dates.map(date=><td key={date}><span className="no-game">{loading?'…':'—'}</span></td>)}<td>—</td></tr>):visible.map(row=><tr key={row.team.id}>
          <th scope="row" className="team-column">{row.team.name}<small>{row.team.abbreviation} · {row.team.conference}</small></th>
          <td className="count-cell"><strong>{row.total}</strong></td><td className="count-cell remaining-cell"><strong>{row.remaining}</strong></td>
          {row.days.map((games,i)=><td key={dates[i]} className={`${dates[i]===todayET?'is-today ':''}${dates[i]<from?'before-start':''}`}>{games.length?games.map(game=><GameCell key={game.id} game={game}/>):<span className="no-game" aria-label="无已公布比赛">—</span>}</td>)}
          <td className="pairs-column">{row.pairs.length?row.pairs.map(pair=><span key={pair.start} className={`pair-chip${pair.available?' available':''}`}>{weekday(pair.start)} / {weekday(pair.end)}{(pair.start<week||pair.end>end)&&' · 跨周'}<small>{pair.available?'可补两场':'已过 / 不可补齐'}</small></span>):<span className="no-game">—</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {data&&onlyPairs&&visible.length===0&&<p className="schedule-message">从所选起始日起，没有两场均未开赛的背靠背组合。<button onClick={()=>setOnlyPairs(false)}>显示全部 30 队</button></p>}
    <footer className="schedule-footnotes">
      <p><span className="b2b-key"/> 绿色标记背靠背；“可补两场”表示两场均未开赛且不早于起始日。跨周组合会注明，周外比赛不计入本周总数。</p>
      <p>剩余场次 = 起始日至周日的未开赛比赛；“起始两天”也仅计本周。时间待定的比赛按日期计入。球队赛程不保证球员出场，补人还需结合轮休、伤病与联盟生效时间。</p>
      <p>数据：<a href={`https://www.espn.com/nba/schedule/_/date/${week.replaceAll('-','')}`} target="_blank" rel="noreferrer">ESPN 赛程</a>{data&&` · 读取于 ${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(data.fetchedAt))}（北京时间）`}。赛程可能调整；无已公布比赛时不代表赛季最终安排。</p>
    </footer>
  </main>;
}
