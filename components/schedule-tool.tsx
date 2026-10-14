'use client';
import { useEffect, useState } from 'react';
import ToolNavigation from './tool-navigation';
import { addDays, buildScheduleRows, countsAsGame, currentScheduleWeek, easternDate, GAME_TIMEZONE, NBA_TEAMS, seasonWeekNumber, seasonWeeks, shortDate, weekDays, weekday, type ScheduleSeason, type TeamGame, type WeekSchedule } from '@/lib/schedule';
import { seasonLabel } from '@/lib/seasons';

type LoadState={key:string;data?:WeekSchedule;error?:string};
const statuses={scheduled:'未开赛',live:'进行中',final:'已结束',postponed:'延期',canceled:'取消'};
function GameCell({game}:{game:TeamGame}){
  const time=game.timeKnown?new Intl.DateTimeFormat('zh-CN',{timeZone:GAME_TIMEZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(game.tipoff)):'时间待定';
  const location=game.neutral?'中立':game.home?'主':'客';
  const detail=`${location}场 · ${game.opponent} · ${time} ET · ${statuses[game.status]}${game.backToBack?' · 背靠背':''}`;
  return <div className={`schedule-game${game.backToBack?' is-b2b':''}${!countsAsGame(game)?' is-canceled':''}`} title={detail} aria-label={detail}>
    <span className="game-location">{location}</span><span>{game.opponent}</span>
    {!countsAsGame(game)&&<small>{statuses[game.status]}</small>}
  </div>;
}
export default function ScheduleTool({today,season}:{today:string;season?:ScheduleSeason}){
  const todayET=easternDate(new Date(today));
  const [week,setWeek]=useState(()=>season?currentScheduleWeek(todayET,season):'');
  const [revision,setRevision]=useState(0);
  const [sortDirection,setSortDirection]=useState<'ascending'|'descending'>('descending');
  const [state,setState]=useState<LoadState>({key:''});
  const key=`${week}:${revision}`;
  useEffect(()=>{
    if(!week)return;
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
  const current=state.key===key?state:undefined, data=current?.data, loading=!!season&&!current;
  const dates=week?weekDays(week):[];
  const rows=data?buildScheduleRows(data,'regular').sort((a,b)=>
    (sortDirection==='ascending'?a.total-b.total:b.total-a.total)||a.team.abbreviation.localeCompare(b.team.abbreviation)
  ):[];
  const hasGames=rows.some(row=>row.total>0);
  return <main className="schedule-page">
    <header className="site-header"><h1>Fantasy - All Timeline</h1><ToolNavigation active="schedule"/></header>
    <section className="schedule-heading">
      <div><h2>每周赛程</h2>{season&&<p>{seasonLabel(season.year)} 常规赛</p>}</div>
      {season&&<div className="week-controls" aria-label="选择 Week">
        <button onClick={()=>setWeek(addDays(week,-7))} disabled={week<=season.firstWeek} aria-label="上一周">‹</button>
        <label className="week-picker"><span className="sr-only">Week</span><select value={week} onChange={e=>setWeek(e.target.value)}>{seasonWeeks(season).map((date,i)=><option key={date} value={date}>Week {i+1} · {shortDate(date)} – {shortDate(addDays(date,6))}</option>)}</select></label>
        <button onClick={()=>setWeek(addDays(week,7))} disabled={week>=season.lastWeek} aria-label="下一周">›</button>
        <button className="current-week" onClick={()=>setWeek(currentScheduleWeek(easternDate(new Date()),season))}>本周</button>
      </div>}
    </section>
    {!season?<p className="schedule-message" role="alert">赛季信息暂时无法读取。<button onClick={()=>window.location.reload()}>重试</button></p>:<>
      <div aria-live="polite">
        {loading&&<p className="schedule-message">正在读取赛程…</p>}
        {current?.error&&<p className="schedule-message error" role="alert">赛程暂时无法读取。<button onClick={()=>setRevision(value=>value+1)}>重试</button></p>}
        {data&&!hasGames&&<p className="schedule-message">本周暂无已公布比赛。</p>}
      </div>
      <div className="table-scroll schedule-scroll" tabIndex={0} role="region" aria-label="30 支球队每周比赛网格，可横向和纵向滚动" aria-busy={loading}>
        <table className="schedule-grid">
          <caption className="sr-only">Week {seasonWeekNumber(week,season)}，{shortDate(week)}至{shortDate(dates[6])}，30 支 NBA 球队总场次与每日对手</caption>
          <thead><tr><th scope="col" className="team-column">球队</th><th scope="col" className="total-column" aria-sort={sortDirection}>
            <button type="button" className="count-sort" onClick={()=>setSortDirection(direction=>direction==='ascending'?'descending':'ascending')} aria-label={sortDirection==='ascending'?'按场次降序排列':'按场次升序排列'} title={sortDirection==='ascending'?'切换为降序':'切换为升序'}>
              场次<span aria-hidden="true">{sortDirection==='ascending'?'↑':'↓'}</span>
            </button>
          </th>{dates.map(date=><th key={date} scope="col" className={date===todayET?'is-today':''}>{weekday(date)}<small>{shortDate(date)}</small></th>)}</tr></thead>
          <tbody>{!data?NBA_TEAMS.map(team=><tr key={team.id}><th scope="row" className="team-column">{team.name}<small>{team.abbreviation}</small></th><td>—</td>{dates.map(date=><td key={date}><span className="no-game">{loading?'…':'—'}</span></td>)}</tr>):rows.map(row=><tr key={row.team.id}>
            <th scope="row" className="team-column">{row.team.name}<small>{row.team.abbreviation}</small></th>
            <td className="count-cell"><strong>{row.total}</strong></td>
            {row.days.map((games,i)=><td key={dates[i]} className={dates[i]===todayET?'is-today':''}>{games.length?games.map(game=><GameCell key={game.id} game={game}/>):<span className="no-game" aria-label="无比赛">—</span>}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <footer className="schedule-footnotes"><span><i className="b2b-key"/>背靠背</span><span>美东日期</span><a href={`https://www.espn.com/nba/schedule/_/date/${week.replaceAll('-','')}`} target="_blank" rel="noreferrer">ESPN</a></footer>
    </>}
  </main>;
}
