/**
 * Companies data — names, keywords, and RSS feeds.
 *
 * Keywords are derived from the client's Excel sheets:
 *   GSK_Updated_Scope_and_Terms.xlsx  → GSK
 *   -Project-wise_Website_Monitoring_List_April_28_2026_Updated---.xlsx → all 7
 *
 * Edit this file to add/remove keywords or feeds, then redeploy.
 */

import type { Company } from '@/lib/types';

// Shared general health feeds used by pharma companies
const generalHealthFeeds = [
  { url: 'https://feeds.feedburner.com/fiercepharma', source: 'FiercePharma' },
  { url: 'https://www.statnews.com/feed/', source: 'STAT News' },
  { url: 'https://endpts.com/feed/', source: 'Endpoints News' },
  { url: 'https://feeds.bbci.co.uk/news/health/rss.xml', source: 'BBC Health' },
  { url: 'https://feeds.feedburner.com/fiercebiotech', source: 'FierceBiotech' },
];

const generalAutoFeeds = [
  { url: 'https://feeds.feedburner.com/autoblog', source: 'Autoblog' },
  { url: 'https://www.autonews.com/rss', source: 'Auto News' },
  { url: 'https://www.caranddriver.com/rss/all.xml/', source: 'Car and Driver' },
];

const generalBusinessFeeds = [
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
  { url: 'https://feeds.reuters.com/reuters/businessNews', source: 'Reuters Business' },
];

export const COMPANIES: Company[] = [
  {
    name: 'GSK',
    // Per GSK_Updated_Scope_and_Terms.xlsx → Sheet "GSK" → "Keywords" column
    // PLUS the products + people from the Detailed Search Terms sheet.
    keywords: [
      // Company
      'GSK', 'GlaxoSmithKline', 'Emma Walmsley',
      // Categories
      'pharmaceutical', 'biotech', 'Pharma', 'Vaccine', 'Drug price',
      // Shingles franchise
      'Shingles', 'SHINGRIX', 'herpes zoster', 'Thrive@50+', Leonard Friedland’, ‘Julie Bowen’, ‘Ty Burrell’, ‘Modern Family’
      // Meningitis franchise
      'Meningitis', 'Meningococcal', 'Bexsero', 'Menveo', 'Ask2BSure', ‘Leonard Friedland’, ‘Julie Bowen’, ‘Ty Burrell’, ‘Modern Family’
      'MenABCWY', 'MenACWY',
      // RSV
      'RSV', 'respiratory syncytial virus', 'Arexvy', ‘Clesrovimab’, ‘Nirsevimab’, ‘Beyfortus’
      // Flu
      'Influenza', 'Flu', 'Fluarix', 'Flulaval', 'FluMist', ‘Clesrovimab’, ‘Nirsevimab’, ‘Beyfortus’, ‘Ask2BSure’, ‘Penbraya’
      // Other diseases
      'Abrysvo',
      // Key spokespeople / influencers from Detailed Search Terms
      'Len Friedland', 'Jenn Sherman', 'Arti Thangudu',
      'Lisa Breckenridge', 'Daisy Kent', 'Greg Olsen',
    ],
    rssFeeds: [
      { url: 'https://www.gsk.com/en-gb/media/press-releases/rss/', source: 'GSK Press' },
      { url: 'https://feeds.bbci.co.uk/news/rss.xml', source: 'BBC' },
      { url: 'https://feeds.reuters.com/reuters/healthNews', source: 'Reuters Health' },
      ...generalHealthFeeds,
    ],
    scrapeTargets: ['fiercepharma.com', 'statnews.com', 'endpts.com'],
  },
  {
    name: 'Mazda',
    // Per Project-wise sheet → Mazda
    keywords: [
      'Mazda',
      'CX-30', 'CX-50', 'CX-90', 'CX-5', 'CX-9', 'CX-70',
      'Mazda3', 'Mazda 3', 'MX-5 Miata',
      'Mazda Toyota Manufacturing',
    ],
    rssFeeds: [
      ...generalAutoFeeds,
    ],
    scrapeTargets: ['autonews.com'],
  },
  {
    name: 'Trane',
    // Per Project-wise sheet → Trane (ACTUAL keywords are company + competitors)
    keywords: [
      'Trane', 'Trane Technologies',
      'Carrier Global', 'Johnson Controls',
      'Daikin', 'Lennox International', 'METUS',
    ],
    rssFeeds: [
      ...generalBusinessFeeds,
    ],
    scrapeTargets: [],
  },
  {
    name: 'BeOne',
    // Per Project-wise sheet → BeOne (Cancer, Drug + brand keywords)
    keywords: [
      'BeOne', 'BeiGene',
      'Brukinsa', 'Zanubrutinib',
      'Tevimbra', 'Tislelizumab',
      'Cancer', 'Drug',
    ],
    rssFeeds: [
      ...generalHealthFeeds,
    ],
    scrapeTargets: ['fiercepharma.com', 'endpts.com'],
  },
  {
    name: 'Amgen',
    // Per Project-wise sheet → Amgen (focused on Tepezza/Krystexxa franchise)
    keywords: [
      'Amgen',
      // Gout / TED franchise
      'Gout', 'Thyroid eye', 'Sjögren', 'Sjogren',
      'Tepezza', 'Krystexxa', 'pegloticase', 'Teprotumumab',
    ],
    rssFeeds: [
      ...generalHealthFeeds,
    ],
    scrapeTargets: ['fiercepharma.com', 'endpts.com', 'statnews.com'],
  },
  {
    name: 'Otsuka',
    // Per Project-wise sheet → Otsuka
    keywords: [
      'Otsuka', 'Rexulti', 'brexpiprazole',
      'drug pricing', 'drug prices', 'drug price',
      'drug cost', 'drug costs',
      'price negotiation',
      'most-favored nation', 'most favored nation', 'most-favored-nation',
      'TrumpRx', '340B',
    ],
    rssFeeds: [
      ...generalHealthFeeds,
    ],
    scrapeTargets: ['fiercepharma.com', 'statnews.com'],
  },
  {
    name: 'Indivior',
    // Per Project-wise sheet → Indivior (provider-fraud / enforcement watch)
    keywords: [
      'Indivior', 'Sublocade', 'Suboxone',
      'buprenorphine', 'naloxone',
      'opioid use disorder', 'OUD', 'addiction treatment',
      // Provider categories from the sheet (these are the actual "Keywords" column)
      'Doctor', 'Nurse', 'Pharmacist', 'Physician',
      'Psychiatrist', 'Practitioner', 'anesthesiologist', 'surgeon',
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
