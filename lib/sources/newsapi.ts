/**
 * NewsAPI.org source — only active if NEWSAPI_KEY is set.
 * Free tier is 100 requests/day.
 *
 * 72h filter at source: uses the `from=<ISO>` parameter so the API itself
 * only returns articles within the window. Most efficient option.
 */

import type { Article } from '@/lib/types';
import { getLookbackHours } from '@/lib/freshness';

export function newsApiAvailable(): boolean {
  return Boolean(process.env.NEWSAPI_KEY);
}

export async function searchNewsApi(
  company: string,
  extraTerms: string[] = [],
): Promise<Article[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];

  const lookbackHours = getLookbackHours();
  const fromDate = new Date(Date.now() - lookbackHours * 3_600_000).toISOString();
  const q = [company, ...extraTerms].map((t) => `"${t}"`).join(' OR ');
  const url =
    `https://newsapi.org/v2/everything` +
    `?q=${encodeURIComponent(q)}` +
    `&from=${encodeURIComponent(fromDate)}` +
    `&sortBy=publishedAt&language=en&pageSize=80`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { headers: { 'X-Api-Key': key }, signal: ctrl.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles?: Array<{
      title?: string; url?: string; source?: { name?: string };
      publishedAt?: string; description?: string;
    }> };
    return (data.articles ?? []).map((a): Article => ({
      title: (a.title ?? '').trim(),
      link: (a.url ?? '').trim(),
      source: a.source?.name ?? 'NewsAPI',
      sourceType: 'newsapi',
      publishedAt: a.publishedAt ?? null,
      snippet: (a.description ?? '').slice(0, 400),
    })).filter((a) => a.title && a.link);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}
