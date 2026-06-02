/**
 * Tracks article URLs already sent, so we don't email the same story twice.
 *
 * Storage: Vercel Blob (one JSON file per company at seen/<company>.json)
 * Fail-open: if Blob errors, sending continues — but errors are logged so
 *            you can see them in Vercel's function logs.
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
    u.search = '';
    return u.toString().toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase();
  }
}

async function read(company: string): Promise<Record<string, number>> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('[seen] read skipped: BLOB_READ_WRITE_TOKEN not set');
    return {};
  }
  try {
    const result = await list({ prefix: key(company), limit: 5 });
    const blob = result.blobs.find((b) => b.pathname === key(company));
    if (!blob) {
      console.log(`[seen] read ${company}: no existing blob at ${key(company)}`);
      return {};
    }
    const res = await fetch(blob.url, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[seen] read ${company}: fetch ${blob.url} returned ${res.status}`);
      return {};
    }
    const text = await res.text();
    const parsed = JSON.parse(text);
    const count = typeof parsed === 'object' && parsed ? Object.keys(parsed).length : 0;
    console.log(`[seen] read ${company}: loaded ${count} URLs`);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch (err) {
    console.error(`[seen] read ${company} FAILED:`, err);
    return {};
  }
}

async function write(company: string, map: Record<string, number>): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('[seen] write skipped: BLOB_READ_WRITE_TOKEN not set');
    return;
  }
  const cutoff = Date.now() - TTL_MS;
  const pruned: Record<string, number> = {};
  for (const [url, ts] of Object.entries(map)) {
    if (ts >= cutoff) pruned[url] = ts;
  }
  const count = Object.keys(pruned).length;
  try {
    const existing = await list({ prefix: key(company), limit: 5 });
    const oldUrls = existing.blobs.filter((b) => b.pathname === key(company)).map((b) => b.url);
    if (oldUrls.length) {
      await del(oldUrls);
      console.log(`[seen] write ${company}: deleted ${oldUrls.length} old blob(s)`);
    }
    const result = await put(key(company), JSON.stringify(pruned), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    console.log(`[seen] write ${company}: saved ${count} URLs to ${result.url}`);
  } catch (err) {
    console.error(`[seen] write ${company} FAILED:`, err);
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
  console.log(`[seen] filter ${company}: ${articles.length} in -> ${unseen.length} unseen, ${skipped} skipped`);
  return { unseen, skipped };
}

/** Record URLs as sent. Call AFTER a successful email. */
export async function markSent(company: string, urls: string[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || urls.length === 0) {
    console.log(`[seen] markSent skipped for ${company}: token=${Boolean(process.env.BLOB_READ_WRITE_TOKEN)}, urls=${urls.length}`);
    return;
  }
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
