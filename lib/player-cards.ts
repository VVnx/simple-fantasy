export type CardStats = {pts:number;reb:number;ast:number;fgm:number;fga:number;ftm:number;fta:number;three:number;threeAttempted:number;st:number;blk:number;to:number};
export type PlayerGameCard = {
  id:string; gameId:string; name:string; chineseName?:string; team:string; teamId:string;
  color:string; jersey:string; minutes:string; date:string; beijingDate:string;
  matchup:string; result:string; stats:CardStats;
};
export type CardDay = {date:string;players:PlayerGameCard[];completedGames:number;pendingGames:number;warnings:string[];fetchedAt:string};
export const CARD_WIDTH=1080;
export const CARD_HEIGHT=1350;
export function cardStatLine(player:PlayerGameCard,name=player.chineseName||player.name) {
  const s=player.stats;
  return `${player.team} ${name} ${s.pts}分${s.reb}板${s.ast}助攻 ${s.three}记三分 投篮${s.fga}投${s.fgm}中 罚球${s.ftm}/${s.fta} ${s.st}抢断${s.blk}盖帽${s.to}失误`;
}
export function cardFilename(player:PlayerGameCard) {return `NBA-Fantasy-${player.date}-${player.name.replace(/[^a-zA-Z0-9 -]/g,'').replace(/\s+/g,'-')}.png`;}
export function localDate(date:Date,timeZone='Asia/Shanghai') {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(key=>parts.find(part=>part.type===key)!.value).join('-');
}
