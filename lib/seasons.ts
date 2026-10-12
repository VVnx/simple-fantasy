import type { Selection } from './types';
// ESPN uses the ending year: 2026–27 = 2027. July is the season rollover.
export const currentEndYear = (date = new Date()) => date.getUTCFullYear() + (date.getUTCMonth() >= 6 ? 1 : 0);
export const seasonLabel = (endYear: number) => `${endYear - 1}–${String(endYear).slice(-2)}`;
export function defaultSelections(date = new Date()): Selection[] {
  // Conservatively regard regular seasons as complete from May 1, not mid-April.
  const completed = date.getUTCFullYear() - (date.getUTCMonth() >= 4 ? 0 : 1);
  return [{ year: completed - 1, type: 'regular' }, { year: completed, type: 'regular' }, { year: currentEndYear(date), type: 'preseason' }];
}
export const selectionKey = (s: Selection) => `${s.year}-${s.type}`;
export const selectionLabel = (s: Selection) => `${seasonLabel(s.year)} ${s.type === 'regular' ? '常规赛' : '季前赛'}`;
