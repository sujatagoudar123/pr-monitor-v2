/**
 * RSS source — parses curated feeds for a company.
 * Each feed has a 9-second timeout; failures fall through silently.
 *
 * 72h filtering: applied here at the source. Items older than the cutoff
 * are dropped at parse time. Undated items (no pubDate) are KEPT.
 *
 * Extracts: title, link, snippet (up to 800 chars), publishedAt, author.
 */

import Parser from 'rss-parser';
import type { Article, Company } from '@/lib/types';
import { getLookbackHours, parsePublishedAt } from '@/lib/freshness';

// Tell rss-parser to also pull dc:creator and content:encoded if present
const parser = new Parser({
  timeout: 9000,
  headers: { 'User-Agent': 'pr-monitor-agent/2.1 (+vercel)' },
  customFields: {
    item: [
      ['dc:creator', 'creator'],
      ['content:encoded', 'contentEncoded'],
      ['author', 'authorField'],
    ],
  },
});

function pickAuthor(item: any): string | null {
  const candidates = [item.creator, item.author, item.authorField];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

function pickSnippet(item: any): string {
  // Prefer the longer content:encoded over contentSnippet when available
  const raw =
    (typeof item.contentEncoded === 'string' && item.contentEncoded) ||
    (typeof item.content === 'string' && item.content) ||
    (typeof item.contentSnippet === 'string' && item.contentSnippet) ||
    (typeof item.summary === 'string' && item.summary) ||
    '';
  // Strip HTML tags for the snippet (UI shows plain text)
  const text = String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, 800);
}

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
      // Undated items are KEPT and flagged downstream.
      if (parsedDate && parsedDate < cutoff) continue;

      out.push({
        title,
        link,
        source: sourceName,
        sourceType: 'rss',
        publishedAt: rawDate,
        snippet: pickSnippet(item),
        author: pickAuthor(item),
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

  const lowered = extraTerms.map((t) => t.toLowerCase());
  return all.filter((a) => {
    const hay = `${a.title} ${a.snippet ?? ''}`.toLowerCase();
    return lowered.some((t) => hay.includes(t));
  });
}
