/**
 * Master publication registry.
 *
 * Each entry describes ONE publication: its display name, RSS endpoint, and
 * legal-access status. Companies (data/companies.ts) reference these by key.
 *
 * Status legend:
 *   active        — free, public RSS. Fetched on every run.
 *   paid          — RSS is subscription-only. Listed here for reference only;
 *                   commented out where it's wired in companies.ts.
 *                   To enable: get a subscription, then uncomment in companies.ts.
 *   no_rss        — publication has no RSS at all (kept here for documentation).
 *   no_rss_alert  — no RSS, but a Google News Alert can be set up manually.
 *
 * Google News proxy URLs (`news.google.com/rss/search?...`) from the YAML are
 * intentionally excluded here. The google-news source queries Google News
 * dynamically — re-listing them as RSS would just duplicate work.
 */

export interface Publication {
  display_name: string;
  rss: string;
  status: 'active' | 'paid' | 'no_rss' | 'no_rss_alert';
  notes?: string;
}

export const PUBLICATIONS = {
  'abc_news': {
    display_name: 'ABC News',
    rss: 'https://abcnews.go.com/abcnews/topstories',
    status: 'active',
  },
  'ars_technica': {
    display_name: 'Ars Technica',
    rss: 'https://feeds.arstechnica.com/arstechnica/index',
    status: 'active',
  },
  'asco_post': {
    display_name: 'The ASCO Post',
    rss: 'https://ascopost.com/rss/',
    status: 'active',
  },
  'autoblog': {
    display_name: 'Autoblog',
    rss: 'https://www.autoblog.com/rss.xml',
    status: 'active',
  },
  'automoblog': {
    display_name: 'Automoblog',
    rss: 'https://www.automoblog.net/feed/',
    status: 'active',
  },
  'automotive_news': {
    display_name: 'Automotive News',
    rss: '',
    status: 'paid',
  },
  'autoweek': {
    display_name: 'Autoweek',
    rss: 'https://www.autoweek.com/rss/all.xml/',
    status: 'active',
  },
  'bbc': {
    display_name: 'BBC',
    rss: 'https://feeds.bbci.co.uk/news/rss.xml',
    status: 'active',
  },
  'bbc_business': {
    display_name: 'BBC Business',
    rss: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    status: 'active',
  },
  'bbc_health': {
    display_name: 'BBC Health',
    rss: 'https://feeds.bbci.co.uk/news/health/rss.xml',
    status: 'active',
  },
  'bbc_england': {
    display_name: 'BBC England (regional health stories)',
    rss: 'https://feeds.bbci.co.uk/news/england/rss.xml',
    status: 'active',
    notes: 'Catches UK regional health stories like local outbreaks, vaccination drives, etc.',
  },
  'benzinga': {
    display_name: 'Benzinga',
    rss: 'https://www.benzinga.com/feed',
    status: 'paid',  // STATUS: deactivated — analysts don't want stock-news outlets (filtered out anyway)
  },
  'business_wire': {
    display_name: 'Business Wire',
    rss: 'https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJfWFlSWg==',
    status: 'active',
    notes: 'Sridevi (Otsuka) requested. Press-release wire — useful for corporate announcements.',
  },
  'biocentury': {
    display_name: 'BioCentury',
    rss: '',
    status: 'paid',
  },
  'bioworld': {
    display_name: 'BioWorld',
    rss: '',
    status: 'paid',
  },
  'bloomberg': {
    display_name: 'Bloomberg',
    rss: 'https://feeds.bloomberg.com/markets/news.rss',
    status: 'paid',
  },
  'bloomberg_green': {
    display_name: 'Bloomberg Green',
    rss: 'https://feeds.bloomberg.com/green/news.rss',
    status: 'paid',
  },
  'bloomberg_law': {
    display_name: 'Bloomberg Law',
    rss: 'https://news.bloomberglaw.com/rss',
    status: 'paid',
  },
  'business_insider': {
    display_name: 'Business Insider',
    rss: 'https://www.businessinsider.com/rss',
    status: 'active',
  },
  'car_and_driver': {
    display_name: 'Car and Driver',
    rss: 'https://www.caranddriver.com/rss/all.xml/',
    status: 'active',
  },
  'carscoops': {
    display_name: 'Carscoops.com',
    rss: 'https://www.carscoops.com/feed/',
    status: 'active',
  },
  'cbs_health': {
    display_name: 'CBS Health',
    rss: 'https://www.cbsnews.com/latest/rss/health',
    status: 'active',
  },
  'cbs_news': {
    display_name: 'CBS News',
    rss: 'https://www.cbsnews.com/latest/rss/main',
    status: 'active',
  },
  'channel_4_news': {
    display_name: 'Channel 4 News',
    rss: 'https://www.channel4.com/news/feed',
    status: 'active',
  },
  'chicago_sun_times': {
    display_name: 'Chicago Sun-Times',
    rss: 'https://chicago.suntimes.com/rss/index.xml',
    status: 'active',
  },
  'citeline': {
    display_name: 'Citeline (Scrip / Pink Sheet / Medtech Insight / In Vivo)',
    rss: '',
    status: 'paid',
  },
  'cleantechnica': {
    display_name: 'CleanTechnica',
    rss: 'https://cleantechnica.com/feed/',
    status: 'active',
  },
  'cll_society': {
    display_name: 'CLL Society',
    rss: 'https://cllsociety.org/feed/',
    status: 'active',
  },
  'cnbc': {
    display_name: 'CNBC',
    rss: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    status: 'active',
  },
  'cnbc_health': {
    display_name: 'CNBC Health',
    rss: 'https://www.cnbc.com/id/10000108/device/rss/rss.html',
    status: 'active',
  },
  'cnet': {
    display_name: 'CNET',
    rss: 'https://www.cnet.com/rss/news/',
    status: 'active',
  },
  'cnn': {
    display_name: 'CNN',
    rss: 'http://rss.cnn.com/rss/cnn_topstories.rss',
    status: 'active',
  },
  'cnn_health': {
    display_name: 'CNN Health',
    rss: 'http://rss.cnn.com/rss/cnn_health.rss',
    status: 'active',
  },
  'consumer_guide': {
    display_name: 'Consumer Guide',
    rss: 'https://blog.consumerguide.com/feed/',
    status: 'active',
  },
  'cooling_post': {
    display_name: 'Cooling Post',
    rss: 'https://www.coolingpost.com/feed/',
    status: 'active',
  },
  'digital_trends': {
    display_name: 'Digital Trends',
    rss: 'https://www.digitaltrends.com/feed/',
    status: 'active',
  },
  'drug_discovery_world': {
    display_name: 'Drug Discovery World',
    rss: 'https://www.ddw-online.com/feed/',
    status: 'active',
  },
  'endpoints_news': {
    display_name: 'Endpoints News',
    rss: 'https://endpts.com/feed/',
    status: 'active',
    notes: 'Free RSS feed; some articles paywalled but headlines and free articles work.',
  },
  'evening_standard': {
    display_name: 'Evening Standard',
    rss: 'https://www.standard.co.uk/rss',
    status: 'active',
  },
  'fast_company': {
    display_name: 'Fast Company',
    rss: 'https://www.fastcompany.com/latest/rss',
    status: 'active',
  },
  'financial_times': {
    display_name: 'Financial Times',
    rss: 'https://www.ft.com/rss/home',
    status: 'paid',
  },
  'firstword_pharma': {
    display_name: 'FirstWord Pharma',
    rss: '',
    status: 'paid',
  },
  'forbes': {
    display_name: 'Forbes',
    rss: 'https://www.forbes.com/innovation/feed2/',
    status: 'active',
  },
  'forbes_business': {
    display_name: 'Forbes Business',
    rss: 'https://www.forbes.com/business/feed/',
    status: 'active',
  },
  'fortune': {
    display_name: 'Fortune',
    rss: 'https://fortune.com/feed/',
    status: 'active',
  },
  'fox_health': {
    display_name: 'FOX News Health',
    rss: 'https://moxie.foxnews.com/google-publisher/health.xml',
    status: 'active',
  },
  'fox_news': {
    display_name: 'FOX News',
    rss: 'https://moxie.foxnews.com/google-publisher/latest.xml',
    status: 'active',
  },
  'genetic_engineering_news': {
    display_name: 'Genetic Engineering & Biotechnology News',
    rss: 'https://www.genengnews.com/feed/',
    status: 'active',
  },
  'globe_newswire': {
    display_name: 'GlobeNewswire',
    rss: 'https://www.globenewswire.com/RssFeed/subjectcode/15-Pharmaceuticals',
    status: 'active',
  },
  'gq': {
    display_name: 'GQ',
    rss: 'https://www.gq.com/feed/rss',
    status: 'active',
  },
  'healthcare_dive': {
    display_name: 'Healthcare Dive',
    rss: 'https://www.healthcaredive.com/feeds/news/',
    status: 'active',
  },
  'healthline': {
    display_name: 'Healthline',
    rss: 'https://www.healthline.com/rss/health-news',
    status: 'active',
  },
  'inside_health_policy': {
    display_name: 'Inside Health Policy',
    rss: '',
    status: 'paid',
  },
  'jalopnik': {
    display_name: 'Jalopnik',
    rss: 'https://jalopnik.com/rss',
    status: 'active',
  },
  'jama_network': {
    display_name: 'JAMA Network',
    rss: 'https://jamanetwork.com/rss/site_3/67.xml',
    status: 'active',
  },
  'liver_disease_news': {
    display_name: 'Liver Disease News',
    rss: 'https://liverdiseasenews.com/feed/',
    status: 'active',
  },
  'los_angeles_times': {
    display_name: 'Los Angeles Times',
    rss: 'https://www.latimes.com/local/rss2.0.xml',
    status: 'active',
  },
  'medcity_news': {
    display_name: 'MedCity News',
    rss: 'https://medcitynews.com/feed/',
    status: 'active',
  },
  'medical_daily': {
    display_name: 'Medical Daily',
    rss: 'https://www.medicaldaily.com/rss',
    status: 'active',
  },
  'medical_xpress': {
    display_name: 'Medical Xpress',
    rss: 'https://medicalxpress.com/rss-feed/',
    status: 'active',
  },
  'medpage_today': {
    display_name: 'MedPage Today',
    rss: 'https://www.medpagetoday.com/rss/headlines.xml',
    status: 'active',
  },
  'medscape': {
    display_name: 'Medscape',
    rss: 'https://www.medscape.com/cx/rssfeeds/2700.xml',
    status: 'active',
  },
  'medwatch': {
    display_name: 'MedWatch',
    rss: '',
    status: 'paid',
  },
  'mens_health': {
    display_name: 'Men’s Health',
    rss: 'https://www.menshealth.com/rss/all.xml/',
    status: 'active',
  },
  'mens_journal': {
    display_name: 'Men\'s Journal',
    rss: 'https://www.mensjournal.com/feed',
    status: 'active',
  },
  'motor1': {
    display_name: 'Motor1',
    rss: 'https://www.motor1.com/rss/articles/all/',
    status: 'active',
  },
  'nbc_health': {
    display_name: 'NBC Health',
    rss: 'https://feeds.nbcnews.com/nbcnews/public/health',
    status: 'active',
  },
  'nbc_news': {
    display_name: 'NBC News',
    rss: 'https://feeds.nbcnews.com/nbcnews/public/news',
    status: 'active',
  },
  'new_york_times': {
    display_name: 'The New York Times',
    rss: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    status: 'paid',
  },
  'new_york_times_auto': {
    display_name: 'New York Times (Autos)',
    rss: 'https://rss.nytimes.com/services/xml/rss/nyt/Automobiles.xml',
    status: 'active',
  },
  'news_nation': {
    display_name: 'News Nation',
    rss: 'https://www.newsnationnow.com/feed/',
    status: 'active',
  },
  'newsweek': {
    display_name: 'Newsweek',
    rss: 'https://www.newsweek.com/rss',
    status: 'active',
  },
  'npr': {
    display_name: 'NPR',
    rss: 'https://feeds.npr.org/1001/rss.xml',
    status: 'active',
  },
  'npr_health': {
    display_name: 'NPR Health',
    rss: 'https://feeds.npr.org/1128/rss.xml',
    status: 'active',
  },
  'oncozine': {
    display_name: 'Onco\'Zine',
    rss: 'https://oncozine.com/feed/',
    status: 'active',
  },
  'pharmaceutical_technology': {
    display_name: 'Pharmaceutical Technology',
    rss: 'https://www.pharmaceutical-technology.com/feed/',
    status: 'active',
  },
  'philadelphia_inquirer': {
    display_name: 'Philadelphia Inquirer',
    rss: 'https://www.inquirer.com/arc/outboundfeeds/rss/?outputType=xml',
    status: 'active',
  },
  'pink_sheet': {
    display_name: 'Pink Sheet',
    rss: '',
    status: 'paid',
  },
  'politico': {
    display_name: 'POLITICO',
    rss: 'https://rss.politico.com/healthcare.xml',
    status: 'active',
  },
  'pr_newswire': {
    display_name: 'PR Newswire',
    rss: 'https://www.prnewswire.com/rss/news-releases-list.rss',
    status: 'active',
  },
  'road_and_track': {
    display_name: 'Road & Track',
    rss: 'https://www.roadandtrack.com/rss/all.xml/',
    status: 'active',
  },
  'scrip': {
    display_name: 'Scrip',
    rss: '',
    status: 'paid',
  },
  'seeking_alpha': {
    display_name: 'Seeking Alpha',
    rss: 'https://seekingalpha.com/feed.xml',
    status: 'paid',
  },
  'sky_news': {
    display_name: 'Sky News',
    rss: 'https://feeds.skynews.com/feeds/rss/home.xml',
    status: 'active',
  },
  'slashgear': {
    display_name: 'SlashGear',
    rss: 'https://www.slashgear.com/feed/',
    status: 'active',
  },
  'stat_news': {
    display_name: 'STAT News',
    rss: 'https://www.statnews.com/feed/',
    status: 'active',
    notes: 'Free RSS feed; some articles paywalled but headlines and free articles work.',
  },
  'tflcar': {
    display_name: 'TFLCar',
    rss: 'https://tflcar.com/feed/',
    status: 'active',
  },
  'the_blaze': {
    display_name: 'The Blaze',
    rss: 'https://www.theblaze.com/feeds/feed.rss',
    status: 'active',
  },
  'the_daily_mail': {
    display_name: 'The Daily Mail',
    rss: 'https://www.dailymail.co.uk/articles.rss',
    status: 'active',
  },
  'the_daily_wire': {
    display_name: 'The Daily Wire',
    rss: 'https://www.dailywire.com/feeds/rss.xml',
    status: 'active',
  },
  'the_economist': {
    display_name: 'The Economist',
    rss: 'https://www.economist.com/latest/rss.xml',
    status: 'paid',
  },
  'the_express': {
    display_name: 'The Express',
    rss: 'https://www.express.co.uk/posts/rss/1/news',
    status: 'active',
  },
  'the_guardian': {
    display_name: 'The Guardian',
    rss: 'https://www.theguardian.com/uk/rss',
    status: 'active',
  },
  'the_guardian_business': {
    display_name: 'The Guardian Business',
    rss: 'https://www.theguardian.com/uk/business/rss',
    status: 'active',
  },
  'the_hill': {
    display_name: 'The Hill',
    rss: 'https://thehill.com/rss/syndicator/19110',
    status: 'active',
  },
  'the_mail_on_sunday': {
    display_name: 'The Mail on Sunday',
    rss: 'https://www.dailymail.co.uk/articles.rss',
    status: 'active',
  },
  'the_mirror': {
    display_name: 'The Mirror',
    rss: 'https://www.mirror.co.uk/?service=rss',
    status: 'active',
  },
  'the_pharma_letter': {
    display_name: 'The Pharma Letter',
    rss: '',
    status: 'paid',
  },
  'the_telegraph': {
    display_name: 'The Telegraph',
    rss: 'https://www.telegraph.co.uk/rss.xml',
    status: 'paid',
  },
  'this_is_money': {
    display_name: 'This is Money',
    rss: 'https://www.thisismoney.co.uk/money/index.rss',
    status: 'active',
  },
  'time_magazine': {
    display_name: 'Time',
    rss: 'https://time.com/feed/',
    status: 'active',
  },
  'topspeed': {
    display_name: 'TopSpeed',
    rss: 'https://www.topspeed.com/feed',
    status: 'active',
  },
  'two_minute_medicine': {
    display_name: '2 Minute Medicine',
    rss: 'https://www.2minutemedicine.com/feed/',
    status: 'active',
  },
  'wall_street_journal': {
    display_name: 'Wall Street Journal',
    rss: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
    status: 'paid',
  },
  'washington_examiner': {
    display_name: 'Washington Examiner',
    rss: 'https://www.washingtonexaminer.com/feed',
    status: 'active',
  },
  'washington_post': {
    display_name: 'The Washington Post',
    rss: 'https://feeds.washingtonpost.com/rss/national',
    status: 'paid',
  },
  'wired': {
    display_name: 'Wired',
    rss: 'https://www.wired.com/feed/rss',
    status: 'active',
  },
  'yahoo_news': {
    display_name: 'Yahoo! News',
    rss: 'https://news.yahoo.com/rss/',
    status: 'active',
  },
} as const satisfies Record<string, Publication>;

export type PublicationKey = keyof typeof PUBLICATIONS;
