import type { SeasonRow, TableRow, Totals, MinuteConversion, Selection, TableSelection } from './types';
import { seasonLabel, selectionKey, selectionLabel } from './seasons';
export const headers = ['赛季 / 赛事','GP','MIN','FGM / FGA','FG%','FTM / FTA','FT%','3PTM','PTS','REB','AST','ST','BLK','TO','A/T','DD','OREB'];
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
export function comparisonSelections(selections: Selection[], converted?: Selection): TableSelection[] {
  const averageRows: TableSelection[] = selections.flatMap(s=>[
    {...s,mode:'average' as const},
    ...(converted && selectionKey(s)===selectionKey(converted) ? [{...s,mode:'average' as const,converted:true}] : []),
  ]);
  return [...averageRows,...selections.map(s=>({...s,mode:'total' as const}))];
}
export function doubleDoubleCell(t: Totals | null): string {
  if (!t || !Number.isFinite(t.gp) || t.gp <= 0 || t.dd === null || !Number.isFinite(t.dd)) return '—';
  return `${t.dd}（${(t.dd / t.gp * 100).toFixed(1)}%）`;
}
export function statCells(t: Totals | null, options: Pick<TableRow, 'mode' | 'conversion'> = {}): string[] {
  if (!t) return Array.from({ length: headers.length - 1 }, () => '—');
  const total = options.mode === 'total';
  const factor = total ? 1 : options.conversion?.factor ?? 1;
  const count = (x: number | null, places = 2) => decimal(x === null || (!total && t.gp === 0) ? null : total ? x : x / t.gp * factor, total ? 0 : places);
  const minutes = total ? t.min === null ? '—' : String(t.min) : options.conversion ? decimal(options.conversion.targetMinutes,1) : count(t.min,1);
  return [String(t.gp),minutes,`${count(t.fgm)}/${count(t.fga)}`,ratio(t.fgm,t.fga),`${count(t.ftm)}/${count(t.fta)}`,ratio(t.ftm,t.fta),count(t.three),count(t.pts),count(t.reb),count(t.ast),count(t.st),count(t.blk),count(t.to),ratio(t.ast,t.to,'at'),doubleDoubleCell(t),count(t.oreb ?? null)];
}
export const conversionLabel = (r: TableRow) => r.conversion ? `换算至${seasonLabel(r.conversion.year)}场均分钟` : '';

export const tableSelectionLabel = (s: TableSelection) => `${selectionLabel(s)} · ${s.mode==='total'?'总计':s.converted?'换算':'平均'}`;
