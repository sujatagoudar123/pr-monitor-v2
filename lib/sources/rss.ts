/**
 * RSS source — parses the curated feeds for a given company.
 * Each feed has a 9-second timeout; failures fall through silently.
 */

import Parser from 'rss-parser';
import type { Article, Company } from '@/lib/types';

const parser = new Parser({
  timeout: 9000,
  headers: { 'User-Agent': 'pr-monitor-agent/2.1 (+vercel)' },
});

async function fetchOne(feedUrl: string, sourceName: string): Promise<Article[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items ?? []).slice(0, 50).map((item): Article => ({
      title: (item.title ?? '').trim(),
      link: (item.link ?? item.guid ?? '').trim(),
      source: sourceName,
      sourceType: 'rss',
      publishedAt: item.isoDate ?? item.pubDate ?? null,
      snippet: (item.contentSnippet ?? item.summary ?? '').slice(0, 400),
    })).filter((a) => a.title && a.link);
  } catch {
    return [];
  }
}

export async function searchRss(company: Company, extraTerms: string[] = []): Promise<Article[]> {
  const feeds = company.rssFeeds ?? [];
  const results = await Promise.all(feeds.map((f) => fetchOne(f.url, f.source)));
  const all = results.flat();
  if (extraTerms.length === 0) return all;

  // Optional client-side filter when the agent asked for specific terms
  const lowered = extraTerms.map((t) => t.toLowerCase());
  return all.filter((a) => {
    const hay = `${a.title} ${a.snippet ?? ''}`.toLowerCase();
    return lowered.some((t) => hay.includes(t));
  });
}
