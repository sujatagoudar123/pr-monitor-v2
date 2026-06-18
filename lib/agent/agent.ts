/**
 * Agent loop — Claude decides which sources to call, in what order.
 * Uses Anthropic's tool-use API.
 *
 * Required-sources policy: the agent is NOT allowed to call `finalize`
 * until it has called at least RSS + Google News + scrape_publications.
 * This prevents premature stopping with too few articles.
 *
 * Hard caps: MAX_ITERATIONS, MAX_TOOL_CALLS (raised from 8 to 10).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Article, Company, SourceType } from '@/lib/types';
import { searchRss } from '@/lib/sources/rss';
import { searchGoogleNews } from '@/lib/sources/google-news';
import { searchNewsApi, newsApiAvailable } from '@/lib/sources/newsapi';
import { searchBingNews, bingNewsAvailable } from '@/lib/sources/bing-news';
import { scrapePublications } from '@/lib/sources/scrape';

const MAX_ITERATIONS = 14;
const MAX_TOOL_CALLS = 14;
const REQUIRED_SOURCES: SourceType[] = ['rss', 'google_news', 'scrape'];

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_rss_feeds',
    description: 'Search the curated RSS feeds for this company. Already filtered to the last 72 hours at parse time. REQUIRED before finalize.',
    input_schema: {
      type: 'object',
      properties: {
        extra_terms: {
          type: 'array', items: { type: 'string' },
          description: 'Optional product names or topics to narrow the feed results.',
        },
      },
    },
  },
  {
    name: 'search_google_news',
    description: 'Broad coverage from Google News RSS. No key required. Constrained to last 72h via when:Nd operator. REQUIRED before finalize.',
    input_schema: {
      type: 'object',
      properties: {
        extra_terms: {
          type: 'array', items: { type: 'string' },
          description: 'Extra terms to OR with the company name.',
        },
      },
    },
  },
  {
    name: 'search_newsapi',
    description: 'NewsAPI.org search. Already constrained to last 72h via from= parameter. May not be available if no API key is set.',
    input_schema: {
      type: 'object',
      properties: {
        extra_terms: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'search_bing_news',
    description: 'Bing News v7 search. Already constrained via freshness parameter. May not be available if no API key is set.',
    input_schema: {
      type: 'object',
      properties: {
        extra_terms: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'scrape_publications',
    description: 'Sweep HTML of FiercePharma, STAT, Endpoints, Auto News for recent headlines mentioning the company. Pages do not expose publish dates, so results are marked undated and kept through the freshness filter. REQUIRED before finalize.',
    input_schema: {
      type: 'object',
      properties: {
        extra_terms: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'finalize',
    description: 'Stop gathering and proceed to ranking. ONLY allowed after rss + google_news + scrape have all been called at least once.',
    input_schema: {
      type: 'object',
      properties: {
        rationale: { type: 'string', description: 'Why you decided to stop here.' },
      },
      required: ['rationale'],
    },
  },
];

interface AgentResult {
  articles: Article[];
  sourcesUsed: SourceType[];
  trace: string[];
}

export async function runAgentLoop(
  client: Anthropic,
  model: string,
  company: Company,
): Promise<AgentResult> {
  const pool: Article[] = [];
  const sourcesUsed = new Set<SourceType>();
  const trace: string[] = [];
  let toolCallCount = 0;

  // Split keywords for the agent's reference. The agent should focus extra_terms
  // searches on company-specific terms (products/people/brands), not generic ones,
  // because generic terms produce noise.
  const GENERIC = new Set([
    // Pharma generic (GSK)
    'pharmaceutical', 'biotech', 'pharma', 'vaccine', 'vaccines',
    'respiratory', 'meningitis', 'shingles',
    'flu', 'influenza',
    // Generic drug/cancer (BeOne)
    'cancer', 'drug', 'drugs', 'oncology',
    // Amgen disease franchises
    'gout', 'thyroid eye', 'thyroid eye disease', 'ted',
    "sjögren", "sjogren", "sjögren's", "sjogren's",
    // HVAC generic (none in current Trane list but reserved)
    'hvac', 'refrigeration', 'sustainability', 'cooling',
    // Indivior healthcare-worker categories + indication
    'doctor', 'nurse', 'pharmacist', 'physician', 'psychiatrist',
    'practitioner', 'anesthesiologist', 'surgeon',
    'opioid use disorder', 'oud', 'addiction treatment',
    // Otsuka drug-pricing policy
    'drug price', 'drug prices', 'drug pricing', 'drug cost', 'drug costs',
    'price negotiation',
    'most favored nation', 'most-favored nation', 'most-favored-nation', 'mfn',
    '340b',
    'psychedelic', 'psychedelics',
  ]);
  const specificKeywords = company.keywords.filter((k) => !GENERIC.has(k.toLowerCase().trim()));
  const genericKeywords = company.keywords.filter((k) => GENERIC.has(k.toLowerCase().trim()));

  const systemMsg =
    `You are a research agent for a PR monitoring tool. Your job: gather articles about "${company.name}" from the LAST 72 HOURS only.\n\n` +
    `ALL KEYWORDS BELOW ARE EQUALLY IMPORTANT — every keyword should drive at least one search. An article matching "meningitis" is just as valid as one matching "GSK" or "Shingrix", as long as it's news (not a generic explainer).\n\n` +
    `COMPANY-SPECIFIC KEYWORDS (use these as extra_terms — each unambiguously refers to ${company.name}):\n` +
    `${specificKeywords.map((k) => `  - ${k}`).join('\n')}\n\n` +
    (genericKeywords.length
      ? `CATEGORY / FRANCHISE KEYWORDS (search these directly too — bare-keyword Google News queries surface news events like "Meningitis Vaccine Rollout", "Shingles Vaccine Effectiveness Study", etc. You may also combine them with words like "outbreak", "vaccination", "approval", "FDA", "CDC" to find more news in ${company.name}'s market — VERY IMPORTANT to cover ALL of these):\n${genericKeywords.map((k) => `  - ${k}`).join('\n')}\n\n`
      : '') +
    `Available sources at runtime:\n` +
    `  - search_rss_feeds        (always — REQUIRED)\n` +
    `  - search_google_news      (always — REQUIRED)\n` +
    `  - search_newsapi          (${newsApiAvailable() ? 'available' : 'NO KEY — do not call'})\n` +
    `  - search_bing_news        (${bingNewsAvailable() ? 'available' : 'NO KEY — do not call'})\n` +
    `  - scrape_publications     (always — REQUIRED)\n\n` +
    `SEARCH STRATEGY (be thorough — you have ${MAX_TOOL_CALLS} tool calls):\n` +
    `1. Iter 0: company name only (e.g. "${company.name}"). Calls RSS + Google News + scrape in parallel.\n` +
    `2. Iter 1: pick 3-5 COMPANY-SPECIFIC keywords (products, people, brands) as extra_terms.\n` +
    `3. Iter 2: pick 3-5 DIFFERENT company-specific keywords (cycle through them so all get covered).\n` +
    `4. Iter 3+: for CATEGORY/DISEASE terms above, use Google News with the term PAIRED with a news-context word, e.g. extra_terms=["meningitis outbreak", "RSV approval", "shingles vaccine drive"]. Do NOT pass them alone.\n` +
    `5. You MUST call search_rss_feeds, search_google_news, AND scrape_publications at least once before finalizing.\n` +
    `6. Aim for 100+ raw articles across all sources before finalizing.\n` +
    `7. Hard cap: ${MAX_TOOL_CALLS} tool calls total.`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Research "${company.name}" for today's brief. Use ALL required tools, cycle through company-specific keywords, AND search for category/disease terms paired with news-context words (outbreak, approval, drive, FDA, CDC) to catch market news that doesn't name the company. Then finalize.` },
  ];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (toolCallCount >= MAX_TOOL_CALLS) {
      trace.push(`[iter ${iter}] Hit tool-call cap (${MAX_TOOL_CALLS}). Finalizing.`);
      break;
    }

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemMsg,
      tools: TOOLS,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      trace.push(`[iter ${iter}] Agent stopped without finalize (stop_reason=${response.stop_reason}).`);
      break;
    }

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (toolUses.length === 0) break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let didFinalize = false;

    for (const tu of toolUses) {
      toolCallCount += 1;
      const input = (tu.input ?? {}) as { extra_terms?: string[]; rationale?: string };
      const extra = Array.isArray(input.extra_terms) ? input.extra_terms : [];

      let newArticles: Article[] = [];
      let resultSummary = '';
      let sourceTag: SourceType | null = null;

      try {
        switch (tu.name) {
          case 'search_rss_feeds':
            newArticles = await searchRss(company, extra);
            sourceTag = 'rss';
            break;
          case 'search_google_news':
            newArticles = await searchGoogleNews(company.name, extra);
            sourceTag = 'google_news';
            break;
          case 'search_newsapi':
            newArticles = await searchNewsApi(company.name, extra);
            sourceTag = 'newsapi';
            break;
          case 'search_bing_news':
            newArticles = await searchBingNews(company.name, extra);
            sourceTag = 'bing_news';
            break;
          case 'scrape_publications':
            newArticles = await scrapePublications(company.name, extra, company.scrapeTargets ?? []);
            sourceTag = 'scrape';
            break;
          case 'finalize': {
            // Enforce required-sources policy
            const missing = REQUIRED_SOURCES.filter((s) => !sourcesUsed.has(s));
            if (missing.length > 0) {
              resultSummary = `REJECTED finalize. You still need to call: ${missing.join(', ')}. Call them first.`;
              trace.push(`[iter ${iter}] finalize REJECTED — missing required sources: ${missing.join(', ')}`);
            } else {
              didFinalize = true;
              resultSummary = `Finalized. ${input.rationale ?? ''}`;
              trace.push(`[iter ${iter}] Agent finalized: ${input.rationale ?? '(no rationale)'}`);
            }
            break;
          }
          default:
            resultSummary = `Unknown tool ${tu.name}`;
        }

        if (sourceTag) {
          pool.push(...newArticles);
          sourcesUsed.add(sourceTag);
          const sampleTitles = newArticles.slice(0, 3).map((a) => `"${a.title.slice(0, 80)}"`).join('; ');
          const stillMissing = REQUIRED_SOURCES.filter((s) => !sourcesUsed.has(s));
          resultSummary =
            `Got ${newArticles.length} articles from ${sourceTag}. ` +
            `Total pool now ${pool.length}. ` +
            (sampleTitles ? `Sample: ${sampleTitles}. ` : '') +
            (stillMissing.length ? `Still need to call: ${stillMissing.join(', ')}.` : `All required sources have been called — finalize when ready.`);
          trace.push(`[iter ${iter}] tool=${tu.name} got=${newArticles.length} pool=${pool.length}`);
        }
      } catch (err) {
        resultSummary = `Tool ${tu.name} threw: ${err instanceof Error ? err.message : String(err)}`;
        trace.push(`[iter ${iter}] tool=${tu.name} ERROR: ${resultSummary}`);
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: resultSummary,
      });
    }

    messages.push({ role: 'user', content: toolResults });

    if (didFinalize) break;
  }

  // Safety net: if the agent ran out of iterations without calling all required sources,
  // call the missing ones directly so we never under-gather.
  const missing = REQUIRED_SOURCES.filter((s) => !sourcesUsed.has(s));
  if (missing.length > 0) {
    trace.push(`[safety-net] agent missed required sources: ${missing.join(', ')} — calling directly`);
    try {
      const tasks: Promise<Article[]>[] = [];
      if (missing.includes('rss')) tasks.push(searchRss(company));
      if (missing.includes('google_news')) tasks.push(searchGoogleNews(company.name));
      if (missing.includes('scrape')) tasks.push(scrapePublications(company.name, [], company.scrapeTargets ?? []));
      const got = await Promise.all(tasks);
      got.forEach((arr, i) => {
        pool.push(...arr);
        sourcesUsed.add(missing[i]);
        trace.push(`[safety-net] ${missing[i]} returned ${arr.length} articles (pool=${pool.length})`);
      });
    } catch { /* ignore */ }
  }

  // -------------------------------------------------------------------------
  // KEYWORD-COVERAGE SWEEP — runs AFTER the agent.
  //
  // PROBLEM (analyst oral feedback, June 2026):
  //   "not all articles cover all keyword if otsuka then its mainly covering
  //    otsuka n few more give keyword but not all its same for all"
  //
  //   i.e. the agent has discretion and picks only ~3-5 keywords. With 15-33
  //   keywords per company, most never get searched and never reach the
  //   ranker, so the email is dominated by company-name hits.
  //
  // SOLUTION: a deterministic sweep that GUARANTEES every company keyword
  //   gets at least one Google News query.
  //
  //   * Each SPECIFIC keyword → searched as-is (e.g. "Shingrix", "Bexsero")
  //   * Each CATEGORY keyword → paired with a news-context word to avoid
  //     drowning in wellness articles (e.g. "meningitis outbreak",
  //     "MFN approval", "drug pricing FDA")
  //   * Batched in groups of 3 for concurrency + Google News rate limits
  // -------------------------------------------------------------------------
  trace.push(`[sweep] starting keyword-coverage sweep across ${company.keywords.length} keywords`);
  // EQUAL-PREFERENCE SWEEP (per analyst direction, June 2026):
  // Every keyword — whether company-specific (Shingrix, Bexsero, Modern Family)
  // or category (meningitis, shingles, vaccine, Flu) — gets EXACTLY ONE direct
  // Google News query. No special treatment, no paired queries, no rotation.
  //
  // Why this is safe:
  //   - Fewer queries than the previous version (GSK 42 → 33, Otsuka 27 → 15,
  //     Indivior 26 → 15). Total drops from 132 to 94 per cron cycle.
  //   - Cron stays well within the 300s Vercel maxDuration.
  //   - Google News already ranks bare-keyword searches by recency and
  //     relevance, so direct `meningitis` surfaces real meningitis news
  //     (vaccine rollouts, outbreaks, alerts) without needing paired terms.
  //   - The ranker's news-context check still drops pure explainers
  //     ("What is meningitis?" wellness pieces score 0.3 → below threshold).
  //
  // History (do NOT regress without re-budgeting):
  //   - June 17: tried "direct for every keyword PLUS 2 paired for category"
  //     (GSK 51 queries). Pushed cron past 300s → 504 timeouts → no emails.
  //   - This version: just direct queries, no extras.
  const sweepQueries: { term: string; label: string }[] = [];
  for (const kw of company.keywords) {
    if (kw.toLowerCase() === company.name.toLowerCase()) continue;
    sweepQueries.push({ term: kw, label: `direct:${kw}` });
  }

  const BATCH_SIZE = 3;
  let sweepArticleCount = 0;
  for (let i = 0; i < sweepQueries.length; i += BATCH_SIZE) {
    const batch = sweepQueries.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((q) => searchGoogleNews(company.name, [q.term])),
    );
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        pool.push(...r.value);
        sweepArticleCount += r.value.length;
        trace.push(`[sweep] ${batch[idx].label} -> +${r.value.length} (pool=${pool.length})`);
      } else {
        trace.push(`[sweep] ${batch[idx].label} FAILED: ${r.reason}`);
      }
    });
  }
  trace.push(`[sweep] complete — ${sweepArticleCount} articles added across ${sweepQueries.length} queries`);

  return {
    articles: pool,
    sourcesUsed: Array.from(sourcesUsed),
    trace,
  };
}
