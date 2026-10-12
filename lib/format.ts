import type { SeasonRow, Totals } from './types';
import { selectionLabel } from './seasons';
export const headers = ['赛季 / 赛事','GP','MIN','FGM / FGA','FG%','FTM / FTA','FT%','3PTM','PTS','REB','AST','ST','BLK','TO','A/T','DD'];
export const decimal = (n: number | null, places = 2) => n === null ? '—' : n.toFixed(places);
export function ratio(made: number | null, attempted: number | null, kind: 'shooting' | 'at' = 'shooting') {
  if (made === null || attempted === null) return '—';
  if (attempted === 0) return '—';
  const value = (made / attempted).toFixed(3);
  return kind === 'shooting' ? value.replace(/^0/, '') : value;
}
export function statCells(t: Totals | null): string[] {
  if (!t) return Array.from({ length: 15 }, () => '—');
  const avg = (x: number | null, places = 2) => decimal(x === null || t.gp === 0 ? null : x / t.gp, places);
  return [String(t.gp),avg(t.min,1),`${avg(t.fgm)}/${avg(t.fga)}`,ratio(t.fgm,t.fga),`${avg(t.ftm)}/${avg(t.fta)}`,ratio(t.ftm,t.fta),avg(t.three),avg(t.pts),avg(t.reb),avg(t.ast),avg(t.st),avg(t.blk),avg(t.to),ratio(t.ast,t.to,'at'),t.dd === null ? '—' : String(t.dd)];
}
export const rowCells = (r: SeasonRow) => [selectionLabel(r), ...statCells(r.totals)];
// Guard against spreadsheet formula injection in names/notes, and quote every cell.
export const csvCell = (value: string) => `"${(/^[=+@-]/.test(value) ? "'" : '') + value.replaceAll('"','""')}"`;
export function createCsv(name: string, rows: SeasonRow[]) {
  const metaHeaders = ['球员','状态','读取时间 UTC','数据截至','来源','备注'];
  const body = rows.map(row => [...rowCells(row),name,row.status,row.fetchedAt,row.dataThrough ?? '上游未提供',row.sources.map(s=>s.url).join(' | '),row.notes.join('；')]);
  return '\uFEFF' + [[...headers,...metaHeaders], ...body].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
