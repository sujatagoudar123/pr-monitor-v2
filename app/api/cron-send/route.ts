/**
 * Cron endpoint hit by Vercel Cron on schedule.
 *
 * Vercel invokes:   GET /api/cron-send?slot=<slot-id>
 *
 * Authentication:
 *   - Vercel auto-sends `Authorization: Bearer ${CRON_SECRET}` when the env
 *     var is set in the project. We verify that header.
 *   - With CRON_SECRET unset, the endpoint is open (dev mode). A warning logs.
 *
 * What it does:
 *   1. Look up the slot (which companies to run)
 *   2. For each company, call /api/agent-search internally
 *   3. Defensively re-apply 72h freshness filter
 *   4. Email the result to that company's recipients via /api/send-email
 *   5. Return a JSON summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSlot, resolveRecipients, SCHEDULE } from '@/config/schedule';
import { applyFreshness, getLookbackHours } from '@/lib/freshness';
import { markSent } from '@/lib/seen';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

interface AgentSearchResponse {
  company: string;
  keywordsUsed: string[];
  executiveSummary: string;
  articles: Array<{
    title: string; link: string; source: string; sourceType: string;
    publishedAt?: string | null; snippet?: string;
    matchedKeywords?: string[]; whyPicked?: string; relevanceScore?: number;
    undated?: boolean; ageHours?: number | null;
  }>;
  stats?: Record<string, unknown>;
}

function verifyCronAuth(req: NextRequest): { ok: true } | { ok: false; reason: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn('[cron] CRON_SECRET not set — endpoint is unprotected.');
    return { ok: true };
  }
  const header = req.headers.get('authorization') ?? '';
  if (header === `Bearer ${secret}`) return { ok: true };
  const tokenParam = req.nextUrl.searchParams.get('token');
  if (tokenParam && tokenParam === secret) return { ok: true };
  return { ok: false, reason: 'unauthorized' };
}

function baseUrl(req: NextRequest): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return req.nextUrl.origin;
}

async function runAgentForCompany(
  origin: string,
  company: string,
  lookbackHours: number,
): Promise<AgentSearchResponse> {
  const res = await fetch(`${origin}/api/agent-search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ company, lookbackHours, excludeSeen: true }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`agent-search failed for ${company}: ${res.status} ${text}`);
  }
  return (await res.json()) as AgentSearchResponse;
}

async function sendEmail(origin: string, payload: {
  to: string; cc?: string; company: string;
  articles: AgentSearchResponse['articles'];
  keywords: string[]; executiveSummary: string;
  slotLabel: string; isEmpty: boolean;
}): Promise<{ ok: boolean; status: number; body?: unknown }> {
  const res = await fetch(`${origin}/api/send-email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, body };
}

export async function GET(req: NextRequest) {
  const auth = verifyCronAuth(req);
  if (auth.ok === false) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const slotId = req.nextUrl.searchParams.get('slot');
  const slot = getSlot(slotId);
  if (!slot) {
    return NextResponse.json({
      error: 'unknown_slot',
      provided: slotId,
      validSlots: SCHEDULE.map((s) => s.id),
    }, { status: 400 });
  }

  const origin = baseUrl(req);
  const slotLookback = slot.lookbackHours ?? getLookbackHours();
  const startedAt = new Date().toISOString();
  const perCompany: Array<Record<string, unknown>> = [];

  // Sequential — keeps concurrent token use predictable, gives each company
  // its full share of maxDuration headroom.
  //
  // Duplicate-article prevention is handled by per-slot lookbackHours
  // (see config/schedule.ts): send 1 looks back 72h, sends 2 and 3 look
  // back ~6h, so the same article rarely appears in two same-day sends.
  for (const company of slot.companies) {
    const companyStart = Date.now();
    try {
      const agent = await runAgentForCompany(origin, company, slotLookback);

      const filtered = applyFreshness(agent.articles ?? [], slotLookback);
      const articles = filtered.kept;
      const isEmpty = articles.length === 0;

      const { to, cc } = resolveRecipients(company);
      if (to.length === 0) {
        perCompany.push({
          company,
          status: 'skipped_no_recipients',
          articleCount: articles.length,
          isEmpty,
          ms: Date.now() - companyStart,
        });
        continue;
      }

      const emailRes = await sendEmail(origin, {
        to: to.join(', '),
        cc: cc.length ? cc.join(', ') : undefined,
        company,
        articles,
        keywords: agent.keywordsUsed ?? [],
        executiveSummary: isEmpty
          ? `No significant ${company} news in the last ${slotLookback} hours.`
          : agent.executiveSummary,
        slotLabel: slot.label,
        isEmpty,
      });

      // Mark URLs as sent ONLY after the email succeeded — a failed email
      // should NOT mark articles seen, so the next cron retries them.
      if (emailRes.ok && articles.length > 0) {
        try {
          await markSent(company, articles.map((a) => a.link));
        } catch (err) {
          // Non-fatal — log and continue. Next run may resend, which is
          // acceptable degraded behavior.
          console.warn(`[cron] markSent failed for ${company}:`, err);
        }
      }

      const stats = (agent.stats as Record<string, unknown> | undefined) ?? {};
      perCompany.push({
        company,
        status: emailRes.ok ? 'sent' : 'email_failed',
        articleCount: articles.length,
        alreadySeenSkipped: stats.alreadySeenSkipped ?? 0,
        droppedByDomain: stats.droppedByDomain ?? 0,
        droppedByStockPattern: stats.droppedByStockPattern ?? 0,
        droppedByNonUS: stats.droppedByNonUS ?? 0,
        isEmpty,
        recipients: { to, cc },
        emailStatus: emailRes.status,
        ms: Date.now() - companyStart,
      });
    } catch (err) {
      perCompany.push({
        company,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        ms: Date.now() - companyStart,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    slot: slot.id,
    label: slot.label,
    startedAt,
    finishedAt: new Date().toISOString(),
    lookbackHours: slotLookback,
    results: perCompany,
  });
}

export const POST = GET;
