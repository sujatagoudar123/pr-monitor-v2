/**
 * Google News source — hits Google News' public RSS endpoint.
 * No API key. Constrains to last N days via the `when:` query operator,
 * which is Google News' way of filtering at the source.
 */

import Parser from 'rss-parser';
import type { Article } from '@/lib/types';
import { getLookbackHours } from '@/lib/freshness';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'pr-monitor-agent/2.1 (+vercel)' },
});

export async function searchGoogleNews(
  company: string,
  extraTerms: string[] = [],
  options: { hl?: string; gl?: string; ceid?: string } = {},
): Promise<Article[]> {
  const hl = options.hl ?? 'en-US';
  const gl = options.gl ?? 'US';
  const ceid = options.ceid ?? 'US:en';

  // Convert lookback hours to Google News' `when:Nd` operator (rounds up to whole days)
  const days = Math.max(1, Math.ceil(getLookbackHours() / 24));
  const whenClause = `when:${days}d`;

  const queryParts = [`"${company}"`, ...extraTerms.map((t) => `"${t}"`)].join(' OR ');
  const fullQuery = `(${queryParts}) ${whenClause}`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(fullQuery)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

  try {
    const feed = await parser.parseURL(url);
    return (feed.items ?? []).slice(0, 60).map((item): Article => {
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
