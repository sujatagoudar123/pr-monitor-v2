/**
 * RSS source — parses the curated feeds for a given company.
 * Each feed has a 9-second timeout; failures fall through silently.
 *
 * 72h filtering: applied here at the source. We parse pubDate from each item
 * and drop anything older than the lookback window. Items with no pubDate
 * are KEPT (they get flagged `undated` later by the freshness filter).
 */

import Parser from 'rss-parser';
import type { Article, Company } from '@/lib/types';
import { getLookbackHours, parsePublishedAt } from '@/lib/freshness';

const parser = new Parser({
  timeout: 9000,
  headers: { 'User-Agent': 'pr-monitor-agent/2.1 (+vercel)' },
});

async function fetchOne(
  feedUrl: string,
  sourceName: string,
  cutoff: Date,
): Promise<Article[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    const items = feed.items ?? [];
    const out: Article[] = [];
    for (const item of items.slice(0, 80)) {
      const title = (item.title ?? '').trim();
      const link = (item.link ?? item.guid ?? '').trim();
      if (!title || !link) continue;

      const rawDate = item.isoDate ?? item.pubDate ?? null;
      const parsedDate = parsePublishedAt(rawDate);

      // Source-level freshness filter: drop dated items older than cutoff.
      // Undated items (parsedDate === null) are KEPT — handled downstream.
      if (parsedDate && parsedDate < cutoff) continue;

      out.push({
        title,
        link,
        source: sourceName,
        sourceType: 'rss',
        publishedAt: rawDate,
        snippet: (item.contentSnippet ?? item.summary ?? '').slice(0, 400),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function searchRss(
  company: Company,
  extraTerms: string[] = [],
): Promise<Article[]> {
  const feeds = company.rssFeeds ?? [];
  const lookbackHours = getLookbackHours();
  const cutoff = new Date(Date.now() - lookbackHours * 3_600_000);

  const results = await Promise.all(feeds.map((f) => fetchOne(f.url, f.source, cutoff)));
  const all = results.flat();

  if (extraTerms.length === 0) return all;

  // Optional client-side filter when the agent asked for specific terms
  const lowered = extraTerms.map((t) => t.toLowerCase());
  return all.filter((a) => {
    const hay = `${a.title} ${a.snippet ?? ''}`.toLowerCase();
    return lowered.some((t) => hay.includes(t));
  });
}
