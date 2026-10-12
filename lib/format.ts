import type { SeasonRow, TableRow, Totals, MinuteConversion, Selection, TableSelection } from './types';
import { selectionLabel, seasonLabel, selectionKey } from './seasons';
export const headers = ['赛季 / 赛事','GP','MIN','FGM / FGA','FG%','FTM / FTA','FT%','3PTM','PTS','REB','AST','ST','BLK','TO','A/T','DD'];
export const decimal = (n: number | null, places = 2) => n === null ? '—' : n.toFixed(places);
export function ratio(made: number | null, attempted: number | null, kind: 'shooting' | 'at' = 'shooting') {
  if (made === null || attempted === null) return '—';
  if (attempted === 0) return '—';
  const value = (made / attempted).toFixed(3);
  return kind === 'shooting' ? value.replace(/^0/, '') : value;
}
export function averageMinutes(row?: SeasonRow): number | null {
  const t = row?.status === 'ok' ? row.totals : null;
  if (!t || t.gp <= 0 || t.min === null || !Number.isFinite(t.min) || t.min <= 0) return null;
  return t.min / t.gp;
}
export function minuteConversion(source: SeasonRow | undefined, target: SeasonRow | undefined): MinuteConversion | undefined {
  const sourceMinutes = averageMinutes(source), targetMinutes = averageMinutes(target);
  if (!source || !target || source.type !== 'preseason' || target.type !== 'regular' || target.year >= source.year || sourceMinutes === null || targetMinutes === null) return undefined;
  const factor = targetMinutes / sourceMinutes;
  return Number.isFinite(factor) && factor > 0 ? {year:target.year, factor, sourceMinutes, targetMinutes} : undefined;
}
export function comparisonSelections(selections: Selection[], history: Selection[], converted?: Selection): TableSelection[] {
  const averageRows: TableSelection[] = selections.flatMap(s=>[
    {...s,mode:'average' as const},
    ...(converted && selectionKey(s)===selectionKey(converted) ? [{...s,mode:'average' as const,converted:true}] : []),
  ]);
  return [...averageRows,...history.map(s=>({...s,mode:'total' as const}))];
}
export function doubleDoubleCell(t: Totals | null): string {
  if (!t || !Number.isFinite(t.gp) || t.gp <= 0 || t.dd === null || !Number.isFinite(t.dd)) return '—';
  return `${t.dd}（${(t.dd / t.gp * 100).toFixed(1)}%）`;
}
export function statCells(t: Totals | null, options: Pick<TableRow, 'mode' | 'conversion'> = {}): string[] {
  if (!t) return Array.from({ length: 15 }, () => '—');
  const total = options.mode === 'total';
  const factor = total ? 1 : options.conversion?.factor ?? 1;
  const count = (x: number | null, places = 2) => decimal(x === null || (!total && t.gp === 0) ? null : total ? x : x / t.gp * factor, total ? 0 : places);
  const minutes = total ? t.min === null ? '—' : String(t.min) : options.conversion ? decimal(options.conversion.targetMinutes,1) : count(t.min,1);
  return [String(t.gp),minutes,`${count(t.fgm)}/${count(t.fga)}`,ratio(t.fgm,t.fga),`${count(t.ftm)}/${count(t.fta)}`,ratio(t.ftm,t.fta),count(t.three),count(t.pts),count(t.reb),count(t.ast),count(t.st),count(t.blk),count(t.to),ratio(t.ast,t.to,'at'),doubleDoubleCell(t)];
}
export const conversionLabel = (r: TableRow) => r.conversion ? `换算至${seasonLabel(r.conversion.year)}场均分钟` : '';
export const rowLabel = (r: TableRow) => selectionLabel(r) + (r.mode === 'total' ? ' · 总计' : r.conversion ? `（${conversionLabel(r)}）` : '');
export const rowNotes = (r: TableRow) => [...r.notes, 'DD 显示两双次数（两双场次占比）；占比 = DD / GP × 100%，换算行沿用实际样本。', ...(r.mode === 'total' ? ['总计行使用原始赛季总数；MIN 为总分钟，非场均。'] : []), ...(r.conversion ? [`${conversionLabel(r)}：目标场均分钟 / 季前赛原始场均分钟 = ${r.conversion.targetMinutes} / ${r.conversion.sourceMinutes}；仅等比例换算计数，不代表真实表现或预测；GP、DD、FG%、FT%、A/T 保留原值。`] : [])];
export const rowCells = (r: TableRow) => {
  const cells = [rowLabel(r), ...statCells(r.totals,r)];
  if (r.minutePrecision === 'rounded-game-minutes' && r.totals) cells[2] += ' ≈';
  return cells;
};
// Guard against spreadsheet formula injection in names/notes, and quote every cell.
export const csvCell = (value: string) => `"${(/^[=+@-]/.test(value) ? "'" : '') + value.replaceAll('"','""')}"`;
export function createCsv(name: string, rows: TableRow[]) {
  const metaHeaders = ['球员','工具','状态','读取时间 UTC','数据截至','来源','备注'];
  const body = rows.map(row => [...rowCells(row),name,'Fantasy Timeline',row.status,row.fetchedAt,row.dataThrough ?? '上游未提供',row.sources.map(s=>s.url).join(' | '),rowNotes(row).join('；')]);
  return '\uFEFF' + [[...headers,...metaHeaders], ...body].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
