# PR Monitor Agent v1 — Complete Deployable Codebase

A production-ready, Claude-powered PR monitoring agent with **72-hour freshness filtering** and **automated scheduled emails** via Vercel Cron.

This is a complete standalone codebase. Clone it into a new repo, deploy to a separate Vercel project, and test in isolation without touching your existing production deployment.

---

## How it works end-to-end

```
                              ┌─────────────────────────┐
   8 daily Vercel Crons  ──▶  │  /api/cron-send?slot=X  │
                              └────────────┬────────────┘
                                           │ for each company in slot:
                                           ▼
                              ┌─────────────────────────┐
                              │  /api/agent-search      │  ← Claude agent loop
                              │                         │
                              │  1. Claude plans which  │
                              │     sources to query    │
                              │  2. Parallel tool calls:│
                              │     RSS, Google News,   │
                              │     NewsAPI, Bing News, │
                              │     HTML scraping       │
                              │  3. Dedupe (URL+title)  │
                              │  4. Claude ranks each   │
                              │     article 0.0–1.0     │
                              │  5. 72h freshness filter│
                              │  6. Claude writes a 2-3 │
                              │     sentence summary    │
                              └────────────┬────────────┘
                                           │ articles + summary
                                           ▼
                              ┌─────────────────────────┐
                              │  /api/send-email        │
                              │                         │
                              │  • Builds HTML email    │
                              │  • SMTP via AWS SES     │
                              │  • To/CC per company    │
                              │    from env vars        │
                              └────────────┬────────────┘
                                           ▼
                                  Recipients get email
```

### The 72-hour freshness filter

`lib/freshness.ts` is the single source of truth. After ranking, every article is checked:

- Has parseable `publishedAt` and is ≤ 72h old → **kept**, tagged with `ageHours`
- Has parseable `publishedAt` and is > 72h old → **dropped**
- No `publishedAt` at all (common for scraped pages) → **kept**, tagged `undated: true` so the UI shows an "undated" badge

The 72h value is read from `FRESHNESS_HOURS` env var, so you can change it without redeploying logic.

### The scheduled email flow

8 cron entries in `vercel.json` fire at fixed UTC times. Each calls `/api/cron-send?slot=<id>`. The slot config in `config/schedule.ts` says which companies run in that slot. For each company:

1. Cron route calls `/api/agent-search` internally with `{ company: "GSK" }`
2. Cron route re-applies freshness defensively (already done by agent-search)
3. Cron route looks up recipients from env vars: `RECIPIENTS_GSK` (TO) and `RECIPIENTS_GSK_CC` (CC)
4. Cron route calls `/api/send-email` to send the briefing
5. If zero articles → sends anyway with "No significant news in the last 72 hours" message

Cron URLs include `?slot=<id>` so one endpoint can serve all 8 schedules — no code duplication.

---

## File map (every file in this repo)

```
.
├── README.md                          ← you are here
├── package.json                       ← deps: anthropic-sdk, next, rss-parser, cheerio, nodemailer
├── next.config.js                     ← server-external packages
├── tsconfig.json
├── tailwind.config.js                 ← ivory/navy/gold palette
├── postcss.config.js
├── .gitignore
├── .env.example                       ← all env vars documented
├── vercel.json                        ← 8 cron entries + maxDuration
│
├── app/
│   ├── layout.tsx                     ← root layout
│   ├── globals.css                    ← Tailwind + base styles
│   ├── page.tsx                       ← main UI (search, results, agent trace, email modal)
│   └── api/
│       ├── agent-search/route.ts      ← POST — runs the agent end-to-end
│       ├── companies/route.ts         ← GET (list) + PATCH (edit keywords)
│       ├── send-email/route.ts        ← POST — sends one briefing via SMTP
│       ├── health/route.ts            ← GET — env diagnostics
│       └── cron-send/route.ts         ← GET — cron-hit entrypoint
│
├── config/
│   └── schedule.ts                    ← *** EDIT THIS to change schedule/companies ***
│
├── data/
│   └── companies.ts                   ← *** EDIT THIS to change keywords/RSS feeds ***
│
└── lib/
    ├── freshness.ts                   ← 72h filter (single source of truth)
    ├── types.ts                       ← shared TS types
    ├── agent/
    │   ├── agent.ts                   ← Claude tool-use loop
    │   ├── dedupe.ts                  ← URL + title dedup
    │   └── rank.ts                    ← batched LLM ranking + summary
    └── sources/
        ├── rss.ts                     ← rss-parser
        ├── google-news.ts             ← Google News RSS (no key)
        ├── newsapi.ts                 ← NewsAPI.org (optional)
        ├── bing-news.ts               ← Bing News v7 (optional)
        └── scrape.ts                  ← cheerio HTML scraping
```

---

## Deployment — step by step

### 1. Push to a new repo

```bash
# After extracting the project:
cd pr-monitor-v2
git init
git add .
git commit -m "initial deploy"
git remote add origin git@github.com:YOU/pr-monitor-v2-test.git
git push -u origin main
```

### 2. Create a new Vercel project

- Go to https://vercel.com/new
- Import the new repo
- Framework preset: **Next.js** (auto-detected)
- Build & install commands: leave default (vercel.json overrides them anyway)
- Click Deploy. The first deploy will fail or run with placeholder env vars — that's fine.

### 3. Set environment variables in Vercel

Project Settings → Environment Variables. Add for **Production**, **Preview**, and **Development**:

| Variable | Required? | Example |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Yes | `sk-ant-…` |
| `ANTHROPIC_MODEL` | optional | `claude-haiku-4-5-20251001` |
| `FRESHNESS_HOURS` | optional | `72` |
| `SMTP_HOST` | ✅ Yes | `email-smtp.us-east-1.amazonaws.com` |
| `SMTP_PORT` | ✅ Yes | `587` |
| `SMTP_USER` | ✅ Yes | your SES SMTP username |
| `SMTP_PASS` | ✅ Yes | your SES SMTP password |
| `SMTP_FROM` | ✅ Yes | `"PR Monitor <pr@yourdomain.com>"` |
| `CRON_SECRET` | ✅ Yes (prod) | `openssl rand -hex 32` output |
| `PUBLIC_BASE_URL` | recommended | `https://pr-monitor-v2.vercel.app` |
| `RECIPIENTS_GSK` | for each company | `client@gsk.example.com` |
| `RECIPIENTS_GSK_CC` | optional | `manager@yours.com` |
| `RECIPIENTS_BEONE` | … | … |
| `RECIPIENTS_OTSUKA` | | |
| `RECIPIENTS_MAZDA` | | |
| `RECIPIENTS_TRANE` | | |
| `RECIPIENTS_AMGEN` | | |
| `RECIPIENTS_INDIVIOR` | | |
| `DEFAULT_RECIPIENTS` | fallback | `ops@yours.com` |
| `NEWSAPI_KEY` | optional | NewsAPI.org key |
| `BING_NEWS_API_KEY` | optional | Azure Bing v7 key |

### 4. Redeploy

After setting env vars, click **Redeploy** in Vercel. This time the build will pick them up.

### 5. Verify

Visit `https://your-project.vercel.app/api/health` — you'll see a JSON dump of which env vars are set and which slots/companies have recipients configured. Fix anything that says `false` where it shouldn't.

### 6. Check that cron jobs registered

In Vercel dashboard → your project → **Cron Jobs** tab. You should see 8 entries with their next scheduled run times. If you see "Cron jobs require a paid plan", upgrade to Pro.

### 7. Manual smoke test

Trigger a slot manually (replace the host and use your `CRON_SECRET`):

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     "https://pr-monitor-v2.vercel.app/api/cron-send?slot=slot-0500-utc"
```

You should get a JSON response listing each company in the slot, whether the email was sent, and how many articles were found. Check your recipient inbox.

### 8. Watch the first scheduled run

Vercel Cron logs are under **Logs → Functions → /api/cron-send**. You'll see invocations at the scheduled times.

---

## Where & how to change things later

### Change the freshness window (e.g. 48h or 7 days)

**Vercel → Environment Variables → `FRESHNESS_HOURS`** → save → redeploy. No code change.

### Change WHEN an email fires

Edit `vercel.json` `crons[].schedule`. Cron syntax is `minute hour day month weekday`, **UTC**. Push to redeploy.

```json
{ "path": "/api/cron-send?slot=slot-0500-utc", "schedule": "55 4 * * *" }
//                                                          ↑  ↑
//                                                       min  hour (UTC)
```

If you change the time, you may also want to update the `istTime` label in `config/schedule.ts` for clarity (it only affects what shows in the email header).

### Change WHICH companies fire in a slot

Edit `config/schedule.ts` → find the slot → update `companies: [...]` array. Push.

### Change WHO receives a company's email

**Vercel → Environment Variables → `RECIPIENTS_GSK`** (or whichever company). No code change, no redeploy. Cron reads env vars fresh on every invocation.

### Change a company's keywords (PR-monitored terms)

**Two options:**

- **Permanent** — edit `data/companies.ts`, change the `keywords` array for that company, push.
- **Quick** — in the UI, hover a company chip → click the pencil icon → edit comma-separated list → Save. This persists in memory until the server cold-starts.

### Add a new company

Edit `data/companies.ts`, add a new entry to `COMPANIES`:

```ts
{
  name: 'NewCorp',
  keywords: ['NewCorp', 'NewCorpProduct', ...],
  rssFeeds: [
    { url: 'https://example.com/feed', source: 'Example' },
    ...generalHealthFeeds,
  ],
  scrapeTargets: ['fiercepharma.com'],
},
```

Then either add it to an existing slot in `config/schedule.ts`, or create a new slot.

### Add a new schedule slot

1. Add an entry to `SCHEDULE` in `config/schedule.ts` with a **unique `id`**:
   ```ts
   { id: 'slot-1530-utc', label: '09:00 PM IST', istTime: '21:00 IST', companies: ['SomeCo'] }
   ```
2. Add a matching entry to `vercel.json` `crons` with `?slot=slot-1530-utc` and the cron expression.
3. Push.

### Migrate your 279 RSS feeds from Excel

The starter `data/companies.ts` has a representative subset. Your live deployment has 279 feeds from an Excel sheet. To bring them in:

- Open your Excel, group rows by company, get `{ url, source }` per feed.
- Replace each company's `rssFeeds: [...]` in `data/companies.ts`.
- Or script it: write a Node script that reads the Excel via SheetJS and emits the TS file.

---

## Local development

```bash
git clone <your-new-repo>
cd pr-monitor-v2
npm install
cp .env.example .env.local
# Edit .env.local — at minimum: ANTHROPIC_API_KEY and SMTP_* vars
npm run dev
# → http://localhost:3000
```

Test the cron flow locally (CRON_SECRET unset → endpoint is open):
```bash
curl "http://localhost:3000/api/cron-send?slot=slot-0500-utc"
```

---

## Current schedule (reference)

| Cron (UTC) | Nominal send (UTC) | IST | Slot ID | Companies |
|---|---|---|---|---|
| `55 4 * * *` | 05:00 | 10:30 AM | `slot-0500-utc` | GSK |
| `25 5 * * *` | 05:30 | 11:00 AM | `slot-0530-utc` | BeOne, Otsuka |
| `55 5 * * *` | 06:00 | 11:30 AM | `slot-0600-utc` | Mazda, Trane, Amgen |
| `55 9 * * *` | 10:00 | 03:30 PM | `slot-1000-utc` | GSK (send 2) |
| `55 10 * * *` | 11:00 | 04:30 PM | `slot-1100-utc` | Otsuka (send 2) |
| `25 11 * * *` | 11:30 | 05:00 PM | `slot-1130-utc` | BeOne (send 2) |
| `55 11 * * *` | 12:00 | 05:30 PM | `slot-1200-utc` | GSK (send 3), Mazda, Trane, Amgen |
| `55 13 * * *` | 14:00 | 07:30 PM | `slot-1400-utc` | Indivior |

> Cron fires 5 minutes BEFORE the nominal send time to account for the agent loop + ranking + email taking 20–90s, so emails land around the listed send time.

---

## Production checklist

- ✅ Vercel project on **Pro plan or higher** (required for cron + `maxDuration > 60s`)
- ✅ `ANTHROPIC_API_KEY` set
- ✅ All `SMTP_*` env vars set
- ✅ SES sender domain verified, project out of SES sandbox (or recipients are SES-verified)
- ✅ `CRON_SECRET` set (otherwise cron endpoint is open to the world)
- ✅ `PUBLIC_BASE_URL` set to your live domain
- ✅ At least `DEFAULT_RECIPIENTS` set so no slot silently skips
- ✅ Verified all 8 cron entries appear in Vercel dashboard
- ✅ Manual `curl` test of one cron slot succeeded and email was received
- ✅ `/api/health` reports all expected `true` flags

---

## Cost estimate

| Item | Volume | Cost |
|---|---|---|
| Anthropic Haiku per company-run | ~$0.02 | |
| 8 slots/day × avg 2 companies = 16 runs/day | 480/mo | ~**$10/mo** |
| AWS SES emails | 480/mo | ~$0.05/mo |
| Vercel Pro plan | flat | $20/mo |
| **Total** | | **~$30/mo** |

Switch `ANTHROPIC_MODEL` to a Sonnet variant for smarter ranking at ~10× the LLM cost.
