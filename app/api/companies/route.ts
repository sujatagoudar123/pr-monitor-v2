/**
 * GET  /api/companies  → list of all monitored companies with keywords + feed counts
 * PATCH /api/companies → update a company's keywords
 *   body: { name: "GSK", keywords: ["..."] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCompanies, updateCompanyKeywords } from '@/data/companies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const cs = getCompanies();
  return NextResponse.json({
    companies: cs.map((c) => ({
      name: c.name,
      keywords: c.keywords,
      feedCount: c.rssFeeds.length,
      scrapeTargets: c.scrapeTargets ?? [],
    })),
  });
}

export async function PATCH(req: NextRequest) {
  let body: { name?: string; keywords?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.name || !Array.isArray(body.keywords)) {
    return NextResponse.json({ error: 'name and keywords[] required' }, { status: 400 });
  }
  const updated = updateCompanyKeywords(body.name, body.keywords as string[]);
  if (!updated) return NextResponse.json({ error: 'Unknown company' }, { status: 404 });
  return NextResponse.json({
    name: updated.name,
    keywords: updated.keywords,
  });
}
