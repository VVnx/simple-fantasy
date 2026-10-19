import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { GET, PUT } from '@/app/api/briefings/route';
import BriefingsPage from '@/app/briefings/page';
import { runWithBriefingEnv, type BriefingEnv } from '@/lib/briefing-runtime';
import { MAX_BRIEFING_BYTES, type BriefingView } from '@/lib/briefings';
import { getBriefingList } from '@/lib/data/briefings';

const token = 'local-test-publisher-not-a-production-credential';
const digest = createHash('sha256').update(token).digest('hex');
let sqlite: DatabaseSync;
let env: BriefingEnv;

// Execute the actual generated schema and repository SQL, adapting only D1's IO.
function statement(sql: string, args: SQLInputValue[] = []): D1PreparedStatement {
  return {
    bind: (...values: SQLInputValue[]) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({success:true, results:sqlite.prepare(sql).all(...args)}),
  } as unknown as D1PreparedStatement;
}
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
  }
  env = {BRIEFING_PUBLISH_TOKEN_SHA256:digest, DB:{
    prepare:statement,
    batch:(queries:D1PreparedStatement[]) => Promise.all(queries.map(query => query.all())),
  } as unknown as D1Database};
});
afterEach(() => { sqlite.close(); vi.useRealTimers(); });

function write(date='2026-10-19', body: BodyInit = '今日简报\n\n首发与轮换。', headers: Record<string,string> = {}) {
  return new Request(`https://example.test/api/briefings?date=${date}`, {
    method:'PUT', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'text/plain; charset=utf-8', ...headers},
    body, ...(body instanceof ReadableStream ? {duplex:'half'} : {}),
  });
}
function publish(request=write(), runtime=env) { return runWithBriefingEnv(runtime, () => PUT(request)); }
async function read(date?:string) {
  const response = await runWithBriefingEnv(env, () => GET(new Request(`https://example.test/api/briefings${date ? `?date=${date}` : ''}`)));
  return {response, data:await response.json() as BriefingView};
}

describe('daily briefings authorization and storage', () => {
  it('does not let cookies, identity headers, or query credentials authorize a write', async () => {
    for (const authorization of ['', 'Bearer wrong-key']) {
      const request = write(undefined, '不应保存', {Authorization:authorization, Cookie:'session=owner', 'oai-authenticated-user-id':'owner'});
      const response = await publish(request);
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    const query = new Request(`https://example.test/api/briefings?date=2026-10-19&token=${token}`, {method:'PUT',body:'不应保存'});
    expect((await publish(query)).status).toBe(401);
    expect((await read()).data.briefing).toBeNull();
  });

  it('fails closed if configuration or storage is unavailable', async () => {
    for (const value of [undefined, '', 'not-a-digest']) {
      expect((await publish(write(), {...env, BRIEFING_PUBLISH_TOKEN_SHA256:value})).status).toBe(503);
    }
    expect((await publish(write(), {BRIEFING_PUBLISH_TOKEN_SHA256:digest})).status).toBe(503);
    expect((await read()).data.briefing).toBeNull();
  });

  it('saves exact text, updates one row per date and preserves creation time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T00:00:00Z'));
    const content = ' 第一段\r\n\r\n<script>alert("x")</script>\n第二段 & 完整正文。 ';
    expect((await publish(write(undefined, content))).status).toBe(200);
    const first = (await read()).data.briefing!;
    expect(first.content).toBe(content);
    vi.setSystemTime(new Date('2026-10-19T01:00:00Z'));
    await publish(write(undefined, content));
    expect((await read()).data.briefing!.updatedAt).toBe(first.updatedAt);
    await publish(write(undefined, '修订后的简报'));
    const revised = (await read()).data.briefing!;
    expect(revised.createdAt).toBe(first.createdAt);
    expect(revised.updatedAt).toBe('2026-10-19T01:00:00.000Z');
    expect(revised.content).toBe('修订后的简报');
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM daily_briefings').get()?.count).toBe(1);
  });

  it('shows latest and neighboring issues, including dates without a briefing', async () => {
    expect((await read()).data).toEqual({briefing:null, previousDate:null, nextDate:null});
    for (const date of ['2026-10-17','2026-10-19','2026-10-21']) await publish(write(date, date));
    expect((await read()).data.briefing!.date).toBe('2026-10-21');
    expect((await read('2026-10-19')).data).toMatchObject({previousDate:'2026-10-17', nextDate:'2026-10-21'});
    expect((await read('2026-10-20')).data).toEqual({briefing:null, previousDate:'2026-10-19', nextDate:'2026-10-21'});
    expect((await read('2026-10-17')).data.previousDate).toBeNull();
    expect((await read()).data.nextDate).toBeNull();
  });

  it('lists newest issues first and pages through history without loading article bodies', async () => {
    expect(await runWithBriefingEnv(env, () => getBriefingList())).toEqual({items:[], nextBefore:null});
    for (let day = 1; day <= 31; day++) {
      await publish(write(`2026-10-${String(day).padStart(2, '0')}`, '正文仅在详情展示'));
    }
    const first = await runWithBriefingEnv(env, () => getBriefingList());
    expect(first.items).toHaveLength(30);
    expect(first.items[0]).toEqual({date:'2026-10-31', title:'每日简报'});
    expect(first.nextBefore).toBe('2026-10-02');
    const last = await runWithBriefingEnv(env, () => getBriefingList(first.nextBefore!));
    expect(last).toEqual({items:[{date:'2026-10-01', title:'每日简报'}], nextBefore:null});
  });

  it('keeps authorization scoped to each concurrent request', async () => {
    const responses = await Promise.all([
      publish(write('2026-10-19', '合法发布')),
      publish(write('2026-10-20', '不应保存'), {...env, BRIEFING_PUBLISH_TOKEN_SHA256:'a'.repeat(64)}),
    ]);
    expect(responses.map(response => response.status)).toEqual([200, 401]);
    expect((await read('2026-10-20')).data.briefing).toBeNull();
  });

  it('returns errors rather than pretending a database failure is empty data', async () => {
    sqlite.exec('DROP TABLE daily_briefings');
    expect((await read()).response.status).toBe(503);
    expect((await publish()).status).toBe(503);
  });
});

describe('daily briefing input and rendering', () => {
  it('validates real calendar dates on both reads and writes', async () => {
    for (const date of ['2026-02-29','2026-02-30','2026-13-01','2026-1-02','1999-12-31', '2101-01-01', "2026-10-19%27"]) {
      expect((await publish(write(date))).status).toBe(400);
      expect((await read(date)).response.status).toBe(400);
    }
    expect((await publish(write('2028-02-29'))).status).toBe(200);
  });

  it('rejects empty/binary input, wrong encodings and non-text bodies', async () => {
    for (const body of ['', ' \n\t ', 'binary\0text']) expect((await publish(write(undefined, body))).status).toBe(400);
    expect((await publish(write(undefined, new Uint8Array([0xff,0xfe])))).status).toBe(400);
    for (const type of ['application/json', 'text/html', 'text/plain; charset=gbk']) {
      expect((await publish(write(undefined, '内容', {'Content-Type':type}))).status).toBe(415);
    }
    expect((await read()).data.briefing).toBeNull();
  });

  it('bounds bytes even when content-length is missing or dishonest', async () => {
    expect((await publish(write(undefined, '文'.repeat(MAX_BRIEFING_BYTES/2)))).status).toBe(413);
    const stream = new ReadableStream({start(controller) {
      controller.enqueue(new Uint8Array(MAX_BRIEFING_BYTES).fill(65));
      controller.enqueue(new Uint8Array([66]));
      controller.close();
    }});
    expect((await publish(write(undefined, stream, {'Content-Length':'1'}))).status).toBe(413);
    expect((await publish(write(undefined, 'a'.repeat(MAX_BRIEFING_BYTES)))).status).toBe(200);
  });

  it('checks single-line title length and retains the default title', async () => {
    for (const title of ['', 'a'.repeat(121), '标题\n第二行']) {
      const request = new Request(`${write().url}&title=${encodeURIComponent(title)}`, write());
      expect((await publish(request)).status).toBe(400);
    }
    const request = new Request(`${write().url}&title=${encodeURIComponent(' NBA 日报 ')}`, write());
    expect((await publish(request)).status).toBe(200);
    expect((await read()).data.briefing!.title).toBe('NBA 日报');
  });

  it('renders uploaded markup as text and has no upload control in the page', async () => {
    await publish(write(undefined, '<script>alert("x")</script>\n\n**纯文字**'));
    const page = await runWithBriefingEnv(env, () => BriefingsPage({searchParams:Promise.resolve({date:'2026-10-19'})}));
    const html = renderToStaticMarkup(page);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('**纯文字**');
    expect(html).toContain('aria-current="page">每日简报');
    expect(html).not.toContain(token);
    expect(html).not.toContain(digest);
    expect(html).not.toContain('type="file"');
    expect(html).toContain('href="/briefings">← 每日简报');
  });

  it('opens on a list of links and only shows full text for the selected issue', async () => {
    await publish(write('2026-10-18', '旧一期正文'));
    await publish(write('2026-10-19', '今日正文'));
    const render = async (params:{date?:string; before?:string}) => renderToStaticMarkup(
      await runWithBriefingEnv(env, () => BriefingsPage({searchParams:Promise.resolve(params)})),
    );
    const list = await render({});
    expect(list).toContain('aria-label="每日简报列表"');
    expect(list).toContain('href="/briefings?date=2026-10-19"');
    expect(list.indexOf('2026-10-19')).toBeLessThan(list.indexOf('2026-10-18'));
    expect(list).not.toContain('今日正文');
    expect(list).not.toContain('旧一期正文');
    expect(list).not.toContain('<article');
    const detail = await render({date:'2026-10-18'});
    expect(detail).toContain('旧一期正文');
    expect(detail).not.toContain('今日正文');
    expect(detail).toContain('下一篇');
    expect(await render({date:'2026-10-20'})).toContain('暂无这篇简报');
    expect(await render({before:'invalid'})).toContain('role="alert"');
  });
});
