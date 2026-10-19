'use client';
import { useEffect, useState } from 'react';
import ToolNavigation from './tool-navigation';
import { addDays, buildScheduleRows, countsAsGame, currentScheduleWeek, easternDate, GAME_TIMEZONE, NBA_TEAMS, seasonWeekNumber, seasonWeeks, shortDate, weekDays, weekday, type ScheduleSeason, type ScheduleWeeks, type TeamGame, type WeekSchedule } from '@/lib/schedule';
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
  const [weeks,setWeeks]=useState<ScheduleWeeks>(1);
  const [revision,setRevision]=useState(0);
  const [sortDirection,setSortDirection]=useState<'ascending'|'descending'>('descending');
  const [state,setState]=useState<LoadState>({key:''});
  const [exporting,setExporting]=useState(false);
  const [exportResult,setExportResult]=useState<{key:string;error?:string;message?:string}>();
  const key=`${week}:${weeks}:${revision}`;
  useEffect(()=>{
    if(!week)return;
    const controller=new AbortController();
    fetch(`/api/schedule?week=${week}&weeks=${weeks}`,{signal:controller.signal}).then(async response=>{
      const body=await response.json() as WeekSchedule & {error?:string};
      if(!response.ok)throw new Error(body.error||'赛程暂时无法读取。');
      if(body.weekStart!==week||body.weeks!==weeks||!Array.isArray(body.games))throw new Error('返回的赛程周次不匹配，请重试。');
      if(!controller.signal.aborted)setState({key,data:body});
    }).catch(error=>{
      if(!controller.signal.aborted)setState({key,error:error instanceof Error?error.message:'赛程读取失败。'});
    });
    return ()=>controller.abort();
  },[week,weeks,key]);
  const current=state.key===key?state:undefined, data=current?.data, loading=!!season&&!current;
  const dates=week?weekDays(week,weeks):[];
  const availableWeeks=season?seasonWeeks(season,weeks):[];
  const firstWeekNumber=season?seasonWeekNumber(week,season):null;
  const weekLabel=`Week ${firstWeekNumber}${weeks===2?`–${firstWeekNumber!+1}`:''}`;
  function changeWeeks(value:ScheduleWeeks){
    setWeeks(value);
    if(season)setWeek(current=>currentScheduleWeek(current,season,value));
  }
  const dateClass=(date:string,index:number)=>`date-header${date===todayET?' is-today':''}${index===7?' week-boundary':''}`;
  const dayHeaders=dates.map((date,i)=><th key={date} scope="col" className={dateClass(date,i)}>{weekday(date)}<small>{shortDate(date)}</small></th>);
  const rows=data?buildScheduleRows(data,'regular').sort((a,b)=>
    (sortDirection==='ascending'?a.total-b.total:b.total-a.total)||a.team.abbreviation.localeCompare(b.team.abbreviation)
  ):[];
  const hasGames=rows.some(row=>row.total>0);
  const totals=rows.map(row=>row.total);
  const minTotal=Math.min(...totals), maxTotal=Math.max(...totals);
  async function exportImage(){
    if(!data||!season||exporting)return;
    setExporting(true);setExportResult(undefined);
    try{
      const {downloadSchedulePng}=await import('@/lib/schedule-export');
      await downloadSchedulePng(data,{season,direction:sortDirection,today:todayET});
      setExportResult({key,message:'图片已生成'});
    }catch(error){
      setExportResult({key,error:error instanceof Error?error.message:'导出失败，请重试。'});
    }finally{setExporting(false);}
  }
  return <main className="schedule-page">
    <header className="site-header"><a className="site-brand" href="/">Fantasy - All Timeline</a><ToolNavigation active="schedule"/></header>
    <section className="schedule-heading">
      <div><h1>NBA 每周赛程</h1>{season&&<p>{seasonLabel(season.year)} 常规赛 · 单周与双周、背靠背、图片导出</p>}</div>
      {season&&<div className="schedule-controls">
        <div className="period-toggle" role="group" aria-label="赛程范围">
          <button type="button" aria-pressed={weeks===1} onClick={()=>changeWeeks(1)}>单周</button>
          <button type="button" aria-pressed={weeks===2} onClick={()=>changeWeeks(2)}>双周</button>
        </div>
        <div className="week-controls" aria-label="选择 Week">
        <button onClick={()=>setWeek(addDays(week,-7))} disabled={week<=season.firstWeek} aria-label="上一周">‹</button>
        <label className="week-picker"><span className="sr-only">Week</span><select value={week} onChange={e=>setWeek(e.target.value)}>{availableWeeks.map((date,i)=><option key={date} value={date}>Week {i+1}{weeks===2?`–${i+2}`:''} · {shortDate(date)} – {shortDate(addDays(date,7*weeks-1))}</option>)}</select></label>
        <button onClick={()=>setWeek(addDays(week,7))} disabled={week>=availableWeeks[availableWeeks.length-1]} aria-label="下一周">›</button>
        <button className="current-week" onClick={()=>setWeek(currentScheduleWeek(easternDate(new Date()),season,weeks))}>本周</button>
        </div>
      </div>}
    </section>
    {!season?<p className="schedule-message" role="alert">赛季信息暂时无法读取。<button onClick={()=>window.location.reload()}>重试</button></p>:<>
      <div aria-live="polite">
        {loading&&<p className="schedule-message">正在读取赛程…</p>}
        {current?.error&&<p className="schedule-message error" role="alert">赛程暂时无法读取。<button onClick={()=>setRevision(value=>value+1)}>重试</button></p>}
        {data&&!hasGames&&<p className="schedule-message">{weeks===2?'这两周':'本周'}暂无已公布比赛。</p>}
      </div>
      <div className="table-scroll schedule-scroll" tabIndex={0} role="region" aria-label={`30 支球队${weeks===2?'双周':'单周'}比赛网格，可横向和纵向滚动`} aria-busy={loading}>
        <table className={`schedule-grid${weeks===2?' is-fortnight':''}`}>
          <caption className="sr-only">{weekLabel}，{shortDate(week)}至{shortDate(dates[dates.length-1])}，30 支 NBA 球队总场次与每日对手</caption>
          <thead><tr><th scope="col" rowSpan={weeks} className="team-column">球队</th><th scope="col" rowSpan={weeks} className="total-column" aria-sort={sortDirection}>
            <button type="button" className="count-sort" onClick={()=>setSortDirection(direction=>direction==='ascending'?'descending':'ascending')} aria-label={sortDirection==='ascending'?'按场次降序排列':'按场次升序排列'} title={sortDirection==='ascending'?'切换为降序':'切换为升序'}>
              场次<span aria-hidden="true">{sortDirection==='ascending'?'↑':'↓'}</span>
            </button>
            {weeks===2&&<small>两周</small>}
          </th>{weeks===2?[0,1].map(i=><th key={i} scope="colgroup" colSpan={7} className={`week-group${i===1?' week-boundary':''}`}>Week {firstWeekNumber!+i}</th>):dayHeaders}</tr>
          {weeks===2&&<tr>{dayHeaders}</tr>}</thead>
          <tbody>{!data?NBA_TEAMS.map(team=><tr key={team.id}><th scope="row" className="team-column">{team.name}<small>{team.abbreviation}</small></th><td className="count-cell">—</td>{dates.map((date,i)=><td key={date} className={i===7?'week-boundary':''}><span className="no-game">{loading?'…':'—'}</span></td>)}</tr>):rows.map(row=><tr key={row.team.id}>
            <th scope="row" className="team-column">{row.team.name}<small>{row.team.abbreviation}</small></th>
            <td className={`count-cell${maxTotal>minTotal?(row.total===maxTotal?' is-most':row.total===minTotal?' is-fewest':''):''}`}><strong>{row.total}</strong></td>
            {row.days.map((games,i)=><td key={dates[i]} className={`${dates[i]===todayET?'is-today ':''}${i===7?'week-boundary':''}`}>{games.length?games.map(game=><GameCell key={game.id} game={game}/>):<span className="no-game" aria-label="无比赛">—</span>}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <footer className="schedule-footer">
        <div className="schedule-footnotes"><a href={`https://www.espn.com/nba/schedule/_/date/${week.replaceAll('-','')}`} target="_blank" rel="noreferrer">ESPN</a><span><i className="b2b-key"/>背靠背</span><span>美东日期</span></div>
        <div className="schedule-export-actions">
          {exportResult?.key===key&&(exportResult.error?<span role="alert" className="error">{exportResult.error}</span>:<span role="status">{exportResult.message}</span>)}
          <button type="button" onClick={exportImage} disabled={!data||loading||exporting}>{exporting?'正在生成图片…':`导出${weeks===2?'双周':'单周'}图片`}</button>
        </div>
      </footer>
    </>}
  </main>;
}
