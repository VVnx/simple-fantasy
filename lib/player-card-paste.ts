import {normalize,resolveSearch} from './aliases';
import type {Player} from './types';
import type {PlayerCardContent} from './player-cards';

export const CARD_PASTE_EXAMPLE='凯尔特人 乔治 出场31分钟 38分5板3助攻 7记三分 投篮21投12中 罚球7/8 5抢断0盖帽3失误';

/** Parse only supplied values. Unknown, duplicate and missing fields are errors. */
export function parsePlayerCardLine(input:string):PlayerCardContent {
  if(!input.trim()||input.length>1000)throw new Error('请粘贴一名球员的一行数据（最多 1000 字）。');
  const line=input.normalize('NFKC').trim().replace(/^[-•]\s+/,'').replace(/\*\*/g,'');
  const start=line.search(/出场|上场|\d+(?:\.\d+)?(?:分钟|分|板|篮板|助攻|记三分)|投篮|罚球|三分/);
  const identity=start>0?line.slice(0,start).trim().replace(/[，,;；:：]+$/,'').trim():'';
  const names=identity.match(/^(\S+)\s+(.+)$/);
  if(!names||names[1].length>30||names[2].length>60)throw new Error('请在开头写「球队 球员」，中间用空格分隔。');
  let rest=line.slice(start).replace(/\s+/g,' ');
  const take=(pattern:RegExp,label:string)=>{
    const match=rest.match(pattern);
    if(!match)throw new Error(`缺少或无法识别${label}，请参照示例补全；没有的数据请明确写 0。`);
    rest=rest.replace(match[0],' ');
    return match;
  };
  const min=take(/(?:(?:出场(?:时间)?|上场)[:：]?)?(?:(\d+(?:\.\d+)?)分钟|(\d+)分([0-5]?\d)秒)|(?:出场(?:时间)?|上场)[:：]?(\d+:[0-5]\d)(?:分钟)?/,'出场时间');
  const minutes=min[1]??(min[2]?`${min[2]}:${min[3].padStart(2,'0')}`:min[4]);
  const pts=Number(take(/(\d+)分/,'得分')[1]);
  const reb=Number(take(/(\d+)(?:篮板|板)/,'篮板')[1]);
  const ast=Number(take(/(\d+)助攻/,'助攻')[1]);
  const threes=take(/(\d+)(?:记|个)三分|三分(?:(\d+)投(\d+)中|(\d+)(?:\/(\d+))?)/,'三分（如「3记三分」）');
  const three=Number(threes[1]??threes[3]??threes[4]);
  const threeAttempted=threes[2]!==undefined?Number(threes[2]):threes[5]!==undefined?Number(threes[5]):undefined;
  const fg=take(/投篮(?:(\d+)投(\d+)中|(\d+)\/(\d+))/,'投篮（如「21投12中」）');
  const fgm=Number(fg[2]??fg[3]),fga=Number(fg[1]??fg[4]);
  const ft=take(/罚球(?:(\d+)投(\d+)中|(\d+)\/(\d+))/,'罚球（如「7/8」）');
  const ftm=Number(ft[2]??ft[3]),fta=Number(ft[1]??ft[4]);
  const st=Number(take(/(\d+)抢断/,'抢断')[1]);
  const blk=Number(take(/(\d+)(?:盖帽|封盖)/,'盖帽')[1]);
  const to=Number(take(/(\d+)失误/,'失误')[1]);
  if(rest.replace(/[\s,，;；。|]/g,''))throw new Error('有重复或未识别的内容，请只保留一名球员的数据并参照示例格式。');
  const stats={pts,reb,ast,three,threeAttempted,fgm,fga,ftm,fta,st,blk,to};
  if(Object.values(stats).some(v=>v!==undefined&&(!Number.isSafeInteger(v)||v<0||v>999))||Number(minutes.split(':')[0])>99)throw new Error('数据超出单场范围，请检查数字。');
  if(fgm>fga||ftm>fta||three>fgm||(threeAttempted!==undefined&&(three>threeAttempted||threeAttempted>fga||fgm-three>fga-threeAttempted)))throw new Error('命中数不能大于出手数，三分也必须包含在投篮数据内。');
  if(pts!==2*fgm+three+ftm)throw new Error(`得分与投篮不一致：按投篮、三分和罚球应为 ${2*fgm+three+ftm} 分，请检查后再生成。`);
  return {name:names[2],team:names[1],color:'#315e70',minutes,stats};
}

export function matchingPortrait(players:Player[],name:string):Player|undefined {
  const query=normalize(resolveSearch(name));
  const exact=players.filter(p=>normalize(p.name)===query||normalize(p.chineseName||'')===normalize(name));
  // Shared surnames must be selected explicitly, even if the first hit is famous.
  return exact.length===1?exact[0]:players.length===1?players[0]:undefined;
}
