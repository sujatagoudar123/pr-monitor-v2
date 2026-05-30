/**
 * Ranking — Claude reads each article and assigns a relevance score.
 *
 * Strict rules baked into the prompt:
 *   - For relevance ≥ 0.5, the article MUST mention the company name OR
 *     a brand/product/person from the keyword list (these are the
 *     "company-specific" keywords).
 *   - Articles that only match generic industry terms (e.g. "HVAC",
 *     "vaccine", "drug pricing" without naming the company) are
 *     capped at 0.3 and dropped.
 *
 * Batched (25 per call) for token efficiency.
 * Falls back to regex if the LLM call fails.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Article } from '@/lib/types';

const BATCH_SIZE = 25;
const MIN_RELEVANCE = 0.4;

/**
 * Generic industry / category terms that should NOT alone justify a high
 * relevance score. These are kept in keyword lists for query breadth, but
 * the ranker downweights articles that match only these without naming
 * the company itself.
 */
const GENERIC_INDUSTRY_TERMS = new Set([
  // Pharma generic
  'pharmaceutical', 'biotech', 'pharma', 'vaccine', 'vaccines',
  'drug', 'drugs', 'cancer', 'oncology', 'flu', 'influenza',
  'respiratory', 'meningitis', 'shingles',
  // HVAC generic
  'hvac', 'refrigeration', 'sustainability', 'cooling',
  // Healthcare worker categories (Indivior uses these but they're generic)
  'doctor', 'nurse', 'pharmacist', 'physician', 'psychiatrist',
  'practitioner', 'anesthesiologist', 'surgeon',
  // Drug-pricing policy generic
  'drug price', 'drug prices', 'drug pricing', 'drug cost', 'drug costs',
]);

function isCompanySpecific(keyword: string): boolean {
  return !GENERIC_INDUSTRY_TERMS.has(keyword.toLowerCase().trim());
}

function regexFallback(article: Article, keywords: string[], companyName: string): {
  relevance: number; matched: string[]; why: string;
} {
  const hay = `${article.title} ${article.snippet ?? ''}`.toLowerCase();
  const matched = keywords.filter((k) => hay.includes(k.toLowerCase()));
  if (matched.length === 0) {
    return { relevance: 0, matched: [], why: 'No direct keyword matches found.' };
  }
  // Distinguish company-specific matches from generic ones
  const specific = matched.filter(isCompanySpecific);
  const namedMention = hay.includes(companyName.toLowerCase()) || specific.length > 0;
  // Generic-only matches stay below the 0.4 cutoff so they get dropped
  const relevance = namedMention
    ? Math.min(0.6 + 0.1 * specific.length, 0.9)
    : 0.3;
  const why = namedMention
    ? `Matched company-specific terms: ${specific.slice(0, 4).join(', ') || matched.slice(0, 2).join(', ')}.`
    : `Only matched generic industry terms (${matched.slice(0, 3).join(', ')}); no direct company/product mention.`;
  return { relevance, matched, why };
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

  // Split keywords into company-specific vs generic so the prompt can
  // tell Claude which ones justify a high score on their own.
  const specificKeywords = keywords.filter(isCompanySpecific);
  const genericKeywords = keywords.filter((k) => !isCompanySpecific(k));

  const prompt = `You are evaluating news articles for relevance to a PR monitoring brief about "${company}".

COMPANY-SPECIFIC KEYWORDS (each one unambiguously refers to the company, its products, brands, or key people):
${specificKeywords.map((k) => `  - ${k}`).join('\n')}

GENERIC INDUSTRY TERMS (these alone are NOT enough — articles must also mention the company or a specific keyword to score high):
${genericKeywords.map((k) => `  - ${k}`).join('\n') || '  (none)'}

SCORING RULES (follow these strictly):
- 1.0 = directly about ${company}'s business, products, leadership, regulatory actions, or material news. Company name or a company-specific keyword appears prominently in the title or first sentence.
- 0.7–0.9 = clearly about ${company} or one of its products/brands/people, even if other topics are also discussed.
- 0.5–0.6 = mentions ${company} or a company-specific keyword somewhere in the article, but the article is primarily about something else.
- 0.3 = matches only GENERIC industry terms (e.g. "HVAC", "drug pricing", "vaccine") WITHOUT naming ${company} or a company-specific keyword. DROP THESE.
- 0.0 = unrelated.

CRITICAL RULE: If the article does NOT mention "${company}" (or a close variant like "${company}'s") AND does NOT mention any of the COMPANY-SPECIFIC keywords above, the score MUST be ≤ 0.3.

For each article, list which keywords/topics actually appear, and write ONE short sentence explaining the score.

Articles to evaluate:
${JSON.stringify(articlesForLlm)}

Respond with ONLY a JSON array, no prose, no markdown fences. Format:
[{"i": 0, "relevance": 0.95, "matched": ["GSK","Shingrix"], "why": "Reports GSK Q3 vaccine sales beat."}]`;

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
        const r = regexFallback(a, keywords, company);
        return { index: i, relevance: r.relevance, matched: r.matched, why: r.why };
      });
    }

    const byIndex = new Map<number, RankResult>();
    for (const r of results) byIndex.set(r.index, r);

    batch.forEach((a, i) => {
      const r = byIndex.get(i) ?? regexFallback(a, keywords, company);
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
