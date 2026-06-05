/**
 * POST /api/agent-search
 *
 * Body: {
 *   company: "GSK",
 *   lookbackHours?: number,    // optional override of FRESHNESS_HOURS env var
 *   excludeSeen?: boolean,     // optional — when true, drops articles already
 *                                 sent in previous cron runs (cron sends pass
 *                                 this; manual UI searches do NOT).
 * }
 *
 * Pipeline:
 *   1. Agent loop gathers from required sources (each filtered at source)
 *   2. Dedupe by URL + title
 *   3. Apply freshness filter (defensive — sources already filter)
 *   4. Filter out previously-sent articles (only when excludeSeen=true)
 *   5. Rank remaining articles 0.0-1.0
 *   6. Drop below MIN_RELEVANCE
 *   7. Write executive summary
 *
 * Seen-items filter runs BEFORE ranking so the LLM never spends tokens on
 * articles that won't be sent.
 */

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getCompany } from '@/data/companies';
import { runAgentLoop } from '@/lib/agent/agent';
import { dedupeArticles } from '@/lib/agent/dedupe';
import { rankArticles, writeExecutiveSummary } from '@/lib/agent/rank';
import { applyFreshness, getLookbackHours } from '@/lib/freshness';
import { filterUnseen } from '@/lib/seen';
import { applySourceFilters } from '@/lib/filters';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
  }

  let body: { company?: string; lookbackHours?: number; excludeSeen?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const companyName = (body.company ?? '').trim();
  if (!companyName) {
    return NextResponse.json({ error: 'Field "company" is required' }, { status: 400 });
  }

  const company = getCompany(companyName);
  if (!company) {
    return NextResponse.json({ error: `Unknown company: ${companyName}` }, { status: 404 });
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const lookbackHours =
    typeof body.lookbackHours === 'number' && body.lookbackHours > 0
      ? body.lookbackHours
      : getLookbackHours();
  const excludeSeen = body.excludeSeen === true;

  const previousEnv = process.env.FRESHNESS_HOURS;
  process.env.FRESHNESS_HOURS = String(lookbackHours);

  try {
    // 1) Agent gathers
    const { articles: gathered, sourcesUsed, trace } = await runAgentLoop(client, model, company);
    const totalGathered = gathered.length;

    // 2) Dedupe
    const deduped = dedupeArticles(gathered);
    const afterDedupe = deduped.length;

    // 3) Freshness filter
    const freshness = applyFreshness(deduped, lookbackHours);
    let fresh = freshness.kept;

    // 4) Source filters — drop blocked domains (financial aggregators),
    //    stock/market-news titles, and non-US publications (with per-company
    //    UK exceptions for GSK and Otsuka). Runs BEFORE the LLM ranker so
    //    we don't waste tokens scoring articles we're going to drop.
    const filtered = applySourceFilters(fresh, company.name);
    fresh = filtered.kept;

    // 5) Seen-items filter (also BEFORE ranking).
    //    Only when caller asks (cron route). Manual UI searches show everything.
    let alreadySeenSkipped = 0;
    if (excludeSeen) {
      const seenResult = await filterUnseen(company.name, fresh);
      fresh = seenResult.unseen;
      alreadySeenSkipped = seenResult.skipped;
    }

    // 6) Rank what remains
    const ranked = await rankArticles(client, model, company.name, company.keywords, fresh);

    // 7) Summary
    const executiveSummary = await writeExecutiveSummary(client, model, company.name, ranked);

    return NextResponse.json({
      company: company.name,
      keywordsUsed: company.keywords,
      executiveSummary,
      articles: ranked,
      stats: {
        totalGathered,
        afterDedupe,
        lookbackHours,
        afterFreshness: freshness.kept.length,
        droppedAsStale: freshness.stats.dropped,
        undated: freshness.stats.undated,
        droppedByDomain: filtered.droppedByDomain,
        droppedByStockPattern: filtered.droppedByStockPattern,
        droppedByNonUS: filtered.droppedByNonUS,
        afterSourceFilters: filtered.kept.length,
        excludeSeen,
        alreadySeenSkipped,
        afterSeenFilter: fresh.length,
        afterRanking: ranked.length,
        sourcesUsed,
      },
      trace,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Agent failed' },
      { status: 500 },
    );
  } finally {
    if (previousEnv === undefined) delete process.env.FRESHNESS_HOURS;
    else process.env.FRESHNESS_HOURS = previousEnv;
  }
}
