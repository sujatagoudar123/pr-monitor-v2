/**
 * HTML scraping source — sweeps a small set of pharma/business publications
 * and pulls headlines that mention the company. Uses cheerio.
 *
 * Each domain has a 10-second timeout and falls through silently on error.
 */

import * as cheerio from 'cheerio';
import type { Article } from '@/lib/types';

interface ScrapeTarget {
  domain: string;
  startUrls: string[];
  source: string;
}

const TARGETS: Record<string, ScrapeTarget> = {
  'fiercepharma.com': {
    domain: 'fiercepharma.com',
    startUrls: ['https://www.fiercepharma.com/'],
    source: 'FiercePharma',
  },
  'statnews.com': {
    domain: 'statnews.com',
    startUrls: ['https://www.statnews.com/category/pharma/'],
    source: 'STAT News',
  },
  'endpts.com': {
    domain: 'endpts.com',
    startUrls: ['https://endpts.com/'],
    source: 'Endpoints News',
  },
  'autonews.com': {
    domain: 'autonews.com',
    startUrls: ['https://www.autonews.com/'],
    source: 'Auto News',
  },
};

async function fetchHtml(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 pr-monitor-agent/2.1' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function extractLinks(html: string, baseUrl: string, source: string): Article[] {
  const $ = cheerio.load(html);
  const out: Article[] = [];
  const seen = new Set<string>();
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const title = $(el).text().trim();
    if (!href || !title || title.length < 15 || title.length > 250) return;
    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    if (seen.has(absolute)) return;
    seen.add(absolute);
    out.push({
      title,
      link: absolute,
      source,
      sourceType: 'scrape',
      publishedAt: null, // pages rarely expose this in list views
      snippet: '',
    });
  });
  return out.slice(0, 100);
}

export async function scrapePublications(
  company: string,
  extraTerms: string[] = [],
  domains: string[] = [],
): Promise<Article[]> {
  const targets = (domains.length ? domains : Object.keys(TARGETS))
    .map((d) => TARGETS[d])
    .filter(Boolean);
  if (targets.length === 0) return [];

  const lowered = [company, ...extraTerms].map((t) => t.toLowerCase());
  const all: Article[] = [];

  await Promise.all(
    targets.map(async (t) => {
      for (const url of t.startUrls) {
        const html = await fetchHtml(url);
        if (!html) continue;
        const links = extractLinks(html, url, t.source);
        // Filter to titles mentioning the company / extra terms
        const matching = links.filter((a) => {
          const hay = a.title.toLowerCase();
          return lowered.some((term) => hay.includes(term));
        });
        all.push(...matching);
      }
    }),
  );

  return all;
}
