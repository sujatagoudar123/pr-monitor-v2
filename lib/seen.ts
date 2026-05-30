/**
 * Tracks article URLs already sent, so we don't email the same story twice.
 *
 * Storage: Vercel Blob (one JSON file per company at seen/<company>.json)
 * Fail-open: if Blob isn't configured or errors, sending continues normally.
 */

import { list, put, del } from '@vercel/blob';

const TTL_MS = 14 * 24 * 3600 * 1000; // remember URLs for 14 days

function key(company: string): string {
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `seen/${slug}.json`;
}

function normalize(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = ''; // strip query strings (UTMs, etc.)
    return u.toString().toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase();
  }
}

async function read(company: string): Promise<Record<string, number>> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return {};
  try {
    const result = await list({ prefix: key(company), limit: 5 });
    const blob = result.blobs.find((b) => b.pathname === key(company));
    if (!blob) return {};
    const res = await fetch(blob.url, { cache: 'no-store' });
    if (!res.ok) return {};
    const parsed = JSON.parse(await res.text());
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

async function write(company: string, map: Record<string, number>): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  // Prune expired entries before writing so the file stays small
  const cutoff = Date.now() - TTL_MS;
  const pruned: Record<string, number> = {};
  for (const [url, ts] of Object.entries(map)) {
    if (ts >= cutoff) pruned[url] = ts;
  }
  try {
    // @vercel/blob 0.27 can't overwrite — delete first, then put
    const existing = await list({ prefix: key(company), limit: 5 });
    const oldUrls = existing.blobs.filter((b) => b.pathname === key(company)).map((b) => b.url);
    if (oldUrls.length) await del(oldUrls);
    await put(key(company), JSON.stringify(pruned), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  } catch {
    // silent — fail-open
  }
}

/** Drop articles we've already sent. Returns the unseen subset. */
export async function filterUnseen<T extends { link: string }>(
  company: string,
  articles: T[],
): Promise<{ unseen: T[]; skipped: number }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || articles.length === 0) {
    return { unseen: articles, skipped: 0 };
  }
  const seen = await read(company);
  const unseen: T[] = [];
  let skipped = 0;
  for (const a of articles) {
    if (a.link && normalize(a.link) in seen) skipped++;
    else unseen.push(a);
  }
  return { unseen, skipped };
}

/** Record URLs as sent. Call AFTER a successful email. */
export async function markSent(company: string, urls: string[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || urls.length === 0) return;
  const seen = await read(company);
  const now = Date.now();
  for (const url of urls) {
    if (url) seen[normalize(url)] = now;
  }
  await write(company, seen);
}

/** For /api/health — tells you if it's enabled. */
export function seenStatus() {
  return { enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN) };
}
