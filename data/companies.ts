/**
 * Companies data — names, keywords, and RSS feeds.
 *
 * NOTE: This is a starter set. Your live deployment has 279 RSS feeds derived
 * from an Excel sheet. To migrate yours over, replace the arrays below or
 * generate this file from your Excel export. The shape per company is:
 *
 *   { name, keywords[], rssFeeds: [{ url, source }] }
 *
 * Keywords are also editable at runtime via PATCH /api/companies, which
 * mutates the in-memory store (resets on cold start). For permanent edits,
 * change this file and redeploy.
 */

import type { Company } from '@/lib/types';

const generalHealthFeeds = [
  { url: 'https://feeds.feedburner.com/fiercepharma', source: 'FiercePharma' },
  { url: 'https://www.statnews.com/feed/', source: 'STAT News' },
  { url: 'https://endpts.com/feed/', source: 'Endpoints News' },
  { url: 'https://www.reutersagency.com/feed/?best-topics=health&post_type=best', source: 'Reuters Health' },
  { url: 'https://feeds.bbci.co.uk/news/health/rss.xml', source: 'BBC Health' },
];

const generalAutoFeeds = [
  { url: 'https://www.autonews.com/rss', source: 'Auto News' },
  { url: 'https://feeds.feedburner.com/autoblog', source: 'Autoblog' },
  { url: 'https://www.caranddriver.com/rss/all.xml/', source: 'Car and Driver' },
];

const generalBusinessFeeds = [
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
  { url: 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best', source: 'Reuters Business' },
];

export const COMPANIES: Company[] = [
  {
    name: 'GSK',
    keywords: [
      'GSK', 'GlaxoSmithKline', 'Arexvy', 'Shingrix', 'Trelegy', 'Nucala',
      'Benlysta', 'Cabenuva', 'Jemperli', 'Bexsero', 'Menveo', 'Priorix',
      'Rotarix', 'Twinrix', 'vaccine', 'RSV', 'HIV', 'oncology',
      'respiratory', 'meningitis', 'shingles', 'Hatchett', 'Emma Walmsley',
      'pharmaceutical', 'biotech',
    ],
    rssFeeds: [
      { url: 'https://www.gsk.com/en-gb/media/press-releases/rss/', source: 'GSK Press' },
      ...generalHealthFeeds,
    ],
    scrapeTargets: ['fiercepharma.com', 'statnews.com', 'endpts.com'],
  },
  {
    name: 'BeOne',
    keywords: [
      'BeOne', 'BeiGene', 'Brukinsa', 'zanubrutinib', 'Tislelizumab',
      'Tevimbra', 'oncology', 'lymphoma', 'hematology', 'CLL',
      'John Oyler', 'BeiGene rebrand',
    ],
    rssFeeds: [
      ...generalHealthFeeds,
    ],
    scrapeTargets: ['fiercepharma.com', 'endpts.com'],
  },
  {
    name: 'Otsuka',
    keywords: [
      'Otsuka', 'Otsuka Pharmaceutical', 'Abilify', 'Rexulti', 'brexpiprazole',
      'Jynarque', 'tolvaptan', 'Samsca', 'Pocari Sweat', 'Calorie Mate',
      'CNS', 'depression', 'schizophrenia', 'Alzheimer', 'Tadawi',
    ],
    rssFeeds: [
      ...generalHealthFeeds,
    ],
    scrapeTargets: ['fiercepharma.com', 'statnews.com'],
  },
  {
    name: 'Mazda',
    keywords: [
      'Mazda', 'CX-5', 'CX-50', 'CX-90', 'CX-30', 'Mazda3', 'Mazda6',
      'MX-5', 'Miata', 'Skyactiv', 'rotary', 'electrification', 'EV',
      'Hiroshima', 'Masahiro Moro',
    ],
    rssFeeds: [
      ...generalAutoFeeds,
    ],
    scrapeTargets: ['autonews.com'],
  },
  {
    name: 'Trane',
    keywords: [
      'Trane', 'Trane Technologies', 'HVAC', 'Thermo King',
      'heat pump', 'cooling', 'climate control', 'refrigeration',
      'sustainability', 'Dave Regnery',
    ],
    rssFeeds: [
      ...generalBusinessFeeds,
    ],
    scrapeTargets: [],
  },
  {
    name: 'Amgen',
    keywords: [
      'Amgen', 'Repatha', 'Enbrel', 'Prolia', 'Xgeva', 'Otezla',
      'Tezspire', 'Tepezza', 'Lumakras', 'sotorasib', 'biosimilar',
      'oncology', 'inflammation', 'cardiovascular', 'Robert Bradway',
    ],
    rssFeeds: [
      ...generalHealthFeeds,
    ],
    scrapeTargets: ['fiercepharma.com', 'endpts.com', 'statnews.com'],
  },
  {
    name: 'Indivior',
    keywords: [
      'Indivior', 'Sublocade', 'Suboxone', 'buprenorphine', 'naloxone',
      'opioid use disorder', 'OUD', 'addiction treatment', 'Perseris',
      'Mark Crossley',
    ],
    rssFeeds: [
      ...generalHealthFeeds,
    ],
    scrapeTargets: ['statnews.com', 'fiercepharma.com'],
  },
];

// In-memory mutable store so PATCH /api/companies can update keywords at runtime.
// Resets on cold start — for permanent edits, change this file.
const mutableCompanies: Company[] = COMPANIES.map((c) => ({ ...c, keywords: [...c.keywords] }));

export function getCompanies(): Company[] {
  return mutableCompanies;
}

export function getCompany(name: string): Company | undefined {
  return mutableCompanies.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

export function updateCompanyKeywords(name: string, keywords: string[]): Company | null {
  const c = mutableCompanies.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (!c) return null;
  c.keywords = keywords.map((k) => String(k).trim()).filter(Boolean);
  return c;
}
