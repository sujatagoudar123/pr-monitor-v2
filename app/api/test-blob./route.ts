/**
 * Diagnostic endpoint — tests the Vercel Blob seen-tracker end-to-end.
 *
 * GET /api/test-blob?company=TestCo
 *   1. Writes 2 fake URLs to the seen tracker for TestCo
 *   2. Reads them back
 *   3. Runs filterUnseen against a list including 1 known + 2 new URLs
 *   4. Returns the full result
 *
 * If this works, the seen-tracker works. If it fails, the response shows why.
 * Visit https://your-app.vercel.app/api/test-blob in a browser after deploy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { filterUnseen, markSent, seenStatus } from '@/lib/seen';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const company = req.nextUrl.searchParams.get('company') || 'TestCo';
  const steps: Record<string, unknown> = {};
  steps.step0_status = seenStatus();
  steps.step0_token_set = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({
      ok: false,
      reason: 'BLOB_READ_WRITE_TOKEN not set in this environment. Connect the Blob store to this project and redeploy.',
      steps,
    }, { status: 500 });
  }

  try {
    // Step 1: write two URLs
    const fakeUrls = [
      `https://example.com/test-1-${Date.now()}`,
      `https://example.com/test-2-${Date.now()}`,
    ];
    await markSent(company, fakeUrls);
    steps.step1_wrote = fakeUrls;

    // Step 2: filter — both should now be "seen"
    const filter1 = await filterUnseen(company, fakeUrls.map((u) => ({ link: u })));
    steps.step2_filter_known = {
      input: fakeUrls.length,
      unseen: filter1.unseen.length,
      skipped: filter1.skipped,
      expected: 'unseen=0, skipped=2',
    };

    // Step 3: filter with mixed — 1 known + 2 brand new
    const newUrl1 = `https://example.com/brand-new-a-${Date.now()}`;
    const newUrl2 = `https://example.com/brand-new-b-${Date.now()}`;
    const filter2 = await filterUnseen(company, [
      { link: fakeUrls[0] },
      { link: newUrl1 },
      { link: newUrl2 },
    ]);
    steps.step3_filter_mixed = {
      input: 3,
      unseen: filter2.unseen.length,
      skipped: filter2.skipped,
      expected: 'unseen=2, skipped=1',
    };

    const allGood =
      filter1.skipped === 2 && filter1.unseen.length === 0 &&
      filter2.skipped === 1 && filter2.unseen.length === 2;

    return NextResponse.json({
      ok: allGood,
      message: allGood
        ? '✅ Blob storage works. Your cron sends will now deduplicate.'
        : '❌ Something is wrong. Check Vercel function logs for [seen] entries.',
      steps,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      steps,
    }, { status: 500 });
  }
}
