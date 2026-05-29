/**
 * Ranking — Claude reads each article and assigns:
 *   - relevance score 0.0–1.0
 *   - which of the keywords actually matched
 *   - a one-sentence rationale
 *
 * Batched (25 per call) for token efficiency.
 * Falls back to regex keyword matching if the LLM fails.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Article } from '@/lib/types';

const BATCH_SIZE = 25;
const MIN_RELEVANCE = 0.4;

function regexFallback(article: Article, keywords: string[]): {
  relevance: number; matched: string[]; why: string;
} {
  const hay = `${article.title} ${article.snippet ?? ''}`.toLowerCase();
  const matched = keywords.filter((k) => hay.includes(k.toLowerCase()));
  const relevance = matched.length === 0 ? 0 : Math.min(0.5 + 0.1 * matched.length, 0.9);
  return {
    relevance,
    matched,
    why: matched.length
      ? `Matched keywords: ${matched.slice(0, 4).join(', ')}.`
      : 'No direct keyword matches found.',
  };
}

interface RankResult {
  index: number;
  relevance: number;
  matched: string[];
  why: string;
}

async function rankBatch(
  client: Anthropic,
  model: string,
  company: string,
  keywords: string[],
  batch: Article[],
): Promise<RankResult[]> {
  const articlesForLlm = batch.map((a, i) => ({
    i,
    title: a.title,
    source: a.source,
    snippet: (a.snippet ?? '').slice(0, 240),
  }));

  const prompt = `You are evaluating news articles for relevance to a PR monitoring brief about "${company}".

The user cares about these keywords/topics:
${keywords.map((k) => `  - ${k}`).join('\n')}

Score each article from 0.0 (irrelevant) to 1.0 (must-read). A 1.0 means the article is directly about ${company}'s business, products, leadership, or material news. A 0.5 means it mentions ${company} in passing but is mostly about something else. A 0.0 means it's unrelated.

For each article, also list which of the keywords/topics actually appear, and write ONE sentence explaining why you scored it that way.

Articles to evaluate:
${JSON.stringify(articlesForLlm)}

Respond with ONLY a JSON array, no prose, no markdown fences. Format:
[{"i": 0, "relevance": 0.95, "matched": ["GSK","Vaccine"], "why": "Reports on GSK Q3 vaccine sales."}]`;

  const res = await client.messages.create({
    model,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract text content
  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('')
    .trim();

  // Strip possible code fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed: any[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to find a JSON array embedded in the response
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (!m) throw new Error('LLM ranking did not return parseable JSON');
    parsed = JSON.parse(m[0]);
  }

  return parsed.map((r) => ({
    index: typeof r.i === 'number' ? r.i : -1,
    relevance: typeof r.relevance === 'number' ? r.relevance : 0,
    matched: Array.isArray(r.matched) ? r.matched.map(String) : [],
    why: typeof r.why === 'string' ? r.why : '',
  }));
}

export async function rankArticles(
  client: Anthropic,
  model: string,
  company: string,
  keywords: string[],
  articles: Article[],
): Promise<Article[]> {
  if (articles.length === 0) return [];

  const out: Article[] = [];

  for (let start = 0; start < articles.length; start += BATCH_SIZE) {
    const batch = articles.slice(start, start + BATCH_SIZE);
    let results: RankResult[];
    try {
      results = await rankBatch(client, model, company, keywords, batch);
    } catch {
      // Regex fallback for this batch
      results = batch.map((a, i) => {
        const r = regexFallback(a, keywords);
        return { index: i, relevance: r.relevance, matched: r.matched, why: r.why };
      });
    }

    const byIndex = new Map<number, RankResult>();
    for (const r of results) byIndex.set(r.index, r);

    batch.forEach((a, i) => {
      const r = byIndex.get(i) ?? regexFallback(a, keywords);
      const enriched: Article = {
        ...a,
        relevanceScore: r.relevance,
        matchedKeywords: r.matched ?? [],
        whyPicked: r.why ?? '',
      };
      if ((enriched.relevanceScore ?? 0) >= MIN_RELEVANCE) out.push(enriched);
    });
  }

  // Highest score first
  out.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  return out;
}

export async function writeExecutiveSummary(
  client: Anthropic,
  model: string,
  company: string,
  articles: Article[],
): Promise<string> {
  if (articles.length === 0) {
    return `No significant ${company} news found in the lookback window.`;
  }
  const top = articles.slice(0, 12).map((a) => `- ${a.title} (${a.source}): ${a.whyPicked ?? ''}`).join('\n');
  const prompt = `Write a 2–3 sentence executive briefing on today's ${company} news, suitable for a senior PR client. Lead with the most material story. Be concrete. No fluff, no hedging.

Top articles:
${top}

Respond with only the briefing paragraph, no preamble.`;

  try {
    const res = await client.messages.create({
      model,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('')
      .trim();
    return text || `Coverage of ${company} today centers on ${articles[0].title}.`;
  } catch {
    return `Coverage of ${company} today centers on ${articles[0].title}.`;
  }
}
