import { getBriefingEnv } from '@/lib/briefing-runtime';
import { BriefingError } from '@/lib/briefings';

export function getDb(): D1Database {
  const db = getBriefingEnv().DB;
  if (!db) throw new BriefingError('简报暂时无法读取，请稍后重试。', 503);
  return db;
}
