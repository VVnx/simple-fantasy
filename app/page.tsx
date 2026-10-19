import ResearchTool from '@/components/research-tool';
import JsonLd from '@/components/json-ld';
import { pageMetadata, SITE_NAME, SITE_DESCRIPTION, SITE_URL } from '@/lib/seo';
export const metadata = pageMetadata('NBA Fantasy 球员数据对比', SITE_DESCRIPTION, '/');
// Compute defaults at request time, not during the Vercel build.
export const dynamic = 'force-dynamic';
export default function Page(){return <>
  <JsonLd data={{'@context':'https://schema.org','@type':'WebSite',name:SITE_NAME,alternateName:'Fantasy - All Timeline',url:SITE_URL,inLanguage:'zh-CN',description:SITE_DESCRIPTION}}/>
  <ResearchTool today={new Date().toISOString()}/>
</>;}
