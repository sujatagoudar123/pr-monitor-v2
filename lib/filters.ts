/**
 * Source filters — applied between dedupe and ranking.
 *
 * These encode analyst feedback about what shouldn't appear in PR reports:
 *   1. BLOCKED_DOMAINS — financial aggregator sites that surface stock
 *      movements, broker ratings, share-volume shifts. Analysts explicitly
 *      told us to drop these across all companies.
 *   2. STOCK_NEWS_TITLE_PATTERNS — title-based detection of stock/market
 *      articles that slipped through from otherwise-OK sources (e.g.
 *      Yahoo Finance occasionally carries real PR news; we want the PR
 *      news but not the share-price reporting).
 *   3. NON_US_PUBLICATION_DOMAINS — region filter. Per-company toggle.
 *      Some companies (GSK) accept UK pubs; others (Mazda, Trane, Amgen,
 *      Otsuka, BeOne, Indivior) want US-only.
 *
 * All three filters run BEFORE the LLM ranker so we don't waste tokens.
 */

import type { Article } from '@/lib/types';

// --- Filter 1: Financial-aggregator block list (universal) -------------------

const BLOCKED_DOMAINS = new Set([
  // Stock/finance aggregators per Tonoy's BeOne feedback (extended to all)
  'msn.com',
  'aol.com',
  'tradingview.com',
  'tipranks.com',
  'aastocks.com',
  'marketscreener.com',
  'simplywall.st',
  'investing.com',
  'gurufocus.com',
  'moomoo.com',
  'marketbeat.com',
  'finimize.com',
  'barchart.com',
  // Yahoo Finance — analysts said "we need the relevant outlet" not Yahoo
  'finance.yahoo.com',
  // Other share-volume / portfolio-tracker sites that surfaced as noise
  'seekingalpha.com',
  'fool.com',
  'zacks.com',
  'stocktitan.net',
  'stocknewsapi.com',
  'wallstreetzen.com',
  'streetinsider.com',
  // Additional sites flagged in BeOne June 2-3 feedback (Tonoy)
  'adhocnews.com',
  'ad-hoc-news.com',
  'ad-hoc-news.de',
  'financialcontent.com',
  'blockonomi.com',
  'pharmiweb.com',  // analyst noted couldn't access
  // Asian / regional stock-aggregator sites
  'futubull.com',
  'futunn.com',
  'eu.36kr.com',
  '36kr.com',
  // Additional sites flagged in Trane June 2-4 feedback (Tonoy)
  'bitget.com',
  'pluang.com',
  'tradersunion.com',
  'alphastreet.com',
  'quiverquant.com',
  'marketwatch.com',  // analyst flagged stock-only posts repeatedly
  'openpr.com',
  'stocktradersdaily.com',
  'stockstory.org',
  'trefis.com',
  'stocktwits.com',
  // PR press-release aggregator sites that re-syndicate without adding value
  'einpresswire.com',
  'prleap.com',
]);

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function isBlockedDomain(url: string): boolean {
  const domain = getDomain(url);
  if (!domain) return false;
  // Check exact and subdomain (e.g. 'in.investing.com' should match 'investing.com')
  for (const blocked of BLOCKED_DOMAINS) {
    if (domain === blocked || domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

// --- Filter 2: Stock/market title patterns (universal) -----------------------

const STOCK_TITLE_PATTERNS: RegExp[] = [
  // Stock-price reporting (require "stock" or "stock price" — "share" alone is too broad
  // because of 'market share', 'share data', etc.)
  /\b(stock|share price|stock price)\b.*(rises?|falls?|drops?|jumps?|gains?|slips?|climbs?|tumbles?|surges?|sinks?|holds?|opens?|closes?|rallies)/i,
  /\b(rises?|falls?|drops?|jumps?|slips?|climbs?|tumbles?|surges?)\b.*\b(stock|share price|stock price)/i,
  // Stock-price forecasts / technical analysis
  /\bstock\s+price\s+(forecast|target|prediction)\b/i,
  /\btrades?\s+(sideways|flat)\b/i,
  /\b(support|resistance)\s+(at|level)\b.*GBX/i,
  // Trading-volume share mentions with $TICKER
  /\bshares?\s+of\s+\$?[A-Z]{2,5}\b/i,
  // Analyst ratings
  /\b(maintains?|reaffirms?|remains?|holds?|reiterat)\w*\s+(its|a)\s+(buy|sell|hold|neutral|outperform|underperform|overweight|underweight)\b/i,
  /\b(buy|sell|hold|neutral|outperform|underperform|overweight|underweight)\s+rating\b/i,
  /\bprice\s+target\b/i,
  /\b(upgrades?|downgrades?)\s+(.+?)\s+to\b/i,
  // Trading/portfolio activity
  /\b(acquires?|sells?|reduces?|trims?|cuts?|boosts?|buys?|increases?)\s+(its|a|stake|shares|stock|holdings|position)\b.*\$[A-Z]{2,5}\b/i,
  /\b\d[\d,]*\s+shares?\s+(of|in)\b/i,
  // 52-week / momentum / value reporting
  /\b52[-\s]?week\s+(high|low)\b/i,
  /\bmomentum\s+stock\b/i,
  /\bvalue\s+stock\b/i,
  /\bdividend\s+stock\b/i,
  // Sector-mover lists
  /\b(top|best|worst)\s+(performing|performer)s?\b/i,
  /\bstock[s]?\s+to\s+(buy|sell|watch)\b/i,
  // ADR/ticker reporting
  /\(US\d{10}\)/,
  /\([A-Z]{2,5}\.US\)/,
  /\bADR\s+(treads|trades|hovers|holds|edges|rises|falls)/i,
  // Earnings-as-stock-event (only when title is dominantly about price reaction)
  /\b(outperforms?|underperforms?)\b.{0,40}(market|sector|competitors|peers|healthcare|industry)/i,
  // Stock movement headlines from BeOne/Trane June feedback
  /\b(after|on|amid)\s+\d+(\.\d+)?%\s+(rally|gain|drop|fall|jump|slide|rise|surge)\b/i,
  /\bsliding\s+today\b/i,
  /\bGF\s+Value\b/i,  // GuruFocus signature phrase
  /\b(reduces?|trims?|cuts?|boosts?|increases?|raises?)\s+(its\s+)?(stake|holdings|position)\b/i,
  /\bshares?\s+(sold|purchased|bought)\s+by\b/i,
  /\bis\s+rated\s+(buy|sell|hold|neutral|outperform|underperform|overweight|underweight)\b/i,
  /\bblock\s+trade\s+of\b/i,
  /\b(bearish|bullish)\s+block\s+trade\b/i,
  /\b(rocks?|rocked)\s+by\s+(insider|fresh)\s+(stock|share)\s+sale\b/i,
  /\binsider\s+stock\s+sale\b/i,
  /\bRSU\s+tax\s+withholding\b/i,
  /\bSEC\s+filing\b/i,
  /\bnew\s+52[-\s]?week\s+low\b/i,
  /\bnew\s+52[-\s]?week\s+high\b/i,
  /\bvoting\s+rights\s+(update|announcement)\b/i,
  /\bcooling\s+equipment\s+market\b.*(forecast|companies|opportunities)/i,
];

function isStockNewsTitle(title: string): boolean {
  if (!title) return false;
  return STOCK_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

// --- Filter 3: Non-US publication detection (per-company opt-in) ------------

/**
 * Domains classified as non-US. We're explicit about which we know are
 * non-US rather than guessing — false positives here would silently drop
 * good articles.
 */
const NON_US_DOMAINS = new Set([
  // Canada
  'driving.ca', 'autohebdo.net', 'auto123.com', 'lapresse.ca',
  'thecanadianpressnews.ca', 'tolerance.ca', 'cbc.ca', 'theglobeandmail.com',
  'nationalpost.com', 'emptytank.ca', 'motorillustrated.com',
  // UK
  'bbc.co.uk', 'bbc.com', 'feeds.bbci.co.uk', 'theguardian.com', 'guardian.co.uk',
  'channel4.com', 'skynews.com', 'sky.com', 'standard.co.uk', 'thisismoney.co.uk',
  'dailymail.co.uk', 'mirror.co.uk', 'express.co.uk', 'thesun.co.uk',
  'metro.co.uk', 'thetimes.co.uk', 'telegraph.co.uk', 'independent.co.uk',
  'ft.com', 'economist.com', 'cityam.com', 'completecar.ie',
  'buildersmerchantsjournal.net',  // UK trade journal — Trane analyst approved
  // Australia / NZ / Asia / EU / LATAM
  'canberratimes.com.au', 'standard.net.au', 'baypost.com.au', 'theaustralian.com.au',
  'nikkei.com', 'asia.nikkei.com', 'scmp.com', 'japantimes.co.jp',
  'koreaherald.com', 'business-standard.com', 'livemint.com', 'tukoo.co.ke',
  'investing.com.ng',
  'afaqs.com',
  'asatunews.co.id',
  'mabumbe.com',
  'finansavisen.no',  // Norway — Trane analyst approved (JCI coverage)
  'automotive-world.com',  // Mazda — flagged as non-US in feedback
  'portalcnj.com.br',  // Mazda — Brazilian portal (Portuguese)
  'sg.investing.com', 'investing.com.in',
  // Stock aggregators with regional editions
  'in.investing.com', 'investing.com.nigeria',
]);

/**
 * Per-company exception list: domains that are technically non-US but the
 * client's analyst explicitly approved for this company's report.
 */
const COMPANY_UK_ALLOWLIST: Record<string, Set<string>> = {
  // Sam's GSK feedback: UK pubs OK
  GSK: new Set([
    'bbc.co.uk', 'bbc.com', 'feeds.bbci.co.uk',
    'theguardian.com', 'channel4.com', 'skynews.com', 'sky.com',
    'standard.co.uk', 'thisismoney.co.uk', 'dailymail.co.uk',
    'mirror.co.uk', 'express.co.uk', 'metro.co.uk', 'independent.co.uk',
    'ft.com',
  ]),
  // Sridevi's Otsuka feedback: BBC, Guardian, Pharmaceutical Technology, Pharma Letter OK
  Otsuka: new Set([
    'bbc.co.uk', 'bbc.com', 'feeds.bbci.co.uk',
    'theguardian.com', 'pharmaceutical-technology.com', 'thepharmaletter.com',
  ]),
  // Tonoy's Trane feedback: HVAC trade journals approved
  Trane: new Set([
    'buildersmerchantsjournal.net',  // Daikin Sustainable Home Centre coverage
    'finansavisen.no',  // JCI Q2 / "Going to Gemba Day" coverage
  ]),
  // Tonoy's BeOne feedback: Pharma Letter explicitly approved
  BeOne: new Set([
    'thepharmaletter.com',  // Brukinsa Ireland reimbursement coverage
  ]),
  // All other companies: strict US-only
};

function isNonUS(url: string, company: string): boolean {
  const domain = getDomain(url);
  if (!domain) return false;
  // Check if it's in any non-US list
  let blocked = false;
  for (const nonUS of NON_US_DOMAINS) {
    if (domain === nonUS || domain.endsWith(`.${nonUS}`)) {
      blocked = true;
      break;
    }
  }
  if (!blocked) return false;
  // It's non-US — check if the company has an exception for this domain
  const allowlist = COMPANY_UK_ALLOWLIST[company];
  if (allowlist) {
    for (const allowed of allowlist) {
      if (domain === allowed || domain.endsWith(`.${allowed}`)) return false;
    }
  }
  return true;
}

// --- Combined filter ---------------------------------------------------------

export interface FilterResult<T> {
  kept: T[];
  droppedByDomain: number;
  droppedByStockPattern: number;
  droppedByNonUS: number;
}

/**
 * Apply all three filters. Returns the kept subset plus a count breakdown
 * so the cron route can log what was dropped and why.
 */
export function applySourceFilters<T extends Article>(
  articles: T[],
  company: string,
): FilterResult<T> {
  const kept: T[] = [];
  let droppedByDomain = 0;
  let droppedByStockPattern = 0;
  let droppedByNonUS = 0;

  for (const a of articles) {
    if (!a.link) {
      kept.push(a);
      continue;
    }
    if (isBlockedDomain(a.link)) {
      droppedByDomain += 1;
      continue;
    }
    if (isStockNewsTitle(a.title)) {
      droppedByStockPattern += 1;
      continue;
    }
    if (isNonUS(a.link, company)) {
      droppedByNonUS += 1;
      continue;
    }
    kept.push(a);
  }

  return { kept, droppedByDomain, droppedByStockPattern, droppedByNonUS };
}
