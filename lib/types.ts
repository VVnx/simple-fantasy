export type SeasonType = 'regular' | 'preseason';
export type Selection = { year: number; type: SeasonType };
export type Player = { id: string; name: string; team: string; position?: string; chineseName?: string };
export const countKeys = ['min','fgm','fga','ftm','fta','three','pts','reb','ast','st','blk','to'] as const;
export type CountKey = typeof countKeys[number];
export type Totals = Record<CountKey, number | null> & { gp: number; dd: number | null };
export type Source = { label: string; url: string };
export type SeasonRow = Selection & {
  status: 'ok' | 'unavailable'; totals: Totals | null; fetchedAt: string;
  dataThrough: string | null; sources: Source[]; notes: string[];
  minutePrecision: 'season-total' | 'rounded-game-minutes';
};
export type RowResult = { row?: SeasonRow; error?: string; code?: string };
