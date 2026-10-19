import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const [origin, reportFile] = process.argv.slice(2);
assert(origin, 'Usage: node scripts/verify-seo.mjs <origin> [report-path]');
const base = new URL(origin);
assert(['http:','https:'].includes(base.protocol) && base.pathname === '/' && !base.search && !base.username && !base.password);
const canonicalOrigin = 'https://www.alltimeline.com';
const results = [];
const decode = text => text.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
async function read(path, agent='Mozilla/5.0') {
  const response=await fetch(new URL(path,base),{headers:{'User-Agent':agent},signal:AbortSignal.timeout(20000),redirect:'error'});
  const text=await response.text();
  return {response,text};
}
const {response:api,text:latestJson}=await read('/api/briefings');
assert.equal(api.status,200,'Briefing API unavailable');
const latest=JSON.parse(latestJson).briefing;
const pages=[{path:'/',canonical:'/'},{path:'/schedule',canonical:'/schedule'},{path:'/briefings',canonical:'/briefings'}];
if(latest)pages.push({path:`/briefings?date=${latest.date}`,canonical:`/briefings?date=${latest.date}`,article:latest});

for(const agent of ['Mozilla/5.0','Googlebot','Twitterbot']) {
  for(const page of pages) {
    const {response,text}=await read(page.path,agent);
    assert.equal(response.status,200,page.path);
    const head=text.slice(0,text.indexOf('</head>'));
    const title=head.match(/<title>(.*?)<\/title>/s)?.[1];
    assert(title?.includes('All Timeline'),`${page.path}: title must be in head`);
    assert(head.includes('name="description"'),`${page.path}: description missing`);
    assert(head.includes('property="og:title"'),`${page.path}: share metadata missing`);
    const canonical=head.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1];
    assert.equal(new URL(decode(canonical ?? '')).href,new URL(page.canonical,canonicalOrigin).href,`${page.path}: canonical`);
    assert(!/<meta name="robots"[^>]+noindex/.test(head),`${page.path}: must be indexable`);
    assert.equal(text.match(/<h1[ >]/g)?.length,1,`${page.path}: one descriptive H1`);
    const schemas=[...text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(match=>JSON.parse(match[1]));
    if(page.path==='/')assert(schemas.some(schema=>schema['@type']==='WebSite'));
    if(page.article) {
      assert.equal(decode(title),`${page.article.title} | All Timeline`);
      const article=schemas.find(schema=>schema['@type']==='Article');
      assert.equal(article?.headline,page.article.title);
      assert.equal(article?.dateModified,page.article.updatedAt);
      if(article.image?.length)assert(head.includes(`content="${article.image[0]}"`),'Article share image missing');
    }
    results.push({path:page.path,agent,status:response.status,title:decode(title),metadataInHead:true});
  }
}

const {response:robotsResponse,text:robots}=await read('/robots.txt');
assert.equal(robotsResponse.status,200);
assert(robotsResponse.headers.get('content-type')?.includes('text/plain'));
assert(robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`));
assert(!/Disallow:\s*\/(?:api\/)?\s*$/m.test(robots),'Do not block pages or rendering APIs');
const {response:mapResponse,text:map}=await read('/sitemap.xml');
assert.equal(mapResponse.status,200);
assert(mapResponse.headers.get('content-type')?.includes('xml'));
assert(map.includes('http://www.sitemaps.org/schemas/sitemap/0.9'));
for(const page of pages)assert(map.includes(`<loc>${new URL(page.canonical,canonicalOrigin).href}</loc>`),'Sitemap omitted '+page.path);
results.push({robots:true,sitemap:true,sitemapEntries:(map.match(/<loc>/g)??[]).length});

for(const path of ['/briefings?date=invalid','/briefings?date=1999-12-31']) {
  const {response,text}=await read(path,'Googlebot');
  assert.equal(response.status,404,path);
  assert(/<meta name="robots"[^>]+noindex/.test(text));
  assert(!/<meta name="robots"[^>]+content="index/.test(text),'Conflicting index/noindex');
  results.push({path,status:404,noindex:true});
}
for(const path of ['/api/briefings','/api/players?q=a','/api/stats','/api/schedule']) {
  const {response}=await read(path);
  assert.equal(response.headers.get('x-robots-tag'),'noindex',path);
}
const tracked=await read('/briefings?utm_source=seo-check');
assert(tracked.text.includes(`href="${canonicalOrigin}/briefings"`),'Tracking parameter leaked into canonical');
results.push({apiNoindex:true,trackingCanonical:true});
const report={origin:base.origin,verifiedAt:new Date().toISOString(),checks:results};
if(reportFile)await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({origin:base.origin,pageChecks:pages.length*3,sitemapEntries:(map.match(/<loc>/g)??[]).length,invalidArticles:404,apiNoindex:true,passed:true}));
