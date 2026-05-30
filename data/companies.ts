/**
 * Companies data — names, keywords, and RSS feeds.
 *
 * GENERATED from the master publication map (lib/publications.ts), itself
 * derived from your Excel sheets + validation tests.
 *
 * Per-publication legal status:
 *   ACTIVE — free public RSS feed, fetched on every run.
 *   PAID   — RSS is subscription-only. Listed but COMMENTED OUT. Uncomment
 *            after you have a subscription. See docs/subscriptions.md for
 *            how to obtain access to each one.
 *
 * IMPORTANT: We intentionally do NOT include 'news.google.com/rss/search'
 * proxy URLs from the YAML. Those are redundant — our google-news source
 * already queries Google News dynamically across all publishers.
 */

import type { Company } from '@/lib/types';
import { PUBLICATIONS, type PublicationKey } from '@/lib/publications';

function feeds(...keys: PublicationKey[]) {
  return keys
    .map((k) => PUBLICATIONS[k])
    .filter((p) => p && p.status === 'active' && p.rss)
    .map((p) => ({ url: p.rss as string, source: p.display_name }));
}

export const COMPANIES: Company[] = [
  {
    name: 'GSK',
    keywords: [
      // Company / leadership
      'GSK',
      'GlaxoSmithKline',
      'Emma Walmsley',
      // Categories
      'pharmaceutical',
      'biotech',
      'Pharma',
      'vaccine',
      // RSV franchise — GSK products + competitors
      'RSV',
      'respiratory',
      'respiratory syncytial virus',
      'Arexvy',
      'Abrysvo',         // Pfizer (competitor)
      'Clesrovimab',     // Merck (competitor)
      'Nirsevimab',      // generic / pipeline
      'Beyfortus',       // Sanofi / AstraZeneca (competitor)
      // Shingles franchise
      'shingles',
      'Shingrix',
      // Meningitis franchise — GSK products + competitors + campaigns
      'meningitis',
      'Meningococcal',
      'Bexsero',
      'Menveo',
      'Penbraya',        // Pfizer (competitor)
      'Ask2BSure',       // GSK awareness campaign
      // Flu franchise
      'Flu',
      'Influenza',
      'Flulaval',
      'Fluarix',
      'FluMist',
      // Campaign / Spokespeople
      'Thrive@50+',
      'Leonard Friedland',
      'Julie Bowen',
      'Ty Burrell',
      'Modern Family',
    ],
    rssFeeds: feeds(
      'bbc',  // BBC
      'bbc_health',  // BBC Health
      'channel_4_news',  // Channel 4 News
      'sky_news',  // Sky News
      'the_guardian',  // The Guardian
      'the_daily_mail',  // The Daily Mail
      'the_mail_on_sunday',  // The Mail on Sunday
      'the_express',  // The Express
      'the_mirror',  // The Mirror
      'evening_standard',  // Evening Standard
      'this_is_money',  // This is Money
      'abc_news',  // ABC News
      'cbs_news',  // CBS News
      'cbs_health',  // CBS Health
      'nbc_news',  // NBC News
      'nbc_health',  // NBC Health
      'fox_news',  // FOX News
      'fox_health',  // FOX News Health
      'cnn',  // CNN
      'cnn_health',  // CNN Health
      'cnbc',  // CNBC
      'cnbc_health',  // CNBC Health
      'npr',  // NPR
      'npr_health',  // NPR Health
      'yahoo_news',  // Yahoo! News
      'medcity_news',  // MedCity News
      'medpage_today',  // MedPage Today
      'medscape',  // Medscape
      'healthline',  // Healthline
      'healthcare_dive',  // Healthcare Dive
      'pharmaceutical_technology',  // Pharmaceutical Technology
      'medical_daily',  // Medical Daily
      'medical_xpress',  // Medical Xpress
      'pr_newswire',  // PR Newswire
      'globe_newswire',  // GlobeNewswire
      'jama_network',  // JAMA Network
      'forbes',  // Forbes
      'forbes_business',  // Forbes Business
      'time_magazine',  // Time
      'newsweek',  // Newsweek
      'business_insider',  // Business Insider
      // === PAID — uncomment after obtaining subscription. See docs/subscriptions.md ===
      // 'bloomberg',  // Bloomberg (PAID)
      // 'financial_times',  // Financial Times (PAID)
      // 'wall_street_journal',  // Wall Street Journal (PAID)
      // 'new_york_times',  // The New York Times (PAID)
      // 'washington_post',  // The Washington Post (PAID)
      // 'the_economist',  // The Economist (PAID)
      // 'the_telegraph',  // The Telegraph (PAID)
      // 'endpoints_news',  // Endpoints News (PAID)
      // 'stat_news',  // STAT News (PAID)
      // 'pink_sheet',  // Pink Sheet (PAID)
      // 'scrip',  // Scrip (PAID)
      // 'citeline',  // Citeline (Scrip / Pink Sheet / Medtech Insight / In Vivo) (PAID)
      // 'firstword_pharma',  // FirstWord Pharma (PAID)
      // 'the_pharma_letter',  // The Pharma Letter (PAID)
      // 'medwatch',  // MedWatch (PAID)
      // === Google News proxies — skipped (we query Google News dynamically) ===
    ),
    scrapeTargets: ['fiercepharma.com', 'statnews.com', 'endpts.com'],
  },
  {
    name: 'Mazda',
    keywords: [
      'Mazda',
      'CX-30',
      'CX-50',
      'CX-90',
      'CX-5',
      'CX-9',
      'CX-70',
      'Mazda3',
      'Mazda 3',
      'MX-5 Miata',
      'Mazda Toyota Manufacturing',
    ],
    rssFeeds: feeds(
      'autoblog',  // Autoblog
      'car_and_driver',  // Car and Driver
      'road_and_track',  // Road & Track
      'jalopnik',  // Jalopnik
      'carscoops',  // Carscoops.com
      'motor1',  // Motor1
      'autoweek',  // Autoweek
      'topspeed',  // TopSpeed
      'slashgear',  // SlashGear
      'automoblog',  // Automoblog
      'consumer_guide',  // Consumer Guide
      'tflcar',  // TFLCar
      'digital_trends',  // Digital Trends
      'cnet',  // CNET
      'ars_technica',  // Ars Technica
      'gq',  // GQ
      'mens_health',  // Men’s Health
      'mens_journal',  // Men's Journal
      'time_magazine',  // Time
      'los_angeles_times',  // Los Angeles Times
      'chicago_sun_times',  // Chicago Sun-Times
      'philadelphia_inquirer',  // Philadelphia Inquirer
      'newsweek',  // Newsweek
      'cnbc',  // CNBC
      'business_insider',  // Business Insider
      'new_york_times_auto',  // New York Times (Autos)
      // === PAID — uncomment after obtaining subscription. See docs/subscriptions.md ===
      // 'new_york_times',  // The New York Times (PAID)
      // 'wall_street_journal',  // Wall Street Journal (PAID)
      // 'washington_post',  // The Washington Post (PAID)
      // 'bloomberg',  // Bloomberg (PAID)
      // 'automotive_news',  // Automotive News (PAID)
      // === Google News proxies — skipped (we query Google News dynamically) ===
    ),
    scrapeTargets: ['autonews.com'],
  },
  {
    name: 'Trane',
    keywords: [
      'Trane',
      'Trane Technologies',
      'Carrier Global',
      'Johnson Controls',
      'Daikin',
      'Lennox International',
      'METUS',
    ],
    rssFeeds: feeds(
      'abc_news',  // ABC News
      'bbc',  // BBC
      'bbc_business',  // BBC Business
      'cbs_news',  // CBS News
      'nbc_news',  // NBC News
      'cnbc',  // CNBC
      'the_hill',  // The Hill
      'fast_company',  // Fast Company
      'fortune',  // Fortune
      'forbes',  // Forbes
      'forbes_business',  // Forbes Business
      'wired',  // Wired
      'this_is_money',  // This is Money
      'mens_journal',  // Men's Journal
      'cooling_post',  // Cooling Post
      'cleantechnica',  // CleanTechnica
      // === PAID — uncomment after obtaining subscription. See docs/subscriptions.md ===
      // 'bloomberg',  // Bloomberg (PAID)
      // 'bloomberg_green',  // Bloomberg Green (PAID)
      // 'financial_times',  // Financial Times (PAID)
      // 'wall_street_journal',  // Wall Street Journal (PAID)
      // 'new_york_times',  // The New York Times (PAID)
      // === Google News proxies — skipped (we query Google News dynamically) ===
    ),
    scrapeTargets: [],
  },
  {
    name: 'BeOne',
    keywords: [
      'BeOne',
      'BeiGene',
      'Brukinsa',
      'Zanubrutinib',
      'Tevimbra',
      'Tislelizumab',
      'Cancer',
      'Drug',
    ],
    rssFeeds: feeds(
      'asco_post',  // The ASCO Post
      'oncozine',  // Onco'Zine
      'cll_society',  // CLL Society
      'medcity_news',  // MedCity News
      'medscape',  // Medscape
      'forbes',  // Forbes
      'fortune',  // Fortune
      'fast_company',  // Fast Company
      // === PAID — uncomment after obtaining subscription. See docs/subscriptions.md ===
      // 'biocentury',  // BioCentury (PAID)
      // 'bioworld',  // BioWorld (PAID)
      // 'bloomberg',  // Bloomberg (PAID)
      // 'financial_times',  // Financial Times (PAID)
      // 'firstword_pharma',  // FirstWord Pharma (PAID)
      // 'endpoints_news',  // Endpoints News (PAID)
      // 'stat_news',  // STAT News (PAID)
      // 'the_economist',  // The Economist (PAID)
      // 'the_pharma_letter',  // The Pharma Letter (PAID)
      // 'seeking_alpha',  // Seeking Alpha (PAID)
      // === Google News proxies — skipped (we query Google News dynamically) ===
    ),
    scrapeTargets: ['fiercepharma.com', 'endpts.com'],
  },
  {
    name: 'Amgen',
    keywords: [
      'Amgen',
      'Gout',
      'Thyroid eye',
      'Sjögren',
      'Sjogren',
      'Tepezza',
      'Krystexxa',
      'pegloticase',
      'Teprotumumab',
    ],
    rssFeeds: feeds(
      'abc_news',  // ABC News
      'cbs_news',  // CBS News
      'nbc_news',  // NBC News
      'cnn',  // CNN
      'cnbc',  // CNBC
      'npr',  // NPR
      'the_hill',  // The Hill
      'two_minute_medicine',  // 2 Minute Medicine
      'benzinga',  // Benzinga
      'genetic_engineering_news',  // Genetic Engineering & Biotechnology News
      'healthcare_dive',  // Healthcare Dive
      'healthline',  // Healthline
      'liver_disease_news',  // Liver Disease News
      'medcity_news',  // MedCity News
      'medical_daily',  // Medical Daily
      'medical_xpress',  // Medical Xpress
      'medpage_today',  // MedPage Today
      'medscape',  // Medscape
      'pharmaceutical_technology',  // Pharmaceutical Technology
      'forbes',  // Forbes
      // === PAID — uncomment after obtaining subscription. See docs/subscriptions.md ===
      // 'bloomberg',  // Bloomberg (PAID)
      // 'bloomberg_law',  // Bloomberg Law (PAID)
      // 'financial_times',  // Financial Times (PAID)
      // 'new_york_times',  // The New York Times (PAID)
      // 'washington_post',  // The Washington Post (PAID)
      // 'pink_sheet',  // Pink Sheet (PAID)
      // 'scrip',  // Scrip (PAID)
      // 'seeking_alpha',  // Seeking Alpha (PAID)
      // 'endpoints_news',  // Endpoints News (PAID)
      // 'medwatch',  // MedWatch (PAID)
      // === Google News proxies — skipped (we query Google News dynamically) ===
    ),
    scrapeTargets: ['fiercepharma.com', 'endpts.com', 'statnews.com'],
  },
  {
    name: 'Otsuka',
    keywords: [
      'Otsuka',
      'Rexulti',
      'brexpiprazole',
      'drug pricing',
      'drug prices',
      'drug price',
      'drug cost',
      'drug costs',
      'price negotiation',
      'most-favored nation',
      'most favored nation',
      'most-favored-nation',
      'TrumpRx',
      '340B',
    ],
    rssFeeds: feeds(
      'abc_news',  // ABC News
      'cbs_news',  // CBS News
      'nbc_news',  // NBC News
      'cnn',  // CNN
      'cnbc',  // CNBC
      'npr',  // NPR
      'fox_news',  // FOX News
      'the_hill',  // The Hill
      'business_insider',  // Business Insider
      'drug_discovery_world',  // Drug Discovery World
      'fortune',  // Fortune
      'globe_newswire',  // GlobeNewswire
      'jama_network',  // JAMA Network
      'medcity_news',  // MedCity News
      'newsweek',  // Newsweek
      'news_nation',  // News Nation
      'pharmaceutical_technology',  // Pharmaceutical Technology
      'politico',  // POLITICO
      'pr_newswire',  // PR Newswire
      'the_blaze',  // The Blaze
      'the_daily_wire',  // The Daily Wire
      'the_guardian',  // The Guardian
      'washington_examiner',  // Washington Examiner
      'forbes',  // Forbes
      // === PAID — uncomment after obtaining subscription. See docs/subscriptions.md ===
      // 'bloomberg',  // Bloomberg (PAID)
      // 'bloomberg_law',  // Bloomberg Law (PAID)
      // 'endpoints_news',  // Endpoints News (PAID)
      // 'financial_times',  // Financial Times (PAID)
      // 'inside_health_policy',  // Inside Health Policy (PAID)
      // 'medwatch',  // MedWatch (PAID)
      // 'new_york_times',  // The New York Times (PAID)
      // 'scrip',  // Scrip (PAID)
      // 'stat_news',  // STAT News (PAID)
      // 'the_pharma_letter',  // The Pharma Letter (PAID)
      // 'wall_street_journal',  // Wall Street Journal (PAID)
      // 'washington_post',  // The Washington Post (PAID)
      // === Google News proxies — skipped (we query Google News dynamically) ===
    ),
    scrapeTargets: ['fiercepharma.com', 'statnews.com'],
  },
  {
    name: 'Indivior',
    keywords: [
      'Indivior',
      'Sublocade',
      'Suboxone',
      'buprenorphine',
      'naloxone',
      'opioid use disorder',
      'OUD',
      'addiction treatment',
      'Doctor',
      'Nurse',
      'Pharmacist',
      'Physician',
      'Psychiatrist',
      'Practitioner',
      'anesthesiologist',
      'surgeon',
    ],
    rssFeeds: feeds(
      'medcity_news',  // MedCity News
      'medpage_today',  // MedPage Today
      'medscape',  // Medscape
      'medical_xpress',  // Medical Xpress
      'healthline',  // Healthline
      'medical_daily',  // Medical Daily
      'politico',  // POLITICO
      'npr',  // NPR
      'the_hill',  // The Hill
      // === Google News proxies — skipped (we query Google News dynamically) ===
    ),
    scrapeTargets: ['statnews.com', 'fiercepharma.com'],
  },
];

// In-memory mutable store so PATCH /api/companies can update keywords at runtime.
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
