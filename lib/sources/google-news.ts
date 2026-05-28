/**
 * Google News source — hits Google News' public RSS endpoint.
 * No API key. The query is the company name + any extra terms the agent passes.
 */

import Parser from 'rss-parser';
import type { Article } from '@/lib/types';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'pr-monitor-agent/2.1 (+vercel)' },
});

export async function searchGoogleNews(
  company: string,
  extraTerms: string[] = [],
  options: { hl?: string; gl?: string; ceid?: string; when?: string } = {},
): Promise<Article[]> {
  const hl = options.hl ?? 'en-US';
  const gl = options.gl ?? 'US';
  const ceid = options.ceid ?? 'US:en';
  // `when:3d` constrains to last 3 days — matches our 72h freshness goal at the source
  const whenClause = options.when ?? 'when:3d';

  const queryParts = [`"${company}"`, ...extraTerms.map((t) => `"${t}"`)].join(' OR ');
  const fullQuery = `(${queryParts}) ${whenClause}`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(fullQuery)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

  try {
    const feed = await parser.parseURL(url);
    return (feed.items ?? []).slice(0, 60).map((item): Article => {
      // Google News wraps publisher in the title as "Title - Publisher"
      const rawTitle = (item.title ?? '').trim();
      const dashIdx = rawTitle.lastIndexOf(' - ');
      const title = dashIdx > 0 ? rawTitle.slice(0, dashIdx) : rawTitle;
      const publisher = dashIdx > 0 ? rawTitle.slice(dashIdx + 3) : 'Google News';
      return {
        title,
        link: (item.link ?? '').trim(),
        source: publisher,
        sourceType: 'google_news',
        publishedAt: item.isoDate ?? item.pubDate ?? null,
        snippet: (item.contentSnippet ?? '').slice(0, 400),
      };
    }).filter((a) => a.title && a.link);
  } catch {
    return [];
  }
}
