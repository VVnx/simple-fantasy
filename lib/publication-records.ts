export const STATUS_LABELS = {
  published: '已发表',
  unconfirmed: '发表待确认',
  ready: '已整理待发',
  draft: '初稿待安排',
} as const;
export type Status = keyof typeof STATUS_LABELS;
export type Team = {
  id: string;
  name: string;
  short: string;
  english: string;
  conference: string;
  status: string;
  publishedAt: string;
  title: string;
  url: string;
  note: string;
  source: string;
  draftPlan?: {
    image: string;
    width: number;
    height: number;
    batch: number;
    receivedAt: string;
  };
  startingFive?: {
    players: { PG: string; SG: string; SF: string; PF: string; C: string };
    image: string;
    width: number;
    height: number;
    receivedAt: string;
    note?: string;
  };
};
export const STORAGE_KEY = 'yahoo-fantasy-publications:2026-27:v1';
export const SEASON = '2026–27';
export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && Object.hasOwn(STATUS_LABELS, value);
}
export function validateDate(value: string): string {
  if (!value) return '';
  // Always store Beijing time, including when the user's device is in another zone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\+08:00)?$/.test(value))
    throw new Error('日期需包含有效日期与时间（北京时间）。');
  const local = value.replace(/\+08:00$/, '');
  const canonical = `${local.length === 16 ? `${local}:00` : local}+08:00`;
  const ms = Date.parse(canonical);
  if (
    !Number.isFinite(ms) ||
    new Date(ms + 8 * 3600000).toISOString().slice(0, 19) !==
      canonical.slice(0, 19)
  )
    throw new Error('日期不存在，请重新填写。');
  if (ms > Date.now())
    throw new Error('发表时间不能在未来；计划发表请使用待发状态。');
  return canonical;
}
export function validateUrl(value: string): string {
  const text = value.trim();
  if (!text) return '';
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error('请填写完整的微信公众号文章链接。');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'mp.weixin.qq.com' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443')
  ) {
    throw new Error('文章链接需为 https://mp.weixin.qq.com/ 开头的微信链接。');
  }
  return text;
}
function field(value: unknown, label: string, limit = 2000): string {
  if (typeof value !== 'string' || value.length > limit)
    throw new Error(`${label}格式不正确或过长。`);
  return value.trim();
}
export function validateTeam(input: unknown, canonical: Team): Team {
  if (!input || typeof input !== 'object')
    throw new Error('球队记录格式不正确。');
  const t = input as Record<string, unknown>;
  if (t.id !== canonical.id || !isStatus(t.status))
    throw new Error('球队或发表状态无效。');
  // Attached plans are the owner's explicit publication confirmation. Old local
  // backups cannot hide new attachments or revert this confirmed status.
  const status = canonical.draftPlan ? 'published' : t.status;
  const publishedAt =
    validateDate(field(t.publishedAt, '发表时间', 40)) ||
    (canonical.draftPlan ? canonical.publishedAt : '');
  if (status !== 'published' && publishedAt)
    throw new Error('仅已发表状态可以填写发表时间。');
  return {
    ...canonical,
    status,
    publishedAt,
    title: field(t.title, '标题', 300),
    url: validateUrl(field(t.url, '文章链接', 8000)),
    note: field(t.note, '备注'),
    source: canonical.draftPlan
      ? canonical.source
      : field(t.source, '来源', 500),
  };
}
export function parseBackup(raw: string, canonical: Team[]): Team[] {
  let data: { version?: unknown; season?: unknown; teams?: unknown };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('文件不是有效的 JSON 备份。');
  }
  if (
    !data ||
    data.version !== 1 ||
    data.season !== SEASON ||
    !Array.isArray(data.teams) ||
    data.teams.length !== 30
  )
    throw new Error('请选择本工具导出的 2026–27 赛季备份（30队）。');
  const incoming = data.teams as Record<string, unknown>[];
  if (
    incoming.some((t) => !t || typeof t !== 'object') ||
    new Set(incoming.map((t) => t.id)).size !== 30
  )
    throw new Error('备份中球队重复或缺失。');
  return canonical.map((t) =>
    validateTeam(
      incoming.find((row) => row.id === t.id),
      t,
    ),
  );
}
export function serializeBackup(teams: Team[]) {
  return JSON.stringify(
    { version: 1, season: SEASON, exportedAt: new Date().toISOString(), teams },
    null,
    2,
  );
}
export function summarize(teams: Team[]) {
  return {
    published: teams.filter((t) => t.status === 'published').length,
    unconfirmed: teams.filter((t) => t.status === 'unconfirmed').length,
    ready: teams.filter((t) => t.status === 'ready').length,
    draft: teams.filter((t) => t.status === 'draft').length,
    total: teams.length,
  };
}
