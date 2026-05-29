/**
 * Bing News v7 source — only active if BING_NEWS_API_KEY is set.
 * Azure free tier is 1,000 calls/month.
 *
 * 72h filter at source: uses the `freshness` parameter.
 *   - 24h window → freshness=Day
 *   - 25–168h    → freshness=Week (Bing's narrowest "recent" option)
 *   - >168h      → freshness=Month
 * We then trim further downstream via the freshness module.
 */

import type { Article } from '@/lib/types';
import { getLookbackHours } from '@/lib/freshness';

export function bingNewsAvailable(): boolean {
  return Boolean(process.env.BING_NEWS_API_KEY);
}

function freshnessParam(hours: number): 'Day' | 'Week' | 'Month' {
  if (hours <= 24) return 'Day';
  if (hours <= 168) return 'Week';
  return 'Month';
}

export async function searchBingNews(
  company: string,
  extraTerms: string[] = [],
): Promise<Article[]> {
  const key = process.env.BING_NEWS_API_KEY;
  if (!key) return [];

  const lookbackHours = getLookbackHours();
  const freshness = freshnessParam(lookbackHours);
  const q = [company, ...extraTerms].join(' ');
  const url = `https://api.bing.microsoft.com/v7.0/news/search?q=${encodeURIComponent(q)}&count=50&freshness=${freshness}&sortBy=Date&mkt=en-US`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { value?: Array<{
      name?: string; url?: string; description?: string;
      datePublished?: string; provider?: Array<{ name?: string }>;
    }> };
    return (data.value ?? []).map((v): Article => ({
      title: (v.name ?? '').trim(),
      link: (v.url ?? '').trim(),
      source: v.provider?.[0]?.name ?? 'Bing News',
      sourceType: 'bing_news',
      publishedAt: v.datePublished ?? null,
      snippet: (v.description ?? '').slice(0, 400),
    })).filter((a) => a.title && a.link);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}
