import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import { briefingMetadata, briefingDescription, serializeJsonLd, SITE_URL } from '@/lib/seo';

describe('SEO metadata safety', () => {
  it('keeps JSON-LD strings from breaking out into executable markup', () => {
    const data={headline:'</script><script>alert("x")</script>',description:'球队 < 候选 & 轮换'};
    const json=serializeJsonLd(data);
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual(data);
  });

  it('handles long Unicode snippets and articles without an image', () => {
    const content='1. 小标题\n\n'+ '🏀'.repeat(200);
    const description=briefingDescription(content);
    expect(Array.from(description)).toHaveLength(150);
    expect(description).not.toContain('\uFFFD');
    const metadata=briefingMetadata({date:'2026-10-15',title:'新一期简报',content,createdAt:'2026-10-20T00:00:00Z',updatedAt:'2026-10-20T00:00:00Z'});
    expect(metadata.twitter).toMatchObject({card:'summary',images:[]});
    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/briefings?date=2026-10-15`);
  });

  it('advertises the canonical sitemap without blocking assets needed to render pages', () => {
    expect(robots()).toEqual({rules:{userAgent:'*',allow:'/'},sitemap:`${SITE_URL}/sitemap.xml`});
  });
});
