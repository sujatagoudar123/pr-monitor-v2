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

const MAX_ITERATIONS = 12;
const MAX_TOOL_CALLS = 10;
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

  const systemMsg =
    `You are a research agent for a PR monitoring tool. Your job: gather articles about "${company.name}" from the LAST 72 HOURS only.\n\n` +
    `Keywords/topics the user cares about:\n${company.keywords.map((k) => `  - ${k}`).join('\n')}\n\n` +
    `Available sources at runtime:\n` +
    `  - search_rss_feeds        (always — REQUIRED)\n` +
    `  - search_google_news      (always — REQUIRED)\n` +
    `  - search_newsapi          (${newsApiAvailable() ? 'available' : 'NO KEY — do not call'})\n` +
    `  - search_bing_news        (${bingNewsAvailable() ? 'available' : 'NO KEY — do not call'})\n` +
    `  - scrape_publications     (always — REQUIRED)\n\n` +
    `RULES:\n` +
    `1. All sources already filter to the last 72 hours at the source. You don't need to worry about freshness — just gather widely.\n` +
    `2. You MUST call search_rss_feeds, search_google_news, AND scrape_publications at least once before you are allowed to call finalize.\n` +
    `3. If a required source returns few articles, use extra_terms (product/brand names from the keyword list) and retry once.\n` +
    `4. Hard cap: ${MAX_TOOL_CALLS} tool calls total.\n` +
    `5. After all required sources have been called, evaluate breadth and call finalize when you have meaningful coverage (typically 50+ raw articles across sources).`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Research "${company.name}" for today's brief. Use ALL required tools (rss, google_news, scrape), then finalize.` },
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

  return {
    articles: pool,
    sourcesUsed: Array.from(sourcesUsed),
    trace,
  };
}
