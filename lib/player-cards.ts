export type CardStats = {pts:number;reb:number;ast:number;fgm:number;fga:number;ftm:number;fta:number;three:number;threeAttempted:number;st:number;blk:number;to:number};
export type PlayerGameCard = {
  id:string; gameId:string; name:string; chineseName?:string; team:string; teamId:string;
  color:string; jersey:string; minutes:string; date:string; beijingDate:string;
  matchup:string; result:string; stats:CardStats;
};
export type CardDay = {date:string;players:PlayerGameCard[];completedGames:number;pendingGames:number;warnings:string[];fetchedAt:string};
// Pasted lines need no game/date and may specify made threes without attempts.
export type PlayerCardContent = Pick<PlayerGameCard,'name'|'chineseName'|'team'|'color'|'minutes'> & {
  id?:string;date?:string;gameId?:string;
  stats:Omit<CardStats,'threeAttempted'> & {threeAttempted?:number};
};
export const CARD_WIDTH=2400;
export const CARD_HEIGHT=280;
export function formatMinutes(minutes:string){
  const clock=minutes.match(/^(\d+):([0-5]\d)$/);
  return clock?`${clock[1]}分${clock[2]}秒`:`${minutes}分钟`;
}
export function cardStatLine(player:PlayerCardContent,name=player.chineseName||player.name) {
  const s=player.stats;
  return `${player.team} ${name} 出场${formatMinutes(player.minutes)} ${s.pts}分${s.reb}板${s.ast}助攻 ${s.three}记三分 投篮${s.fga}投${s.fgm}中 罚球${s.ftm}/${s.fta} ${s.st}抢断${s.blk}盖帽${s.to}失误`;
}
export function cardFilename(player:PlayerCardContent) {return `NBA-Fantasy-${player.date?`${player.date}-`:''}${player.name.replace(/[^\p{L}\p{N} -]/gu,'').replace(/\s+/g,'-')||'player'}.png`;}
export function localDate(date:Date,timeZone='Asia/Shanghai') {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(key=>parts.find(part=>part.type===key)!.value).join('-');
}
