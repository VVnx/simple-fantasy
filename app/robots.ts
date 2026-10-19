import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // APIs remain crawlable so search engines can render interactive tools.
  // Their response headers prevent JSON endpoints appearing as search results.
  return {rules:{userAgent:'*',allow:'/'},sitemap:siteUrl('/sitemap.xml')};
}
