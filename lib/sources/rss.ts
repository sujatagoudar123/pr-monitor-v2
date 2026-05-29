/**
 * Freshness filter — keeps only articles published within the configured
 * lookback window. Articles with no parseable publishedAt are KEPT but
 * marked `undated: true` so the UI can show a badge.
 */

export const DEFAULT_LOOKBACK_HOURS = 72;

export function getLookbackHours(): number {
  const raw = process.env.FRESHNESS_HOURS;
  if (!raw) return DEFAULT_LOOKBACK_HOURS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LOOKBACK_HOURS;
  return n;
}

export function parsePublishedAt(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    const asNum = Number(s);
    if (Number.isFinite(asNum) && asNum > 1_000_000_000) {
      const d2 = new Date(asNum < 1e12 ? asNum * 1000 : asNum);
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
  }
  return null;
}

export interface FreshnessTagged<T> {
  article: T;
  publishedAt: Date | null;
  undated: boolean;
  withinWindow: boolean;
  ageHours: number | null;
}

export function tagFreshness<T extends { publishedAt?: unknown }>(
  article: T,
  lookbackHours: number = getLookbackHours(),
  now: Date = new Date(),
): FreshnessTagged<T> {
  const parsed = parsePublishedAt(article.publishedAt);
  if (!parsed) {
    return {
      article,
      publishedAt: null,
      undated: true,
      withinWindow: true,
      ageHours: null,
    };
  }
  const ageHours = (now.getTime() - parsed.getTime()) / 3_600_000;
  return {
    article,
    publishedAt: parsed,
    undated: false,
    withinWindow: ageHours >= -1 && ageHours <= lookbackHours,
    ageHours,
  };
}

export function applyFreshness<T extends { publishedAt?: unknown }>(
  articles: T[],
  lookbackHours: number = getLookbackHours(),
  now: Date = new Date(),
): {
  kept: Array<T & { undated: boolean; ageHours: number | null }>;
  dropped: T[];
  stats: { total: number; kept: number; dropped: number; undated: number };
} {
  const kept: Array<T & { undated: boolean; ageHours: number | null }> = [];
  const dropped: T[] = [];
  let undatedCount = 0;

  for (const a of articles) {
    const t = tagFreshness(a, lookbackHours, now);
    if (t.withinWindow) {
      if (t.undated) undatedCount += 1;
      kept.push({ ...a, undated: t.undated, ageHours: t.ageHours });
    } else {
      dropped.push(a);
    }
  }

  return {
    kept,
    dropped,
    stats: {
      total: articles.length,
      kept: kept.length,
      dropped: dropped.length,
      undated: undatedCount,
    },
  };
}
