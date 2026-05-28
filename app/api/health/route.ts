/**
 * GET /api/health — diagnostic. Tells you which env vars are set.
 * Returns 200 always; the boolean flags say what's healthy.
 */

import { NextResponse } from 'next/server';
import { SCHEDULE } from '@/config/schedule';
import { getLookbackHours } from '@/lib/freshness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? 'default(claude-haiku-4-5)',
      NEWSAPI_KEY: Boolean(process.env.NEWSAPI_KEY),
      BING_NEWS_API_KEY: Boolean(process.env.BING_NEWS_API_KEY),
      SMTP_HOST: Boolean(process.env.SMTP_HOST),
      SMTP_USER: Boolean(process.env.SMTP_USER),
      SMTP_PASS: Boolean(process.env.SMTP_PASS),
      SMTP_FROM: Boolean(process.env.SMTP_FROM),
      CRON_SECRET: Boolean(process.env.CRON_SECRET),
      PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? null,
      VERCEL_URL: process.env.VERCEL_URL ?? null,
      FRESHNESS_HOURS: getLookbackHours(),
    },
    schedule: SCHEDULE.map((s) => ({
      id: s.id,
      label: s.label,
      istTime: s.istTime,
      companies: s.companies,
      recipientsConfigured: s.companies.map((c) => {
        const key = c.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
        return {
          company: c,
          hasTo: Boolean(process.env[`RECIPIENTS_${key}`] || process.env.DEFAULT_RECIPIENTS),
          hasCc: Boolean(process.env[`RECIPIENTS_${key}_CC`] || process.env.DEFAULT_CC),
        };
      }),
    })),
  });
}
