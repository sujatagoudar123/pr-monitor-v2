# Paid Publications — How to Subscribe and Enable

The codebase wires **86 free, public RSS feeds**. An additional ~20 publications
in your monitoring list are **paywalled or subscription-only**. Their RSS URLs
are listed (commented out) in `data/companies.ts`, so they're easy to enable
once you have a subscription.

Until then, headlines from most of these publications **still appear** in
results — the Google News source indexes them and surfaces their public
snippets even when the article body itself is paywalled.

---

## Enabling a paid publication

1. Acquire a subscription (see vendor list below).
2. Open `data/companies.ts`.
3. Find the company's `rssFeeds: feeds(...)` call.
4. Uncomment the line for the publication you've subscribed to.
5. Commit and push. Vercel redeploys automatically.

Some paid RSS feeds require an authenticated URL (with an embedded token).
For those, paste the personalized RSS URL into `lib/publications.ts` under the
right key, replacing the default `rss` value. **Never commit the token to
GitHub** — keep that URL in `.env.local` and load it via env var.

---

## Vendor list

### Financial news

| Publication | Vendor | How to subscribe |
|---|---|---|
| **Bloomberg / Bloomberg Law / Bloomberg Green** | Bloomberg | https://www.bloomberg.com/professional/solution/bloomberg-terminal/ (Terminal subscription ~$25K/yr) or https://www.bloomberg.com/subscriptions for digital ($35/mo). Authenticated RSS available to subscribers. |
| **Wall Street Journal** | Dow Jones | https://www.wsj.com/subscribe ($39/mo digital). Limited RSS to subscribers. |
| **Financial Times** | FT Group | https://www.ft.com/products ($75/mo Standard). RSS feeds work for free + headlines, but full text needs login. |
| **The Economist** | Economist Group | https://subscription.economist.com (~$200/yr digital). RSS feed has headlines only for non-subscribers. |
| **The Telegraph** | Telegraph Media Group | https://www.telegraph.co.uk/subscriptions (~£11/mo). |
| **Seeking Alpha** | Seeking Alpha Inc. | https://seekingalpha.com/subscriptions ($239/yr Premium). RSS works partially. |

### Pharma / biotech trade press

| Publication | Vendor | How to subscribe |
|---|---|---|
| **Pink Sheet, Scrip, Medtech Insight, In Vivo** | Citeline (formerly Informa) | Contact sales: https://www.citeline.com/contact-sales. Enterprise pricing only (~$5K–$30K/yr). |
| **BioCentury** | BioCentury Inc. | https://www.biocentury.com/subscribe (~$3,500/yr individual). |
| **BioWorld** | Clarivate | https://www.bioworld.com/subscribe (enterprise pricing). |
| **FirstWord Pharma** | Doctor's Guide Publishing | https://www.firstwordpharma.com/subscriptions. ~$1,200/yr. |
| **The Pharma Letter** | The Pharma Letter | https://www.thepharmaletter.com (~£500/yr individual). |
| **The Cancer Letter** | The Cancer Letter Inc. | https://cancerletter.com/subscribe (~$485/yr individual). |
| **MedWatch** | MedWatch ApS (Denmark) | https://medwatch.com/about-us (~€2,500/yr). Danish/English pharma trade. |
| **Inside Health Policy** | Inside Washington Publishers | https://insidehealthpolicy.com (enterprise pricing). |

### Endpoints News & STAT News — reclassified as ACTIVE

These are listed as "paid" in some sources but their RSS feeds are actually
**free and public** (`https://endpts.com/feed/`, `https://www.statnews.com/feed/`).
What's paid is their *premium* articles. Free articles + headlines come through
the RSS feed without a subscription. We've enabled both by default.

### General-news paywalls (NYT, WaPo, etc.)

| Publication | Vendor | How to subscribe |
|---|---|---|
| **New York Times** | The New York Times Co. | https://www.nytimes.com/subscription ($17/mo basic). RSS feeds work — headlines + summaries free. |
| **Washington Post** | Nash Holdings | https://subscribe.washingtonpost.com ($10/mo). RSS works similarly. |
| **The Times (UK)** | News UK | https://www.thetimes.co.uk/subscribe (£26/mo). No public RSS even for subscribers. |

### Auto / Local

| Publication | Vendor | How to subscribe |
|---|---|---|
| **Automotive News** | Crain Communications | https://www.autonews.com/customer-service (~$329/yr individual). |
| **Boston Globe** | Boston Globe Media | https://www.bostonglobe.com/subscribe. |
| **Detroit News** | MediaNews Group | https://www.detroitnews.com/subscribe. |
| **Charlotte Business Journal** | American City Business Journals | https://www.bizjournals.com/charlotte/subscribe. |

---

## Alternative: licensed news APIs

If your client has serious volume needs and wants to skip per-publisher
subscriptions, two consolidated APIs cover most of the above:

- **NewsAPI.org** — https://newsapi.org/pricing. $449/mo for unlimited. Covers Bloomberg, FT, Forbes, etc.
- **Bing News Search v7** — https://portal.azure.com (Cognitive Services). Pay-per-call, ~$3 per 1k queries.

This codebase already supports both. Set the env vars in Vercel:
```
NEWSAPI_KEY=...
BING_NEWS_API_KEY=...
```
The agent will automatically include them as sources.
