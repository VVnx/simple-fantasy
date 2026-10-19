/* eslint-disable @next/next/no-html-link-for-pages -- Keep navigation compatible with the Sites runtime. */
/* eslint-disable @next/next/no-img-element -- Serve the original downloadable cover without an image optimizer. */
import ToolNavigation from '@/components/tool-navigation';
import { BriefingError, validateBriefingDate, type BriefingList, type BriefingView } from '@/lib/briefings';
import { getBriefingList, getBriefingView } from '@/lib/data/briefings';
import { getBriefingCover } from '@/lib/briefing-covers';

export const dynamic = 'force-dynamic';
export const metadata = {title:'每日简报 · Fantasy - All Timeline'};
const briefingUrl = (date: string) => `/briefings?date=${date}`;

export default async function BriefingsPage({searchParams}: {
  searchParams: Promise<{date?:string | string[]; before?:string | string[]}>;
}) {
  const params = await searchParams;
  const isDetail = params.date !== undefined;
  let view: BriefingView | undefined;
  let list: BriefingList | undefined;
  let error: string | undefined;
  try {
    if (isDetail) {
      view = await getBriefingView(validateBriefingDate(typeof params.date === 'string' ? params.date : ''));
    } else {
      const before = params.before === undefined ? undefined : validateBriefingDate(typeof params.before === 'string' ? params.before : '');
      list = await getBriefingList(before);
    }
  } catch (cause) {
    error = cause instanceof BriefingError ? cause.message : '简报暂时无法读取，请稍后重试。';
  }
  const briefing = view?.briefing;
  const cover = briefing ? getBriefingCover(briefing.date) : undefined;
  return <main className="briefings-page">
    <header className="site-header"><h1>Fantasy - All Timeline</h1><ToolNavigation active="briefings"/></header>
    <div className="briefings-body">
      <div className="briefings-heading">
        {isDetail ? <a href="/briefings">← 每日简报</a> : <h2>每日简报</h2>}
      </div>
      {error ? <div className="briefings-empty" role="alert"><p>{error}</p><a href="/briefings">返回列表</a></div>
        : isDetail ? <>
          {briefing ? <article className="briefing-article">
            <header className="briefing-article-heading">
              <time dateTime={briefing.date}>{briefing.date}</time>
              <h2>{briefing.title}</h2>
            </header>
            {cover && <figure className="briefing-cover">
              <img src={cover.src} alt={cover.alt} width={cover.width} height={cover.height} decoding="async"/>
              <figcaption>
                <a href={cover.src} download={`NBA-Fantasy-${briefing.date}-cover.png`}>下载封面 ↓</a>
              </figcaption>
            </figure>}
            <div className="briefing-content">{briefing.content}</div>
          </article> : <div className="briefings-empty"><p>暂无这篇简报</p></div>}
          {(view?.previousDate || view?.nextDate) && <nav className="briefings-pagination" aria-label="简报翻页">
            {view.previousDate ? <a href={briefingUrl(view.previousDate)}>← 上一篇 <span>{view.previousDate}</span></a> : <span/>}
            {view.nextDate ? <a href={briefingUrl(view.nextDate)}>下一篇 → <span>{view.nextDate}</span></a> : <span/>}
          </nav>}
        </> : <>
          {list?.items.length ? <ul className="briefings-list" aria-label="每日简报列表">
            {list.items.map(item => <li key={item.date}>
              <a className="briefing-list-link" href={briefingUrl(item.date)}>
                <time dateTime={item.date}>{item.date}</time>
                <h3>{item.title}</h3>
                <span aria-hidden="true">→</span>
              </a>
            </li>)}
          </ul> : <div className="briefings-empty"><p>暂无简报</p></div>}
          {(params.before !== undefined || list?.nextBefore) && <nav className="briefings-pagination" aria-label="列表翻页">
            {params.before !== undefined ? <a href="/briefings">返回最新</a> : <span/>}
            {list?.nextBefore ? <a href={`/briefings?before=${list.nextBefore}`}>更早简报 →</a> : <span/>}
          </nav>}
        </>}
    </div>
  </main>;
}
