/**
 * Shared types across the agent, sources, and API routes.
 */

export type SourceType = 'rss' | 'google_news' | 'newsapi' | 'bing_news' | 'scrape';

export interface Article {
  title: string;
  link: string;
  source: string;          // human-readable source name (e.g. "BBC", "FiercePharma")
  sourceType: SourceType;
  publishedAt?: string | null;
  snippet?: string;
  // Set by ranking stage:
  matchedKeywords?: string[];
  whyPicked?: string;
  relevanceScore?: number;
  // Set by freshness stage:
  undated?: boolean;
  ageHours?: number | null;
}

export interface Company {
  name: string;
  keywords: string[];
  rssFeeds: Array<{ url: string; source: string }>;
  scrapeTargets?: string[]; // domains the scraper should sweep for this company
}
