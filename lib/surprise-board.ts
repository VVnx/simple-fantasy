import {normalize,resolveSearch} from './aliases';
import {formatMinutes,type PlayerGameCard} from './player-cards';

export const BOARD_WIDTH=1265,BOARD_HEIGHT=986,BOARD_PADDING=180,BACKGROUND_HEIGHT=626;
export type BoardPlayer=PlayerGameCard&{boardName:string};
export type BoardDay={date:string;players:BoardPlayer[];total:number;warnings:string[];message?:string};
export type Point={x:number;y:number};
export type BoardLayout={positions:Record<string,Point>;size:number;showNames:boolean};
export const emptyBoard=():BoardLayout=>({positions:{},size:112,showNames:true});
export const boardKey=(date:string)=>`fantasy-surprise-board:v1:${date}`;
export function clampPoint(point:Point,size:number):Point{
  return {x:Math.max(size/2,Math.min(BOARD_WIDTH-size/2,point.x)),y:Math.max(size/2,Math.min(BOARD_HEIGHT-size/2,point.y))};
}
export function pointerOnBoard(client:Point,rect:{left:number;top:number;width:number;height:number},offset:Point={x:0,y:0}):Point|null{
  if(!rect.width||!rect.height||client.x<rect.left||client.x>rect.left+rect.width||client.y<rect.top||client.y>rect.top+rect.height)return null;
  return {x:(client.x-rect.left)*BOARD_WIDTH/rect.width-offset.x,y:(client.y-rect.top)*BOARD_HEIGHT/rect.height-offset.y};
}
export function readBoardLayout(raw:string|null,ids:readonly string[]):BoardLayout{
  const fallback=emptyBoard();if(!raw)return fallback;
  try{
    const saved=JSON.parse(raw);if(saved.version!==1||!saved.positions||typeof saved.positions!=='object')return fallback;
    const size=typeof saved.size==='number'&&Number.isFinite(saved.size)?Math.max(72,Math.min(160,saved.size)):112;
    const positions:Record<string,Point>={};
    for(const id of ids){const p=saved.positions[id];if(p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y))positions[id]=clampPoint(p,size);}
    return {positions,size,showNames:typeof saved.showNames==='boolean'?saved.showNames:true};
  }catch{return fallback;}
}
export function matchSurprisePlayers(content:string,players:PlayerGameCard[]){
  const appendix=content.split(/附录[：:]\s*惊喜球员表现明细/)[1];
  if(!appendix)return {players:[] as BoardPlayer[],total:0,warnings:[] as string[]};
  const result:BoardPlayer[]=[],warnings:string[]=[];let total=0;
  for(const line of appendix.split('\n').map(s=>s.trim()).filter(Boolean)){
    const match=line.match(/^(\S+)\s+(.+?)\s+(?:出场(\d+(?:\.\d+)?分钟|\d+分[0-5]\d秒)\s+)?(\d+)分(\d+)板(\d+)助攻(?:\s+(\d+)记三分)?\s+投篮(\d+)投(\d+)中\s+罚球(\d+)\/(\d+)\s+(\d+)抢断(\d+)盖帽(\d+)失误$/);
    if(!match){warnings.push(`有一行惊喜球员明细无法识别：${line.slice(0,45)}`);continue;}
    total++;const [,team,name,minutes,pts,reb,ast,three,fga,fgm,ftm,fta,st,blk,to]=match;
    const query=normalize(resolveSearch(name));
    const found=players.filter(p=>p.team===team&&[normalize(p.name),normalize(p.chineseName||'')].some(n=>n.includes(query)||n===normalize(name)));
    const stats={pts:+pts,reb:+reb,ast:+ast,fga:+fga,fgm:+fgm,ftm:+ftm,fta:+fta,st:+st,blk:+blk,to:+to,...(three===undefined?{}:{three:+three})};
    if(found.length!==1||(minutes!==undefined&&minutes!==formatMinutes(found[0].minutes))||!Object.entries(stats).every(([key,value])=>found[0].stats[key as keyof typeof found[0]['stats']]===value)){
      warnings.push(`${team} ${name} 的比赛记录暂未核对一致，未载入头像。`);continue;
    }
    if(result.some(p=>p.id===found[0].id)){warnings.push(`${name} 的重复条目已合并。`);continue;}
    result.push({...found[0],boardName:name});
  }
  return {players:result,total,warnings};
}
