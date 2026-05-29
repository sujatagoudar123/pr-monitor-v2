/**
 * POST /api/agent-search
 *
 * Body: {
 *   company: "GSK",
 *   lookbackHours?: number   // optional override of the FRESHNESS_HOURS env var
 * }
 *
 * Pipeline:
 *   1. Agent loop gathers from required sources (each filtered at source)
 *   2. Dedupe by URL + title
 *   3. Apply freshness filter (defensive)
 *   4. Rank ranked articles 0.0-1.0
 *   5. Drop below MIN_RELEVANCE
 *   6. Write executive summary
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

  let body: { company?: string; lookbackHours?: number };
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
  // Use override from body if provided (cron passes per-slot lookback), else env var
  const lookbackHours =
    typeof body.lookbackHours === 'number' && body.lookbackHours > 0
      ? body.lookbackHours
      : getLookbackHours();

  // Set FRESHNESS_HOURS for this request's lifetime so source connectors
  // (rss/google-news/newsapi/bing) all pick up the per-slot value.
  const previousEnv = process.env.FRESHNESS_HOURS;
  process.env.FRESHNESS_HOURS = String(lookbackHours);

  try {
    // 1) Agent gathers
    const { articles: gathered, sourcesUsed, trace } = await runAgentLoop(client, model, company);
    const totalGathered = gathered.length;

    // 2) Dedupe
    const deduped = dedupeArticles(gathered);
    const afterDedupe = deduped.length;

    // 3) Freshness (defensive — sources already filter)
    const freshness = applyFreshness(deduped, lookbackHours);
    const fresh = freshness.kept;

    // 4) Rank
    const ranked = await rankArticles(client, model, company.name, company.keywords, fresh);

    // 5) Summary
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
        afterFreshness: fresh.length,
        droppedAsStale: freshness.stats.dropped,
        undated: freshness.stats.undated,
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
    // Restore env so concurrent requests don't see our override
    if (previousEnv === undefined) delete process.env.FRESHNESS_HOURS;
    else process.env.FRESHNESS_HOURS = previousEnv;
  }
}
