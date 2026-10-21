import { addDays } from '@/lib/schedule';
/* eslint-disable @next/next/no-html-link-for-pages -- Keep navigation compatible with the Sites runtime. */
/* eslint-disable @next/next/no-img-element -- Serve the original downloadable cover without an image optimizer. */
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ToolNavigation from '@/components/tool-navigation';
import BriefingMatchView from '@/components/briefing-match-view';
import {structureBriefing,hasBriefingStructure} from '@/lib/briefing-structure';
import JsonLd from '@/components/json-ld';
import { BriefingError, validBriefingDate, validateBriefingDate, type BriefingList, type BriefingView } from '@/lib/briefings';
import { getBriefingList, getBriefingView } from '@/lib/data/briefings';
import { getBriefingCover } from '@/lib/briefing-covers';
import { articleStructuredData, briefingMetadata, briefingPath, BRIEFINGS_DESCRIPTION, pageMetadata, SITE_NAME, siteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';
const briefingUrl = briefingPath;
const readBriefing = cache(getBriefingView);
type Props = {searchParams:Promise<{date?:string | string[]; before?:string | string[]}>};

export async function generateMetadata({searchParams}: Props): Promise<Metadata> {
  const {date,before} = await searchParams;
  if (date !== undefined) {
    if (typeof date !== 'string' || !validBriefingDate(date)) notFound();
    let view: BriefingView;
    try { view = await readBriefing(date); }
    catch { return {title:'简报暂时无法读取 | All Timeline',robots:{index:false,follow:true},alternates:{canonical:null}}; }
    if (!view.briefing) notFound();
    return briefingMetadata(view.briefing);
  }
  if (before !== undefined && (typeof before !== 'string' || !validBriefingDate(before))) {
    return {title:'简报日期无效 | All Timeline',robots:{index:false,follow:true},alternates:{canonical:null}};
  }
  return pageMetadata(before ? `${before} 之前的 NBA Fantasy 每日简报` : 'NBA Fantasy 每日简报',
    BRIEFINGS_DESCRIPTION, before ? `/briefings?before=${before}` : '/briefings');
}

export default async function BriefingsPage({searchParams}: Props) {
  const params = await searchParams;
  const isDetail = params.date !== undefined;
  if (isDetail && (typeof params.date !== 'string' || !validBriefingDate(params.date))) notFound();
  let view: BriefingView | undefined;
  let list: BriefingList | undefined;
  let error: string | undefined;
  try {
    if (isDetail) {
      view = await readBriefing(validateBriefingDate(typeof params.date === 'string' ? params.date : ''));
    } else {
      const before = params.before === undefined ? undefined : validateBriefingDate(typeof params.before === 'string' ? params.before : '');
      list = await getBriefingList(before);
    }
  } catch (cause) {
    error = cause instanceof BriefingError ? cause.message : '简报暂时无法读取，请稍后重试。';
  }
  const briefing = view?.briefing;
  if (isDetail && !error && !briefing) notFound();
  const cover = briefing ? getBriefingCover(briefing.date) : undefined;
  const structured=briefing?structureBriefing(briefing):undefined;
  const showStructure=structured&&hasBriefingStructure(structured);
  const original=briefing&&<>{cover&&<figure className="briefing-cover"><img src={cover.src} alt={cover.alt} width={cover.width} height={cover.height} decoding="async"/><figcaption><a href={cover.src} download={`NBA-Fantasy-${briefing.date}-cover.png`}>下载封面 ↓</a></figcaption></figure>}<div className="briefing-content">{briefing.content}</div></>;
  return <main className={`briefings-page ${showStructure?'briefing-structured-page':''}`}>
    <header className="site-header"><a className="site-brand" href="/">Fantasy - All Timeline</a><ToolNavigation active="briefings"/></header>
    <div className="briefings-body">
      <div className="briefings-heading">
        {isDetail ? <a href="/briefings">← 每日简报</a> : <h1>NBA Fantasy 每日简报</h1>}
      </div>
      {error ? <div className="briefings-empty" role="alert"><p>{error}</p><a href="/briefings">返回列表</a></div>
        : isDetail ? <>
          {briefing ? <><JsonLd data={articleStructuredData(briefing)}/>
          <JsonLd data={{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
            {'@type':'ListItem',position:1,name:SITE_NAME,item:siteUrl('/')},
            {'@type':'ListItem',position:2,name:'每日简报',item:siteUrl('/briefings')},
            {'@type':'ListItem',position:3,name:briefing.title,item:siteUrl(briefingUrl(briefing.date))},
          ]}}/>
          <article className="briefing-article">
            <header className="briefing-article-heading">
              <time dateTime={briefing.date}>{briefing.date}</time>
              <h1>{briefing.title}</h1>
            </header>
            <a className="briefing-card-link" href={`/player-cards?date=${addDays(briefing.date,-1)}`}>制作当天球员数据卡片 ↗</a>
            <a className="briefing-card-link" href={`/surprise-board?date=${briefing.date}`}>拖拽惊喜球员榜 ↗</a>
            {showStructure?<BriefingMatchView data={structured!} original={original}/>:original}
          </article></> : <div className="briefings-empty"><p>暂无这篇简报</p></div>}
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
