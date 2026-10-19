/* eslint-disable @next/next/no-html-link-for-pages -- Keep navigation compatible with the Sites runtime. */
import ToolNavigation from '@/components/tool-navigation';
import { BriefingError, validateBriefingDate, type BriefingView } from '@/lib/briefings';
import { getBriefingView } from '@/lib/data/briefings';

export const dynamic = 'force-dynamic';
export const metadata = {title:'每日简报 · Fantasy - All Timeline'};
const briefingUrl = (date: string) => `/briefings?date=${date}`;

export default async function BriefingsPage({searchParams}: {
  searchParams: Promise<{date?:string | string[]}>;
}) {
  const params = await searchParams;
  let view: BriefingView | undefined;
  let selectedDate: string | undefined;
  let error: string | undefined;
  try {
    if (params.date !== undefined) {
      selectedDate = validateBriefingDate(typeof params.date === 'string' ? params.date : '');
    }
    view = await getBriefingView(selectedDate);
  } catch (cause) {
    error = cause instanceof BriefingError ? cause.message : '简报暂时无法读取，请稍后重试。';
  }
  const briefing = view?.briefing;
  const date = selectedDate ?? briefing?.date;
  return <main className="briefings-page">
    <header className="site-header"><h1>Fantasy - All Timeline</h1><ToolNavigation active="briefings"/></header>
    <section className="briefings-heading" aria-labelledby="briefings-title">
      <h2 id="briefings-title">每日简报</h2>
      <form action="/briefings" method="get" className="briefings-date-picker">
        <label htmlFor="briefing-date">日期</label>
        <input id="briefing-date" name="date" type="date" min="2000-01-01" max="2100-12-31" defaultValue={date} required/>
        <button type="submit">查看</button>
        <a href="/briefings">最新</a>
      </form>
    </section>
    {error ? <div className="briefings-empty" role="alert"><p>{error}</p><a href="/briefings">重新读取</a></div> : <>
      {briefing ? <article className="briefing-article">
        <header className="briefing-article-heading">
          <time dateTime={briefing.date}>{briefing.date}</time>
          <h3>{briefing.title}</h3>
          <p>更新于 {new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(new Date(briefing.updatedAt))} · 北京时间</p>
        </header>
        <div className="briefing-content">{briefing.content}</div>
      </article> : <div className="briefings-empty">
        <p>{selectedDate ? `${selectedDate} 暂无简报` : '还没有简报'}</p>
        <span>{selectedDate ? '可以选择其他日期，或查看最新简报。' : '简报发布后会显示在这里。'}</span>
      </div>}
      {(view?.previousDate || view?.nextDate) && <nav className="briefings-pagination" aria-label="简报翻页">
        {view.previousDate ? <a href={briefingUrl(view.previousDate)}>← 上一篇 <span>{view.previousDate}</span></a> : <span/>}
        {view.nextDate ? <a href={briefingUrl(view.nextDate)}>下一篇 → <span>{view.nextDate}</span></a> : <span/>}
      </nav>}
    </>}
  </main>;
}
