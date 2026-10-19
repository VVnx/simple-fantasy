export const MAX_BRIEFING_BYTES = 64 * 1024;

export interface Briefing {
  date: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface BriefingView {
  briefing: Briefing | null;
  previousDate: string | null;
  nextDate: string | null;
}

export interface BriefingList {
  items: Pick<Briefing, 'date' | 'title'>[];
  nextBefore: string | null;
}

export class BriefingError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function validBriefingDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01' || value > '2100-12-31') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateBriefingDate(value: string): string {
  if (!validBriefingDate(value)) throw new BriefingError('请选择有效日期（YYYY-MM-DD）。', 400);
  return value;
}

export function validateBriefingTitle(value: string | null): string {
  const title = value === null ? '每日简报' : value.trim();
  if (!title || title.length > 120 || /[\r\n\u0000-\u001f\u007f]/.test(title)) {
    throw new BriefingError('标题需为 1–120 个字符的单行文字。', 400);
  }
  return title;
}

export async function readBriefingText(request: Request): Promise<string> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^text\/plain(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(contentType)) {
    throw new BriefingError('请使用 text/plain; charset=utf-8 上传纯文字。', 415);
  }
  const length = request.headers.get('content-length');
  if (length && Number(length) > MAX_BRIEFING_BYTES) throw new BriefingError('简报不能超过 64 KB。', 413);
  if (!request.body) throw new BriefingError('简报正文不能为空。', 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BRIEFING_BYTES) {
        await reader.cancel();
        throw new BriefingError('简报不能超过 64 KB。', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let content: string;
  try { content = new TextDecoder('utf-8', {fatal:true}).decode(bytes); }
  catch { throw new BriefingError('正文必须是 UTF-8 文字。', 400); }
  if (!content.trim()) throw new BriefingError('简报正文不能为空。', 400);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(content)) {
    throw new BriefingError('正文包含无效的控制字符。', 400);
  }
  return content;
}
