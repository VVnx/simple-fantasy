import type { Metadata } from 'next';
import { getBriefingCover } from './briefing-covers';
import type { Briefing } from './briefings';

export const SITE_URL = 'https://www.alltimeline.com';
export const SITE_NAME = 'All Timeline';
export const SITE_DESCRIPTION = 'All Timeline 是中文 NBA Fantasy 工具站，提供 Yahoo Fantasy 11 项球员数据对比、NBA 单周与双周赛程，以及伤病动态和轮换建议每日简报。';
export const BRIEFINGS_DESCRIPTION = '阅读中文 NBA Fantasy 每日简报，关注球员伤病、首发与轮换变化，结合具体数据需求寻找加人机会。';
export const API_ROBOTS_HEADERS = {'X-Robots-Tag':'noindex'};

export const siteUrl = (path: string) => new URL(path, SITE_URL).href;
export const briefingPath = (date: string) => `/briefings?date=${date}`;

export function pageMetadata(title: string, description: string, path: string): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const url = siteUrl(path);
  return {
    title: fullTitle,
    description,
    alternates: {canonical:url},
    robots:{index:true,follow:true,googleBot:{index:true,follow:true,'max-image-preview':'large','max-snippet':-1}},
    openGraph: {type:'website', title:fullTitle, description, url, siteName:SITE_NAME, locale:'zh_CN'},
    twitter: {card:'summary', title:fullTitle, description},
  };
}

export function briefingDescription(content: string): string {
  // Remove standalone numbered headings; use the article's actual prose for snippets.
  const text = content.replace(/^\d+[.、]\s*[^\n]+$/gm, '').replace(/\s+/g, ' ').trim();
  const characters = Array.from(text);
  return characters.length > 150 ? `${characters.slice(0,149).join('')}…` : text;
}

export function briefingMetadata(briefing: Briefing): Metadata {
  const description = briefingDescription(briefing.content);
  const base = pageMetadata(briefing.title, description, briefingPath(briefing.date));
  const cover = getBriefingCover(briefing.date);
  const images = cover ? [{url:siteUrl(cover.src), width:cover.width, height:cover.height, alt:cover.alt}] : [];
  return {
    ...base,
    openGraph: {...base.openGraph, type:'article', publishedTime:briefing.createdAt, modifiedTime:briefing.updatedAt, images},
    twitter: {...base.twitter, card:cover ? 'summary_large_image' : 'summary', images},
  };
}

export function articleStructuredData(briefing: Briefing) {
  const url = siteUrl(briefingPath(briefing.date));
  const cover = getBriefingCover(briefing.date);
  return {
    '@context':'https://schema.org',
    '@type':'Article',
    '@id':`${url}#article`,
    headline:briefing.title,
    description:briefingDescription(briefing.content),
    inLanguage:'zh-CN',
    mainEntityOfPage:url,
    datePublished:briefing.createdAt,
    dateModified:briefing.updatedAt,
    publisher:{'@type':'Organization', name:SITE_NAME, url:SITE_URL},
    ...(cover ? {image:[siteUrl(cover.src)]} : {}),
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
