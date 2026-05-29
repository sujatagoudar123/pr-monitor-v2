/**
 * GET  /api/test-email           → returns SMTP env diagnostic + transporter verify
 * POST /api/test-email { to }    → sends a minimal test message and returns the
 *                                  full SMTP response (or the actual error message).
 *
 * Use this to debug "MAILER-DAEMON" bounces. The bounce is SES telling you
 * either:
 *   (a) Your sender (SMTP_FROM) is NOT a verified identity in SES
 *   (b) Your SES account is in sandbox mode and the recipient is also unverified
 *   (c) The recipient address rejected the message (typo / mailbox full)
 *   (d) SPF/DKIM not set up on the FROM domain
 *
 * This endpoint surfaces the smtpResponse so you know which it is.
 */

import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function GET() {
  const t = buildTransport();
  const config = {
    host: process.env.SMTP_HOST ?? null,
    port: process.env.SMTP_PORT ?? null,
    user: process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 6)}…` : null,
    from: process.env.SMTP_FROM ?? null,
  };
  if (!t) return NextResponse.json({ ok: false, config, error: 'SMTP_HOST/USER/PASS not all set' });
  try {
    await t.verify();
    return NextResponse.json({ ok: true, config, smtp: 'verified' });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      config,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(req: NextRequest) {
  let body: { to?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON, expected { to: "x@y.com" }' }, { status: 400 });
  }
  if (!body.to) return NextResponse.json({ error: '`to` required' }, { status: 400 });

  const t = buildTransport();
  if (!t) return NextResponse.json({ error: 'SMTP env vars not configured' }, { status: 500 });

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  try {
    const info = await t.sendMail({
      from,
      to: body.to,
      subject: 'PR Monitor — SMTP Test',
      text: 'If you see this email, SMTP is configured correctly.',
      html: '<p>If you see this email, SMTP is configured correctly.</p>',
    });
    return NextResponse.json({
      ok: true,
      from,
      to: body.to,
      messageId: info.messageId,
      smtpResponse: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
      hints: [
        'A 250 response means SES accepted the message for delivery.',
        'If you still get a MAILER-DAEMON bounce afterwards, the recipient address itself rejected it,',
        'OR your SES is in sandbox mode and the recipient is not a verified identity.',
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      from,
      to: body.to,
      error: message,
      likelyCauses: [
        message.includes('not verified') || message.includes('MessageRejected')
          ? 'SES sender or recipient is NOT a verified identity. Check SES console → Verified identities.'
          : null,
        message.toLowerCase().includes('auth') ? 'SMTP credentials wrong. Re-generate via SES → SMTP Settings.' : null,
        message.toLowerCase().includes('timeout') ? 'SMTP_HOST or SMTP_PORT wrong, or outbound port blocked.' : null,
      ].filter(Boolean),
    }, { status: 500 });
  }
}
