import { z } from 'zod';
import { addDays, easternDate, NBA_TEAMS, type ScheduleGame, type ScheduleType, type WeekSchedule } from '../schedule';
import { fetchJson } from './http';
import { requestCache } from './cache';
import { DataError } from './errors';

const statusSchema=z.object({type:z.object({name:z.string(),state:z.enum(['pre','in','post']),completed:z.boolean()})});
const eventSchema=z.object({
  id:z.string(),date:z.string(),season:z.object({type:z.number()}),status:statusSchema,
  competitions:z.array(z.object({
    date:z.string(),timeValid:z.boolean().optional(),neutralSite:z.boolean().optional(),
    notes:z.array(z.object({headline:z.string().optional()})).optional(),
    competitors:z.array(z.object({homeAway:z.enum(['home','away']),team:z.object({id:z.string(),displayName:z.string()})})),
  })).length(1),
});
const boardSchema=z.object({leagues:z.array(z.object({slug:z.string()})),events:z.array(eventSchema)});
const schemaError=()=>new DataError('SCHEMA','赛程数据结构发生变化，暂时无法可靠显示，请稍后重试。');
const types:Record<number,ScheduleType|undefined>={1:'preseason',2:'regular',3:'playoffs'};
const knownTeams=new Map(NBA_TEAMS.map(team=>[team.id,team]));

export function parseScoreboard(raw:unknown,requestedDate:string):ScheduleGame[] {
  const result=boardSchema.safeParse(raw);
  if(!result.success)throw schemaError();
  if(!result.data.leagues.some(league=>league.slug==='nba'))throw schemaError();
  const games:ScheduleGame[]=[];
  for(const event of result.data.events){
    const competition=event.competitions[0],type=types[event.season.type];
    if(!type)continue; // Summer League and All-Star events are not fantasy league games.
    const note=competition.notes?.map(n=>n.headline??'').join(' ')??'';
    if(/all[ -]?star|rising stars|(?:nba cup|in-season tournament)\s*[-–:]?\s*(?:championship|final)\b/i.test(note))continue;
    const home=competition.competitors.find(team=>team.homeAway==='home')?.team;
    const away=competition.competitors.find(team=>team.homeAway==='away')?.team;
    if(!home||!away||home.id===away.id||competition.competitors.length!==2)throw schemaError();
    if(!knownTeams.has(home.id)&&!knownTeams.has(away.id))continue;
    const instant=new Date(competition.date);
    if(!Number.isFinite(instant.getTime()))throw schemaError();
    // ESPN daily scoreboards group by Eastern game date; timeValid=false is only a date placeholder.
    const date=competition.timeValid===false?requestedDate:easternDate(instant);
    if(date!==requestedDate)throw new DataError('MISMATCH','数据源返回了其他日期的赛程，请稍后重试。');
    const state=event.status.type;
    const status:ScheduleGame['status']=/POSTPONED|SUSPENDED|DELAYED/i.test(state.name)?'postponed':/CANCEL/i.test(state.name)?'canceled':state.completed?'final':state.state==='in'?'live':'scheduled';
    games.push({id:event.id,date,tipoff:instant.toISOString(),timeKnown:competition.timeValid!==false,
      homeId:home.id,awayId:away.id,homeName:knownTeams.get(home.id)?.name??home.displayName,awayName:knownTeams.get(away.id)?.name??away.displayName,
      type,neutral:competition.neutralSite??false,status,
    });
  }
  return games;
}
export async function getWeekSchedule(weekStart:string):Promise<WeekSchedule>{
  // Fetch adjacent days too: Sunday/Monday back-to-backs must not disappear at a week boundary.
  const dates=Array.from({length:9},(_,i)=>addDays(weekStart,i-1));
  const daily=await Promise.all(dates.map(date=>requestCache.get(`schedule:${date}`,300_000,async()=>{
    const raw=await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date.replaceAll('-','')}`);
    return {games:parseScoreboard(raw,date),fetchedAt:new Date().toISOString()};
  })));
  const unique=new Map<string,ScheduleGame>();
  for(const day of daily)for(const game of day.games){
    const existing=unique.get(game.id);
    if(existing&&JSON.stringify(existing)!==JSON.stringify(game))throw schemaError();
    unique.set(game.id,game);
  }
  return {weekStart,games:[...unique.values()].sort((a,b)=>a.tipoff.localeCompare(b.tipoff)),fetchedAt:daily.map(day=>day.fetchedAt).sort()[0],source:'ESPN'};
}
