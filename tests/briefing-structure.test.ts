import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {structureBriefing,hasBriefingStructure,playerCardLink} from '../lib/briefing-structure';
import {parsePlayerCardLine} from '../lib/player-card-paste';
import type {Briefing} from '../lib/briefings';
const article=JSON.parse(readFileSync(new URL('./fixtures/briefing-2026-10-21.json',import.meta.url),'utf8')).briefing as Briefing;
const parse=(content:string)=>structureBriefing({...article,content});
describe('structured published briefing',()=>{
  it('extracts every match, ranked player and lineup update without losing commentary',()=>{
    const value=structureBriefing(article);
    expect(value.games).toHaveLength(3);expect(value.rankings).toHaveLength(18);expect(value.performances).toHaveLength(18);expect(value.lineupUpdates).toHaveLength(11);
    expect(value.warnings).toEqual([]);expect(value.notes).toEqual([]);
    expect(value.games.map(g=>g.teams.map(t=>[t.name,t.score]))).toEqual([[['活塞',121],['凯尔特人',113]],[['76人',106],['尼克斯',100]],[['雷霆',116],['马刺',104]]]);
    expect(value.games.every(g=>g.paragraphs.length===2)).toBe(true);
    expect(value.rankings.every(r=>r.performanceKey)).toBe(true);
    for(const game of value.games)for(const p of game.paragraphs)expect(article.content).toContain(p);
    for(const update of value.lineupUpdates)for(const p of update.paragraphs)expect(article.content).toContain(p);
    expect(value.lineupUpdates[10].title).toBe('阿夫迪亚、蒙克仍待定，西蒙斯已经手术');
  });
  it('connects scores, teams, grades, reasons and complete stat lines without inferring missing attempts',()=>{
    const value=structureBriefing(article),george=value.performances[0],last=value.performances.at(-1)!;
    expect(george).toMatchObject({name:'乔治',team:'凯尔特人',gameKey:'game-1',rank:1,grade:'夯',minutes:'31',stats:{pts:38,reb:5,ast:3,three:7,blk:0}});
    expect(george.stats.threeAttempted).toBeUndefined();expect(george).not.toHaveProperty('date');
    expect(last).toMatchObject({name:'大桥',gameKey:'game-2',rank:18,grade:'拉',stats:{three:0,st:0,to:0}});
    expect(george.reason).toBe(value.rankings[0].reason);
    expect(value.games.map(g=>value.performances.filter(p=>p.gameKey===g.key).length)).toEqual([5,6,7]);
    const line=new URL(playerCardLink(george),'https://example.test').searchParams.get('line')!;
    expect(parsePlayerCardLine(line).stats).toEqual(george.stats);expect(line).toBe(george.line);
  });
  it('keeps old, no-game and unfamiliar text readable and never invents games',()=>{
    const old=parse('旧版简报\n\n伤病消息。');expect(hasBriefingStructure(old)).toBe(false);expect(old.notes[0].text).toBe('旧版简报\n\n伤病消息。');
    const idle=parse('一、逐场简评\n\n今天没有比赛。\n\n二、每日惊喜球员从夯到拉\n\n没有惊喜球员。\n\n三、影响后续阵容的情况\n\n1. 球员仍待定\n\n若缺席，替补有机会。');
    expect(idle.games).toEqual([]);expect(idle.performances).toEqual([]);expect(idle.lineupUpdates[0].paragraphs).toEqual(['若缺席，替补有机会。']);expect(idle.notes).toHaveLength(2);
  });
  it('retains invalid/duplicate lines and does not manufacture zero stats or force ambiguous game links',()=>{
    const value=parse(article.content.replace('38分5板3助攻','39分5板3助攻'));
    expect(value.performances).toHaveLength(17);expect(value.rankings[0].performanceKey).toBeUndefined();expect(value.notes[0].text).toContain('39分5板3助攻');expect(value.warnings).toHaveLength(1);
    const duplicate=parse(article.content+'\n'+structureBriefing(article).performances[0].line);
    expect(duplicate.performances).toHaveLength(18);expect(duplicate.warnings).toHaveLength(1);
    const repeated=parse(article.content.replace('二、每日惊喜球员从夯到拉','凯尔特人90比80湖人：另一场\n\n文字。\n\n二、每日惊喜球员从夯到拉'));
    expect(repeated.performances[0].gameKey).toBeUndefined();
  });
  it('accepts whitespace and CRLF without changing text content or grade order',()=>{
    const value=parse(article.content.replace('活塞121比113凯尔特人','活塞 121 - 113 凯尔特人').replaceAll('\n','\r\n'));
    expect(value.games[0].teams[0]).toEqual({name:'活塞',score:121});
    expect(value.rankings.map(r=>r.grade)).toEqual(['夯','夯','夯','顶','顶','顶','香','香','香','有好有坏','有好有坏','偏拉','偏拉','偏拉','偏拉','拉','拉','拉']);
  });
});
