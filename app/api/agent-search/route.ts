/**
 * POST /api/agent-search
 *
 * Body: { company: "GSK" }
 *
 * Runs the agent loop, dedupes, ranks, applies 72h freshness, writes summary.
 * Returns full result + agent trace.
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
    // 1) Agent gathers
    const { articles: gathered, sourcesUsed, trace } = await runAgentLoop(client, model, company);
    const totalGathered = gathered.length;

    // 2) Dedupe
    const deduped = dedupeArticles(gathered);
    const afterDedupe = deduped.length;

    // 3) Rank
    const ranked = await rankArticles(client, model, company.name, company.keywords, deduped);
    const afterRanking = ranked.length;

    // 4) Apply freshness — 72h window, undated articles kept and flagged
    const freshness = applyFreshness(ranked, lookbackHours);
    const articles = freshness.kept;

    // 5) Executive summary
    const executiveSummary = await writeExecutiveSummary(client, model, company.name, articles);

    return NextResponse.json({
      company: company.name,
      keywordsUsed: company.keywords,
      executiveSummary,
      articles,
      stats: {
        totalGathered,
        afterDedupe,
        afterRanking,
        lookbackHours,
        beforeFreshness: freshness.stats.total,
        afterFreshness: freshness.stats.kept,
        droppedAsStale: freshness.stats.dropped,
        undated: freshness.stats.undated,
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
