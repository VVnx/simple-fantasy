import type {Briefing} from './briefings';
import {normalize,resolveSearch} from './aliases';
import {NBA_TEAMS} from './schedule';
import {parsePlayerCardLine} from './player-card-paste';
import type {PlayerCardContent} from './player-cards';

export type BriefingGame={key:string;teams:[{name:string;score:number},{name:string;score:number}];headline:string;paragraphs:string[]};
export type BriefingRanking={key:string;rank:number;grade:string;name:string;reason:string;performanceKey?:string};
export type BriefingPerformance=PlayerCardContent&{key:string;line:string;gameKey?:string;rank?:number;grade?:string;reason?:string};
export type BriefingLineupUpdate={key:string;title:string;paragraphs:string[]};
export type StructuredBriefing={
  version:1;date:string;title:string;updatedAt:string;games:BriefingGame[];rankings:BriefingRanking[];
  performances:BriefingPerformance[];lineupUpdates:BriefingLineupUpdate[];notes:{section:string;text:string}[];warnings:string[];
};
type Section='intro'|'games'|'rankings'|'lineup'|'appendix';
const sectionNames:Record<Section,string>={intro:'简报导语',games:'逐场简评',rankings:'每日惊喜球员从夯到拉',lineup:'影响后续阵容的情况',appendix:'惊喜球员表现明细'};
const teams=NBA_TEAMS.map(t=>t.name).sort((a,b)=>b.length-a.length).join('|');
const gameHeading=new RegExp(`^(${teams})\\s*(\\d{1,3})\\s*(?:比|[:：—–-])\\s*(\\d{1,3})\\s*(${teams})(?:\\s*[：:]\\s*(.*))?$`);
const gradeHeading=/^(夯中夯|夯|顶级|顶|人上人|香|NPC|有好有坏|偏拉|拉)\s*(?:——|—|--|-)\s*(.+?)\s*[：:]\s*(.+)$/;
const paragraphs=(lines:string[])=>lines.join('\n').trim().split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
function heading(line:string):Section|undefined{
  const text=line.trim().replace(/^[一二三四五六七八九十\d]+[、.．]\s*/,'');
  if(text==='逐场简评')return 'games';
  if(text==='每日惊喜球员从夯到拉')return 'rankings';
  if(text==='影响后续阵容的情况')return 'lineup';
  if(/^附录[：:]\s*惊喜球员表现明细$/.test(text))return 'appendix';
}
export function hasBriefingStructure(value:StructuredBriefing){return !!(value.games.length||value.rankings.length||value.performances.length||value.lineupUpdates.length);}
export function structureBriefing(briefing:Briefing):StructuredBriefing{
  const result:StructuredBriefing={version:1,date:briefing.date,title:briefing.title,updatedAt:briefing.updatedAt,games:[],rankings:[],performances:[],lineupUpdates:[],notes:[],warnings:[]};
  const sections:Record<Section,string[]>={intro:[],games:[],rankings:[],lineup:[],appendix:[]};
  let section:Section='intro';
  for(const line of briefing.content.replace(/\r\n?/g,'\n').split('\n')){const next=heading(line);if(next){section=next;continue;}sections[section].push(line);}
  const keep=(section:Section,lines:string[])=>{const text=lines.join('\n').trim();if(text)result.notes.push({section:sectionNames[section],text});};
  keep('intro',sections.intro);
  let game:BriefingGame|undefined,body:string[]=[];
  const finishGame=()=>{if(game){game.paragraphs=paragraphs(body);result.games.push(game);}else keep('games',body);body=[];};
  for(const line of sections.games){
    const match=line.trim().match(gameHeading);
    if(match&&match[1]!==match[4]){finishGame();game={key:`game-${result.games.length+1}`,teams:[{name:match[1],score:+match[2]},{name:match[4],score:+match[3]}],headline:match[5]||'',paragraphs:[]};}
    else body.push(line);
  }
  finishGame();
  let ranking:BriefingRanking|undefined;
  for(const line of sections.rankings){
    const match=line.trim().match(gradeHeading);
    if(match){ranking={key:`ranking-${result.rankings.length+1}`,rank:result.rankings.length+1,grade:match[1],name:match[2],reason:match[3]};result.rankings.push(ranking);}
    else if(line.trim()){if(ranking)ranking.reason+=`\n${line.trim()}`;else keep('rankings',[line]);}
  }
  for(const line of sections.appendix.map(s=>s.trim()).filter(Boolean)){
    try{
      const parsed=parsePlayerCardLine(line);
      const key=`${normalize(parsed.team)}:${normalize(parsed.name)}`;
      if(result.performances.some(p=>p.key===key)){result.warnings.push(`${parsed.name} 有重复明细，重复内容保留在原文。`);keep('appendix',[line]);continue;}
      const matches=result.games.filter(g=>g.teams.some(t=>t.name===parsed.team));
      const performance:BriefingPerformance={...parsed,key,line,...(matches.length===1?{gameKey:matches[0].key}:{})};
      result.performances.push(performance);
    }catch(error){result.warnings.push(`一条球员明细保留为原文：${error instanceof Error?error.message:'数据无法识别。'}`);keep('appendix',[line]);}
  }
  for(const row of result.rankings){
    const exact=result.performances.filter(p=>normalize(p.name)===normalize(row.name));
    const found=exact.length?exact:result.performances.filter(p=>normalize(resolveSearch(p.name))===normalize(resolveSearch(row.name)));
    if(found.length===1&&!found[0].grade){const p=found[0];row.performanceKey=p.key;Object.assign(p,{rank:row.rank,grade:row.grade,reason:row.reason});}
    else if(found.length>1||found.length===1)result.warnings.push(`${row.name} 的榜单与表现明细未能唯一对应，已保留原评价。`);
  }
  let update:BriefingLineupUpdate|undefined;body=[];
  const finishUpdate=()=>{if(update){update.paragraphs=paragraphs(body);result.lineupUpdates.push(update);}else keep('lineup',body);body=[];};
  for(const line of sections.lineup){
    const match=line.trim().match(/^\d+[.．、]\s*(.+)$/);
    if(match){finishUpdate();update={key:`lineup-${result.lineupUpdates.length+1}`,title:match[1],paragraphs:[]};}
    else body.push(line);
  }
  finishUpdate();
  return result;
}
export function playerCardLink(player:BriefingPerformance){return `/player-cards?line=${encodeURIComponent(player.line)}`;}
export function gradeTone(grade:string|undefined){
  if(['夯中夯','夯'].includes(grade||''))return 'great';
  if(['顶','顶级','人上人','香'].includes(grade||''))return 'good';
  if(grade==='偏拉')return 'poor';
  if(grade==='拉')return 'bad';
  return 'mixed';
}
