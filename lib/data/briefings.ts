import { getDb } from '@/db';
import type { Briefing, BriefingList, BriefingView } from '@/lib/briefings';

const fields = 'date, title, content, created_at AS createdAt, updated_at AS updatedAt';

export async function getBriefingIndex(): Promise<Pick<Briefing, 'date' | 'updatedAt'>[]> {
  const {results} = await getDb().prepare('SELECT date, updated_at AS updatedAt FROM daily_briefings ORDER BY date DESC')
    .all<Pick<Briefing, 'date' | 'updatedAt'>>();
  return results;
}

export async function getBriefingList(before?: string): Promise<BriefingList> {
  const db = getDb();
  const query = before
    ? db.prepare('SELECT date, title FROM daily_briefings WHERE date < ? ORDER BY date DESC LIMIT 31').bind(before)
    : db.prepare('SELECT date, title FROM daily_briefings ORDER BY date DESC LIMIT 31');
  const {results} = await query.all<BriefingList['items'][number]>();
  const items = results.slice(0, 30);
  return {items, nextBefore:results.length > 30 ? items[items.length - 1].date : null};
}

export async function getBriefingView(date?: string): Promise<BriefingView> {
  const db = getDb();
  const briefing = await (date
    ? db.prepare(`SELECT ${fields} FROM daily_briefings WHERE date = ?`).bind(date)
    : db.prepare(`SELECT ${fields} FROM daily_briefings ORDER BY date DESC LIMIT 1`)
  ).first<Briefing>();
  const selectedDate = date ?? briefing?.date;
  if (!selectedDate) return {briefing:null, previousDate:null, nextDate:null};
  const [previous, next] = await db.batch<{date:string}>([
    db.prepare('SELECT date FROM daily_briefings WHERE date < ? ORDER BY date DESC LIMIT 1').bind(selectedDate),
    db.prepare('SELECT date FROM daily_briefings WHERE date > ? ORDER BY date ASC LIMIT 1').bind(selectedDate),
  ]);
  return {briefing, previousDate:previous.results[0]?.date ?? null, nextDate:next.results[0]?.date ?? null};
}

export async function saveBriefing(date: string, title: string, content: string): Promise<Briefing> {
  const now = new Date().toISOString();
  // The primary key makes concurrent/retried writes one entry per date.
  const row = await getDb().prepare(`
    INSERT INTO daily_briefings (date, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      updated_at = CASE WHEN title = excluded.title AND content = excluded.content
        THEN updated_at ELSE excluded.updated_at END,
      title = excluded.title, content = excluded.content
    RETURNING ${fields}
  `).bind(date, title, content, now, now).first<Briefing>();
  if (!row) throw new Error('Briefing write returned no row');
  return row;
}
