import type { MetadataRoute } from 'next';
import { getBriefingIndex } from '@/lib/data/briefings';
import { getBriefingCover } from '@/lib/briefing-covers';
import { briefingPath, siteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Query all published dates, not the UI's 30-entry page. A storage failure
  // must remain an error rather than silently publishing an incomplete sitemap.
  const briefings = await getBriefingIndex();
  const latestUpdate = briefings.map(item=>item.updatedAt).sort().at(-1);
  return [
    {url:siteUrl('/')},
    {url:siteUrl('/schedule')},
    {url:siteUrl('/player-cards')},
    {url:siteUrl('/briefings'), ...(latestUpdate ? {lastModified:latestUpdate} : {})},
    ...briefings.map(item=>{
      const cover = getBriefingCover(item.date);
      return {url:siteUrl(briefingPath(item.date)), lastModified:item.updatedAt,
        ...(cover ? {images:[siteUrl(cover.src)]} : {})};
    }),
  ];
}
