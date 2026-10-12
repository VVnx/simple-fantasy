import { z } from 'zod';
import { countKeys, type Player, type Selection, type SeasonRow, type Totals } from '../types';
import { seasonLabel, currentEndYear } from '../seasons';
import { chineseName, resolveSearch } from '../aliases';
import { requestCache } from './cache';
import { fetchJson } from './http';
import { DataError } from './errors';
const WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';
const CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';
const numeric = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const shapeError = () => new DataError('SCHEMA','ESPN 数据结构或字段发生变化，无法可靠计算。请稍后重试。');
const ref = z.object({ $ref: z.string() });
const coreSchema = z.object({
  season: ref, seasonType: ref, athlete: ref,
  splits: z.object({ type: z.string(), categories: z.array(z.object({ stats: z.array(z.object({name:z.string(),value:z.unknown().optional()})) })) }),
});
const mapping = { min:'minutes',fgm:'fieldGoalsMade',fga:'fieldGoalsAttempted',ftm:'freeThrowsMade',fta:'freeThrowsAttempted',three:'threePointFieldGoalsMade',pts:'points',reb:'totalRebounds',ast:'assists',st:'steals',blk:'blocks',to:'turnovers' } as const;
export function parseCore(raw: unknown, id: string, selection: Selection): Totals {
  const parsed = coreSchema.safeParse(raw);
  if (!parsed.success) throw shapeError();
  const d = parsed.data;
  // The returned identity is authoritative. Never accept another year/type/athlete.
  const matchesRef = (url: string, path: string) => {
    try { const u = new URL(url); return u.hostname === 'sports.core.api.espn.com' && u.pathname === path; } catch { return false; }
  };
  const base = `/v2/sports/basketball/leagues/nba/seasons/${selection.year}`;
  if (selection.type !== 'regular' || !matchesRef(d.season.$ref,base) || !matchesRef(d.seasonType.$ref,`${base}/types/2`) || !matchesRef(d.athlete.$ref,`${base}/athletes/${id}`) || d.splits.type !== 'total') throw new DataError('MISMATCH','上游返回的球员或赛季不匹配，已停止显示该行。');
  const fields = new Map(d.splits.categories.flatMap(c=>c.stats.map(s=>[s.name,numeric(s.value)] as const)));
  const gp = fields.get('gamesPlayed');
  if (gp === undefined || gp === null || !Number.isInteger(gp)) throw shapeError();
  const totals = { gp, dd: fields.get('doubleDouble') ?? null } as Totals;
  for (const key of countKeys) totals[key] = fields.get(mapping[key]) ?? null;
  validateTotals(totals);
  return totals;
}
function validateTotals(t: Totals) {
  for (const key of [...countKeys,'dd'] as const) if (t[key] !== null && key !== 'min' && !Number.isInteger(t[key])) throw shapeError();
  if ((t.fgm !== null && t.fga !== null && t.fgm > t.fga) || (t.ftm !== null && t.fta !== null && t.ftm > t.fta) || (t.dd !== null && t.dd > t.gp)) throw shapeError();
}
const logSchema = z.object({
  filters: z.array(z.object({name:z.string(),value:z.string()})),
  names: z.array(z.string()),
  events: z.record(z.string(),z.object({gameDate:z.string(),gameResult:z.string().optional(),eventNote:z.string().optional(),team:z.object({isAllStar:z.boolean().optional()}).optional(),opponent:z.object({isAllStar:z.boolean().optional()}).optional()})),
  seasonTypes: z.array(z.object({displayName:z.string(),categories:z.array(z.object({type:z.string(),events:z.array(z.object({eventId:z.string(),stats:z.array(z.string())})).optional()}))})),
});
const parseNumber = (s: string | undefined) => s !== undefined && /^\d+(\.\d+)?$/.test(s) ? numeric(Number(s)) : null;
const parsePair = (s: string | undefined): [number | null, number | null] => {
  const m = s?.match(/^(\d+)-(\d+)$/);
  return m ? [Number(m[1]),Number(m[2])] : [null,null];
};
export function parseGameLog(raw: unknown, selection: Selection): { totals: Totals | null; dataThrough: string | null; notes: string[] } {
  // Observed ESPN no-history shape: only an NBA league filter, no season or stats.
  // Do not treat arbitrary empty/malformed responses as a zero-game season.
  const absent = z.object({filters:z.array(z.object({name:z.string(),value:z.string()}).passthrough())}).strict().safeParse(raw);
  if (absent.success && absent.data.filters.length === 1 && absent.data.filters[0].name === 'league' && absent.data.filters[0].value === 'nba') return {totals:null,dataThrough:null,notes:['ESPN 未收录该球员在所选赛季的 NBA 比赛记录；不将缺失视为 0 场。']};
  const parsed = logSchema.safeParse(raw);
  if (!parsed.success) throw shapeError();
  const d = parsed.data;
  if (d.filters.find(f=>f.name==='season')?.value !== String(selection.year)) throw new DataError('MISMATCH','上游返回了其他赛季，已停止显示该行。');
  const exactName = `${seasonLabel(selection.year).replace('–','-')} ${selection.type === 'preseason' ? 'Preseason' : 'Regular Season'}`;
  const sections = d.seasonTypes.filter(t=>t.displayName.toLowerCase() === exactName.toLowerCase());
  if (!sections.length) return {totals:null,dataThrough:null,notes:['数据源未收录该赛季/赛事的出场记录；不将其视为 0 场。']};
  const games = new Map<string,string[]>();
  for (const section of sections) for (const c of section.categories) if (c.type === 'event') for (const event of c.events ?? []) {
    const previous = games.get(event.eventId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(event.stats)) throw new DataError('MISMATCH','同一场比赛出现冲突记录，无法可靠计算。');
    games.set(event.eventId,event.stats);
  }
  if (!games.size) return {totals:null,dataThrough:null,notes:['该赛事段没有可用的逐场记录。']};
  const totals: Totals = { gp:0,dd:0,min:0,fgm:0,fga:0,ftm:0,fta:0,three:0,pts:0,reb:0,ast:0,st:0,blk:0,to:0 };
  let through: string | null = null;
  const requiredNames = ['minutes','fieldGoalsMade-fieldGoalsAttempted','freeThrowsMade-freeThrowsAttempted','threePointFieldGoalsMade-threePointFieldGoalsAttempted','points','totalRebounds','assists','steals','blocks','turnovers'];
  if (requiredNames.some(name=>!d.names.includes(name))) throw shapeError();
  for (const [id,stats] of games) {
    const event = d.events[id];
    // ESPN can put an All-Star game inside its Regular Season segment (observed
    // for Doncic 2025–26). Cup championship games also do not count as regular.
    if (event && (event.team?.isAllStar || event.opponent?.isAllStar || /all[ -]?star|rising stars/i.test(event.eventNote ?? '') || /(?:nba cup|in-season tournament)\s*-\s*(?:championship|final)$/i.test(event.eventNote ?? ''))) continue;
    // Only completed, played entries. Never infer a DNP from zero minutes/zero points.
    if (!event || !['W','L'].includes(event.gameResult ?? '')) throw shapeError();
    if (stats.length !== d.names.length) throw shapeError();
    const field = (name:string) => stats[d.names.indexOf(name)];
    if (/^(DNP|DND|INACTIVE)/i.test(field('minutes'))) continue;
    const [fgm,fga] = parsePair(field('fieldGoalsMade-fieldGoalsAttempted'));
    const [ftm,fta] = parsePair(field('freeThrowsMade-freeThrowsAttempted'));
    const [three] = parsePair(field('threePointFieldGoalsMade-threePointFieldGoalsAttempted'));
    const row = {min:parseNumber(field('minutes')),fgm,fga,ftm,fta,three,pts:parseNumber(field('points')),reb:parseNumber(field('totalRebounds')),ast:parseNumber(field('assists')),st:parseNumber(field('steals')),blk:parseNumber(field('blocks')),to:parseNumber(field('turnovers'))};
    totals.gp++;
    for (const key of countKeys) totals[key] = totals[key] === null || row[key] === null ? null : totals[key]! + row[key]!;
    const five = [row.pts,row.reb,row.ast,row.st,row.blk];
    totals.dd = totals.dd === null || five.some(n=>n===null) ? null : totals.dd + (five.filter(n=>n!>=10).length >=2 ? 1 : 0);
    if (!Number.isFinite(Date.parse(event.gameDate))) throw shapeError();
    const date = new Date(event.gameDate).toISOString();
    if (!through || date > through) through = date;
  }
  validateTotals(totals);
  return {totals: totals.gp ? totals : null, dataThrough:through, notes:['MIN ≈：ESPN 逐场分钟已舍入为整数，场均分钟为近似值。','仅汇总该赛事段的已完赛出场记录，排除全明星及杯赛决赛；DD 按单场五项基础数据计算，三双也计入。']};
}
const playerSchema = z.object({ uid:z.string(),displayName:z.string(),subtitle:z.string().optional(),defaultLeagueSlug:z.string().optional(),description:z.string().optional() });
export function parseSearch(raw: unknown): Player[] {
  if (raw && typeof raw==='object' && Object.keys(raw).length===0) return [];
  const parsed = z.object({results:z.array(z.object({type:z.string(),contents:z.array(z.unknown()).optional()}))}).safeParse(raw);
  if (!parsed.success) throw shapeError();
  const players = new Map<string,Player>();
  for (const group of parsed.data.results) if (group.type==='player') for (const rawPlayer of group.contents ?? []) {
    const p = playerSchema.safeParse(rawPlayer);
    if (!p.success) throw shapeError();
    const v=p.data, id=v.uid.match(/^s:40~l:46~a:(\d+)$/)?.[1];
    if (!id || (v.defaultLeagueSlug && v.defaultLeagueSlug!=='nba')) continue;
    players.set(id,{id,name:v.displayName,team:v.subtitle ?? '球队信息未提供',chineseName:chineseName(v.displayName)});
  }
  return [...players.values()];
}
export async function searchPlayers(query: string) {
  const resolved = resolveSearch(query);
  return requestCache.get(`search:${resolved.toLowerCase()}`,60*60*1000,async()=>{
    const url = new URL('https://site.web.api.espn.com/apis/search/v2');
    url.search = new URLSearchParams({query:resolved,limit:'50',type:'player'}).toString();
    const players = parseSearch(await fetchJson(url.toString()));
    return { players, resolvedQuery:resolved, fetchedAt:new Date().toISOString(), source:'ESPN Player Search' };
  });
}
export async function loadSeason(id: string, s: Selection): Promise<SeasonRow> {
  const sources = [{label:'ESPN 逐场记录',url:`https://www.espn.com/nba/player/gamelog/_/id/${id}/type/nba/year/${s.year}`}];
  const logUrl = `${WEB}/athletes/${id}/gamelog?season=${s.year}`;
  const base = { ...s, fetchedAt:new Date().toISOString(), dataThrough:null };
  if (s.type==='regular') {
    const coreUrl = `${CORE}/seasons/${s.year}/types/2/athletes/${id}/statistics/0`;
    try {
      const totals = parseCore(await fetchJson(coreUrl),id,s);
      const notes = ['场均由 ESPN 赛季总数计算；GP、DD 保留总数。'];
      if (countKeys.some(k=>totals[k]===null) || totals.dd===null) notes.push('上游部分字段缺失，对应单元格显示 —。');
      return {...base,fetchedAt:new Date().toISOString(),status:'ok',totals,sources:[{label:'ESPN 赛季总数 JSON',url:coreUrl},...sources],notes,minutePrecision:'season-total'};
    } catch(error) {
      // A 404 can be absence of a season aggregate, not zero GP; inspect the log.
      if (!(error instanceof DataError) || error.code!=='NOT_FOUND') throw error;
    }
  }
  const log = parseGameLog(await fetchJson(logUrl),s);
  return {...base,fetchedAt:new Date().toISOString(),...log,status:log.totals?'ok':'unavailable',sources:[...sources,{label:'ESPN 逐场 JSON',url:logUrl}],minutePrecision:'rounded-game-minutes'};
}
export function getSeason(id: string, s: Selection) {
  const historical = s.type==='regular' && s.year < currentEndYear();
  return requestCache.get(`season:${id}:${s.year}:${s.type}`,historical?6*60*60*1000:5*60*1000,()=>loadSeason(id,s));
}
