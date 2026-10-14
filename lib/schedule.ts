// All grid dates use NBA game days in America/New_York, independent of the viewer's timezone.
export const GAME_TIMEZONE = 'America/New_York';
export const NBA_TEAMS = [
  ['1','ATL','老鹰','东部'],['2','BOS','凯尔特人','东部'],['17','BKN','篮网','东部'],
  ['30','CHA','黄蜂','东部'],['4','CHI','公牛','东部'],['5','CLE','骑士','东部'],
  ['6','DAL','独行侠','西部'],['7','DEN','掘金','西部'],['8','DET','活塞','东部'],
  ['9','GSW','勇士','西部'],['10','HOU','火箭','西部'],['11','IND','步行者','东部'],
  ['12','LAC','快船','西部'],['13','LAL','湖人','西部'],['29','MEM','灰熊','西部'],
  ['14','MIA','热火','东部'],['15','MIL','雄鹿','东部'],['16','MIN','森林狼','西部'],
  ['3','NOP','鹈鹕','西部'],['18','NYK','尼克斯','东部'],['25','OKC','雷霆','西部'],
  ['19','ORL','魔术','东部'],['20','PHI','76人','东部'],['21','PHX','太阳','西部'],
  ['22','POR','开拓者','西部'],['23','SAC','国王','西部'],['24','SAS','马刺','西部'],
  ['28','TOR','猛龙','东部'],['26','UTA','爵士','西部'],['27','WAS','奇才','东部'],
].map(([id,abbreviation,name,conference])=>({id,abbreviation,name,conference}));
export type ScheduleType = 'regular' | 'preseason' | 'playoffs';
export const SCHEDULE_TYPES: Record<ScheduleType,string> = {regular:'常规赛',preseason:'季前赛',playoffs:'季后赛'};
export type ScheduleGame = {
  id:string; date:string; tipoff:string; timeKnown:boolean; homeId:string; awayId:string;
  homeName:string; awayName:string; type:ScheduleType; neutral:boolean;
  status:'scheduled'|'live'|'final'|'postponed'|'canceled';
};
export type WeekSchedule = {weekStart:string; games:ScheduleGame[]; fetchedAt:string; source:string};
export type TeamGame = ScheduleGame & {opponent:string; home:boolean; backToBack:boolean; available:boolean};
export type ScheduleRow = {
  team:typeof NBA_TEAMS[number]; days:TeamGame[][]; total:number; remaining:number; nextTwo:number;
  pairs:{start:string;end:string;available:boolean}[];
};
export function easternDate(instant:Date) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:GAME_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);
  const part=(key:string)=>parts.find(p=>p.type===key)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validDate(date:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0,10)===date;
}
export function addDays(date:string, count:number) {
  const value=new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate()+count);
  return value.toISOString().slice(0,10);
}
export function mondayOf(date:string) {
  const day=new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date,-((day+6)%7));
}
export function weekDays(weekStart:string) {return Array.from({length:7},(_,i)=>addDays(weekStart,i));}
export function shortDate(date:string) {return `${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`;}
export function weekday(date:string) {return ['周日','周一','周二','周三','周四','周五','周六'][new Date(`${date}T12:00:00Z`).getUTCDay()];}
export function countsAsGame(game:ScheduleGame) {return game.status!=='postponed'&&game.status!=='canceled';}
export function isAvailable(game:ScheduleGame,from:string,now:Date) {
  return game.date>=from && game.status==='scheduled' && (game.timeKnown ? Date.parse(game.tipoff)>now.getTime() : game.date>=easternDate(now));
}
export function buildScheduleRows(data:WeekSchedule,type:ScheduleType,from:string,now:Date):ScheduleRow[] {
  const dates=weekDays(data.weekStart), end=dates[6];
  const games=data.games.filter(game=>game.type===type);
  return NBA_TEAMS.map(team=>{
    const teamGames=games.filter(game=>game.homeId===team.id||game.awayId===team.id);
    const counted=teamGames.filter(countsAsGame);
    const playedDates=new Set(counted.map(game=>game.date));
    const pairs=[...playedDates].sort().filter(date=>playedDates.has(addDays(date,1))&&date<=end&&addDays(date,1)>=data.weekStart).map(start=>({
      start,end:addDays(start,1),available:[start,addDays(start,1)].every(date=>counted.some(game=>game.date===date&&isAvailable(game,from,now))),
    }));
    const inWeek=counted.filter(game=>game.date>=data.weekStart&&game.date<=end);
    return {
      team,total:inWeek.length,remaining:inWeek.filter(game=>isAvailable(game,from,now)).length,
      nextTwo:inWeek.filter(game=>game.date<=addDays(from,1)&&isAvailable(game,from,now)).length,
      pairs,
      days:dates.map(date=>teamGames.filter(game=>game.date===date).map(game=>({
        ...game,home:game.homeId===team.id,opponent:game.homeId===team.id?game.awayName:game.homeName,
        backToBack:countsAsGame(game)&&pairs.some(pair=>pair.start===date||pair.end===date),available:isAvailable(game,from,now),
      }))),
    };
  });
}
