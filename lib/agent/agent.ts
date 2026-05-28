/**
 * Agent loop — Claude decides which sources to call, in what order.
 * Uses Anthropic's tool-use API. Up to 10 iterations, 8 tool calls.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Article, Company, SourceType } from '@/lib/types';
import { searchRss } from '@/lib/sources/rss';
import { searchGoogleNews } from '@/lib/sources/google-news';
import { searchNewsApi, newsApiAvailable } from '@/lib/sources/newsapi';
import { searchBingNews, bingNewsAvailable } from '@/lib/sources/bing-news';
import { scrapePublications } from '@/lib/sources/scrape';

const MAX_ITERATIONS = 10;
const MAX_TOOL_CALLS = 8;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_rss_feeds',
    description: 'Search the curated RSS feeds for this company. Cheap, fast, high-precision.',
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
    description: 'Broad coverage from Google News RSS. No key required. Constrained to last 3 days at the source.',
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
    description: 'NewsAPI.org search. May not be available if no API key is set — check the system message.',
    input_schema: {
      type: 'object',
      properties: {
        extra_terms: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'search_bing_news',
    description: 'Bing News v7 search. May not be available if no API key is set.',
    input_schema: {
      type: 'object',
      properties: {
        extra_terms: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'scrape_publications',
    description: 'Sweep HTML pages of FiercePharma, STAT, Endpoints, Auto News for headlines mentioning the company. Slowest source.',
    input_schema: {
      type: 'object',
      properties: {
        extra_terms: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'finalize',
    description: 'Stop gathering and proceed to ranking. Call this when you have enough articles.',
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
    `You are a research agent for a PR monitoring tool. Your job: gather articles about "${company.name}" from multiple sources.\n\n` +
    `Keywords/topics the user cares about:\n${company.keywords.map((k) => `  - ${k}`).join('\n')}\n\n` +
    `Available sources at runtime:\n` +
    `  - search_rss_feeds (always)\n` +
    `  - search_google_news (always, no key)\n` +
    `  - search_newsapi (${newsApiAvailable() ? 'available' : 'NO KEY — do not call'})\n` +
    `  - search_bing_news (${bingNewsAvailable() ? 'available' : 'NO KEY — do not call'})\n` +
    `  - scrape_publications (always)\n\n` +
    `Strategy: start with the cheapest/broadest sources (rss + google_news), inspect what came back, then decide if you need more breadth. ` +
    `Use extra_terms with product/brand names from the keyword list when a source returns too little. ` +
    `Call finalize when you have enough articles (typically 100+ across at least 2 sources is plenty). ` +
    `Hard cap: ${MAX_TOOL_CALLS} tool calls total.`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Research "${company.name}" today. Use the tools to gather articles, then call finalize.` },
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
          case 'finalize':
            didFinalize = true;
            resultSummary = `Finalized. ${input.rationale ?? ''}`;
            trace.push(`[iter ${iter}] Agent finalized: ${input.rationale ?? '(no rationale)'}`);
            break;
          default:
            resultSummary = `Unknown tool ${tu.name}`;
        }

        if (sourceTag && newArticles.length >= 0) {
          pool.push(...newArticles);
          sourcesUsed.add(sourceTag);
          const sampleTitles = newArticles.slice(0, 3).map((a) => `"${a.title}"`).join('; ');
          resultSummary =
            `Got ${newArticles.length} articles from ${sourceTag}. ` +
            `Total pool now ${pool.length}. ` +
            (sampleTitles ? `Sample: ${sampleTitles}` : '');
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

  if (sourcesUsed.size === 0 || pool.length === 0) {
    // Defensive: if the agent didn't call anything, fall back to running both broad sources.
    trace.push('[fallback] agent gathered nothing, running rss + google_news directly');
    try {
      const [r, g] = await Promise.all([
        searchRss(company),
        searchGoogleNews(company.name),
      ]);
      pool.push(...r, ...g);
      if (r.length) sourcesUsed.add('rss');
      if (g.length) sourcesUsed.add('google_news');
    } catch { /* ignore */ }
  }

  return {
    articles: pool,
    sourcesUsed: Array.from(sourcesUsed),
    trace,
  };
}
