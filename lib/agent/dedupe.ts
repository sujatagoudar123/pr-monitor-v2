/**
 * URL normalization + dedup.
 * Same article from RSS + Google News + scrape should collapse to one row.
 */

import type { Article } from '@/lib/types';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', '_hsenc', '_hsmi'];

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    UTM_KEYS.forEach((k) => u.searchParams.delete(k));
    u.hash = '';
    // Drop trailing slash from pathname (except root)
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url.trim().toLowerCase();
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isGoogleNewsWrapper(url: string): boolean {
  return /(^|\.)news\.google\.com/.test(new URL(url, 'https://x').hostname);
}

export function dedupeArticles(articles: Article[]): Article[] {
  const byUrl = new Map<string, Article>();
  const byTitle = new Map<string, Article>();

  for (const a of articles) {
    if (!a.link || !a.title) continue;
    const normUrl = normalizeUrl(a.link);
    const normTitle = normalizeTitle(a.title);

    const urlMatch = byUrl.get(normUrl);
    const titleMatch = byTitle.get(normTitle);
    const existing = urlMatch ?? titleMatch;

    if (!existing) {
      byUrl.set(normUrl, a);
      byTitle.set(normTitle, a);
      continue;
    }

    // Prefer direct URLs over Google News wrappers
    let winner = existing;
    try {
      const aWrap = isGoogleNewsWrapper(a.link);
      const eWrap = isGoogleNewsWrapper(existing.link);
      if (eWrap && !aWrap) winner = a;
    } catch { /* ignore */ }
    // Prefer the one with a snippet
    if (winner === existing && !existing.snippet && a.snippet) winner = a;

    byUrl.set(normUrl, winner);
    byTitle.set(normTitle, winner);
  }

  // Collect uniques by URL (titles are a fallback)
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const a of byUrl.values()) {
    const k = normalizeUrl(a.link);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}
