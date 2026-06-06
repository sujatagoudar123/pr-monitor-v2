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
  // Pharma generic (GSK)
  'pharmaceutical', 'biotech', 'pharma', 'vaccine', 'vaccines',
  'respiratory', 'meningitis', 'shingles',
  'flu', 'influenza',
  // Generic drug/cancer (BeOne)
  'cancer', 'drug', 'drugs', 'oncology',
  // Amgen disease franchises
  'gout', 'thyroid eye', 'thyroid eye disease', 'ted',
  "sjögren", "sjogren", "sjögren's", "sjogren's",
  // HVAC generic
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

function isCompanySpecific(keyword: string): boolean {
  return !GENERIC_INDUSTRY_TERMS.has(keyword.toLowerCase().trim());
}

/**
 * News-context signal words. If a generic-only article has these, it likely
 * describes a real news event (outbreak, approval, regulation, drive) rather
 * than a generic explainer/wellness article.
 */
const NEWS_CONTEXT_WORDS = [
  // Events
  'outbreak', 'surge', 'spike', 'epidemic', 'pandemic', 'cluster',
  'cases', 'deaths', 'hospitalized', 'hospitalised',
  // Regulatory/clinical
  'approves', 'approved', 'approval', 'fda', 'ema', 'mhra', 'cdc', 'who',
  'guidelines', 'recommendation', 'label', 'recall', 'warning',
  // Commercial / market
  'launch', 'launches', 'launched', 'rollout', 'roll-out', 'shortage',
  'reimbursement', 'price', 'pricing', 'coverage',
  // Public-health programs
  'campaign', 'drive', 'program', 'programme', 'offered', 'vaccinate',
  'vaccination', 'jab', 'jabs',
  // Reports / data
  'report', 'study', 'trial', 'data', 'results', 'findings', 'announces',
];

function hasNewsContext(article: Article): boolean {
  const hay = `${article.title} ${article.snippet ?? ''}`.toLowerCase();
  return NEWS_CONTEXT_WORDS.some((w) => hay.includes(w));
}

function regexFallback(article: Article, keywords: string[], companyName: string): {
  relevance: number; matched: string[]; why: string;
} {
  const hay = `${article.title} ${article.snippet ?? ''}`.toLowerCase();
  const matched = keywords.filter((k) => hay.includes(k.toLowerCase()));
  if (matched.length === 0) {
    return { relevance: 0, matched: [], why: 'No direct keyword matches found.' };
  }
  const specific = matched.filter(isCompanySpecific);
  const namedMention = hay.includes(companyName.toLowerCase()) || specific.length > 0;

  if (namedMention) {
    // Strong match: company or product/person mentioned
    return {
      relevance: Math.min(0.6 + 0.1 * specific.length, 0.9),
      matched,
      why: `Matched company-specific terms: ${specific.slice(0, 4).join(', ') || matched.slice(0, 2).join(', ')}.`,
    };
  }

  // Generic-only — distinguish news event from generic explainer
  if (hasNewsContext(article)) {
    return {
      relevance: 0.5,
      matched,
      why: `News in ${companyName}'s category (${matched.slice(0, 2).join(', ')}) — outbreak, approval, or market event.`,
    };
  }
  return {
    relevance: 0.3,
    matched,
    why: `Only matched generic terms (${matched.slice(0, 3).join(', ')}) in a non-news context.`,
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
- 0.5–0.6 = (a) mentions ${company} or a company-specific keyword somewhere in the article, but the article is primarily about something else, OR (b) the article is real news directly about a disease/franchise/category from the GENERIC list (e.g. a meningitis outbreak, a vaccination drive, an RSV regulatory action) — i.e. it's news that materially affects ${company}'s market even if the company isn't named.
- 0.3 = the GENERIC term appears but only in a general explainer / wellness / "what is X" / "how to prevent" context — no real news event, no policy action, no outbreak. DROP THESE.
- 0.0 = unrelated.

KEY DISTINCTION for borderline cases (no company-specific keyword present):
  KEEP (score 0.5–0.6):
    - "Meningitis outbreak at university, vaccines offered to students"
    - "FDA approves first RSV vaccine for infants"
    - "CDC reports surge in shingles cases among adults"
    - "Drug pricing legislation passes Senate" (for companies with policy keywords)
  DROP (score 0.3):
    - "What is meningitis? Symptoms and treatment"
    - "How to protect yourself from contagious viruses"
    - "10 things to know about getting older with shingles"
    - "Wellness tips for cold and flu season"

The signal for KEEP is an event, action, or development. The signal for DROP is a general educational/wellness/listicle piece.

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
