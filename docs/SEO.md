# All Timeline SEO

Primary origin: `https://www.alltimeline.com`, configured in `lib/seo.ts`. Page canonicals and share URLs always use this origin, including when a generated Sites hostname or a tracking query is used to access the same content.

## Page metadata

- `/`: NBA Fantasy player comparison, a short visible introduction and WebSite structured data.
- `/schedule`: separate title and description for weekly/fortnightly NBA schedules. Interactive data requests remain crawlable.
- `/briefings`: a list of articles with crawlable date links. Historical list pages keep their own `before` canonical.
- `/briefings?date=YYYY-MM-DD`: title and excerpt from the saved article, exact-date canonical, Article and BreadcrumbList JSON-LD, publication/modification timestamps and the registered cover in Open Graph/Twitter metadata. No author identity or rating is invented.
- Missing or invalid detail dates return a noindex 404. Database failures are handled separately from missing articles.

The HTML for each normal page has a single descriptive H1; the brand is a home link. `serializeJsonLd` escapes `<` to prevent uploaded text from breaking out of a script element. Text stays plain text in the reading UI. Metadata streaming is disabled using `htmlLimitedBots` so every crawler receives titles, canonicals and share cards in the initial HTML head. This waits for the same small D1 read already needed to render the article; metadata does not call external news services.

## Discovery

`/robots.txt` allows crawling and advertises `/sitemap.xml`. CSS, JavaScript, images and the data APIs remain crawlable for page rendering. Data APIs send `X-Robots-Tag: noindex` so JSON is not indexed as a page; publishing authentication is unchanged.

`/sitemap.xml` reads all published briefing dates from D1 at request time, beyond the UI's 30-item pagination. It uses stored update timestamps, includes registered cover image URLs and automatically reflects new/updated briefings. It does not fabricate freshness dates for static tool pages. Database failures remain errors instead of emitting a successful incomplete sitemap.

## Release checks

Run the SEO and briefing tests, type checking and the Sites build. Run `node scripts/verify-seo.mjs <origin> [report-path]` against the built Worker or production to check normal, Googlebot and Twitterbot responses for titles, descriptions, canonicals, Open Graph, parseable JSON-LD, robots/sitemap content types, missing-article 404s, and noindex API headers. Verify key visible pages in the browser.

Search Console submission and Google/Bing indexing are external account operations. Publishing these files does not mean the site has been submitted or indexed. A verified property owner can submit `https://www.alltimeline.com/sitemap.xml` and monitor indexing and search performance.

References: [Google canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article).
