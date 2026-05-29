/**
 * POST /api/agent-search
 *
 * Body: { company: "GSK" }
 *
 * Pipeline (in this order):
 *   1. Agent loop gathers from all required sources (each filtered to 72h at source)
 *   2. Dedupe by URL + title
 *   3. Apply 72h freshness filter (defensive — sources already filter, but dates can lie)
 *   4. Claude ranks each surviving article 0.0–1.0 (batches of 25)
 *   5. Drop ranked articles below MIN_RELEVANCE (0.4)
 *   6. Claude writes 2–3 sentence executive summary
 *
 * Freshness moved BEFORE ranking so we don't waste tokens scoring stale articles.
 */

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getCompany } from '@/data/companies';
import { runAgentLoop } from '@/lib/agent/agent';
import { dedupeArticles } from '@/lib/agent/dedupe';
import { rankArticles, writeExecutiveSummary } from '@/lib/agent/rank';
import { applyFreshness, getLookbackHours } from '@/lib/freshness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
  }

  let body: { company?: string };
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
  const lookbackHours = getLookbackHours();

  try {
    // 1) Agent gathers from all required sources
    const { articles: gathered, sourcesUsed, trace } = await runAgentLoop(client, model, company);
    const totalGathered = gathered.length;

    // 2) Dedupe
    const deduped = dedupeArticles(gathered);
    const afterDedupe = deduped.length;

    // 3) Freshness filter (BEFORE ranking — saves LLM tokens on stale articles)
    const freshness = applyFreshness(deduped, lookbackHours);
    const fresh = freshness.kept;

    // 4) Rank only the fresh articles
    const ranked = await rankArticles(client, model, company.name, company.keywords, fresh);
    const afterRanking = ranked.length;

    // 5) Final list — already sorted by relevance descending by rankArticles
    const articles = ranked;

    // 6) Executive summary
    const executiveSummary = await writeExecutiveSummary(client, model, company.name, articles);

    return NextResponse.json({
      company: company.name,
      keywordsUsed: company.keywords,
      executiveSummary,
      articles,
      stats: {
        totalGathered,
        afterDedupe,
        lookbackHours,
        afterFreshness: fresh.length,
        droppedAsStale: freshness.stats.dropped,
        undated: freshness.stats.undated,
        afterRanking,
        sourcesUsed,
      },
      trace,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Agent failed' },
      { status: 500 },
    );
  }
}
