import {z} from 'zod';
import {chineseName} from '../aliases';
import {NBA_TEAMS,easternDate} from '../schedule';
import {localDate,type CardDay,type PlayerGameCard} from '../player-cards';
import {fetchJson} from './http';
import {requestCache} from './cache';
import {DataError,publicError} from './errors';
const API='https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const id=z.string().regex(/^\d{1,12}$/);
const status=z.object({type:z.object({completed:z.boolean()})});
const scoreboard=z.object({events:z.array(z.object({id,date:z.string(),status}))});
const team=z.object({id,displayName:z.string(),color:z.string().optional()});
const summary=z.object({
  header:z.object({id,competitions:z.array(z.object({date:z.string(),status,competitors:z.array(z.object({team,score:z.union([z.string(),z.number()]),homeAway:z.string()}))}))}),
  boxscore:z.object({players:z.array(z.object({team,statistics:z.array(z.object({labels:z.array(z.string()),athletes:z.array(z.object({athlete:z.object({id,displayName:z.string(),jersey:z.string().optional()}),didNotPlay:z.boolean().optional(),stats:z.array(z.string()).optional()}))}))}))}),
});
const bad=()=>new DataError('SCHEMA','比赛数据不完整，暂时无法生成这场的卡片。');
const teamName=(value:z.infer<typeof team>)=>NBA_TEAMS.find(t=>t.id===value.id)?.name||value.displayName;
function count(value:string|undefined) {if(value===undefined||!/^\d+$/.test(value))throw bad();return Number(value);}
function pair(value:string|undefined) {const parts=value?.match(/^(\d+)[-/](\d+)$/);if(!parts)throw bad();const made=Number(parts[1]),attempted=Number(parts[2]);if(made>attempted)throw bad();return [made,attempted];}
export function parseCardScoreboard(raw:unknown,date:string) {
  const parsed=scoreboard.safeParse(raw);if(!parsed.success)throw bad();
  const events=parsed.data.events;
  if(events.length>20||new Set(events.map(e=>e.id)).size!==events.length)throw bad();
  for(const event of events)if(!Number.isFinite(Date.parse(event.date))||easternDate(new Date(event.date))!==date)throw new DataError('MISMATCH','返回的比赛日期不匹配，请重试。');
  return {finished:events.filter(e=>e.status.type.completed).map(e=>e.id),pending:events.filter(e=>!e.status.type.completed).length};
}
export function parseCardGame(raw:unknown,gameId:string,date:string):PlayerGameCard[] {
  const parsed=summary.safeParse(raw);if(!parsed.success)throw bad();const d=parsed.data,game=d.header.competitions[0];
  if(d.header.id!==gameId||!game||!game.status.type.completed||!Number.isFinite(Date.parse(game.date))||easternDate(new Date(game.date))!==date)throw new DataError('MISMATCH','返回的场次、日期或完赛状态不匹配。');
  const teams=game.competitors;
  if(teams.length!==2||new Set(teams.map(t=>t.team.id)).size!==2||d.boxscore.players.length!==2||new Set(d.boxscore.players.map(t=>t.team.id)).size!==2)throw bad();
  const home=teams.find(t=>t.homeAway==='home'),away=teams.find(t=>t.homeAway==='away');if(!home||!away)throw bad();
  const matchup=`${teamName(away.team)} ${away.score} — ${home.score} ${teamName(home.team)}`;
  const players:PlayerGameCard[]=[];
  for(const block of d.boxscore.players){
    const own=teams.find(t=>t.team.id===block.team.id),opponent=teams.find(t=>t.team.id!==block.team.id);if(!own||!opponent||block.statistics.length!==1)throw bad();
    const table=block.statistics[0];if(new Set(table.labels).size!==table.labels.length)throw bad();let score=0;
    for(const row of table.athletes){
      if(row.didNotPlay)continue;
      if(!row.stats||row.stats.length!==table.labels.length)throw bad();
      const values=Object.fromEntries(table.labels.map((key,i)=>[key,row.stats![i]]));
      if(!/^\d+(?:\.[0-9]+|:[0-5][0-9])?$/.test(values.MIN||''))throw bad();
      const [fgm,fga]=pair(values.FG),[ftm,fta]=pair(values.FT),[three,threeAttempted]=pair(values['3PT']);
      const stats={pts:count(values.PTS),reb:count(values.REB),ast:count(values.AST),st:count(values.STL),blk:count(values.BLK),to:count(values.TO),fgm,fga,ftm,fta,three,threeAttempted};
      if(three>fgm||threeAttempted>fga||2*fgm+three+ftm!==stats.pts)throw bad();score+=stats.pts;
      players.push({id:row.athlete.id,gameId,name:row.athlete.displayName,chineseName:chineseName(row.athlete.displayName),team:teamName(own.team),teamId:own.team.id,color:/^[0-9a-f]{6}$/i.test(block.team.color||'')?`#${block.team.color}`:'#316dae',jersey:row.athlete.jersey||'',minutes:values.MIN,date,beijingDate:localDate(new Date(game.date)),matchup,result:Number(own.score)>Number(opponent.score)?'胜':'负',stats});
    }
    if(score!==count(String(own.score)))throw bad();
  }
  if(new Set(players.map(p=>p.id)).size!==players.length)throw bad();
  return players;
}
export function getCardDay(date:string):Promise<CardDay> {
  return requestCache.get(`card-day:${date}`,60_000,async()=>{
    const {finished,pending}=parseCardScoreboard(await fetchJson(`${API}/scoreboard?dates=${date.replaceAll('-','')}&limit=100`),date);
    const results=await Promise.allSettled(finished.map(async gameId=>parseCardGame(await fetchJson(`${API}/summary?event=${gameId}`),gameId,date)));
    const players:PlayerGameCard[]=[],warnings:string[]=[];let completedGames=0;
    for(let i=0;i<results.length;i++){const result=results[i];if(result.status==='fulfilled'){players.push(...result.value);completedGames++;}else warnings.push(`场次 ${finished[i]}：${publicError(result.reason).error}`);}
    if(finished.length&&!completedGames)throw new DataError('UPSTREAM',warnings[0]||'比赛数据暂时无法读取。');
    return {date,players:players.sort((a,b)=>b.stats.pts-a.stats.pts||a.name.localeCompare(b.name)),completedGames,pendingGames:pending,warnings,fetchedAt:new Date().toISOString()};
  });
}
