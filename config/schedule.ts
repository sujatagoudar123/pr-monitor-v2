/**
 * Email schedule configuration.
 *
 * THIS IS THE FILE YOU EDIT TO CHANGE WHO GETS EMAILED AND WHEN.
 *
 * How it works:
 *   - Each `slot` is one Vercel Cron entry that fires at the given UTC time.
 *   - When the cron fires, `/api/cron-send` reads `?slot=<id>` and runs the
 *     agent for each company in the slot, then emails each result.
 *   - Per-slot lookback: send 1 of the day uses 72h (catches up overnight),
 *     send 2 uses a shorter window (say 6h) so it only catches what's NEW
 *     since send 1, etc. This prevents duplicate articles across sends.
 *   - To change recipients per company WITHOUT redeploying, set env vars:
 *       RECIPIENTS_<COMPANY>      → TO list
 *       RECIPIENTS_<COMPANY>_CC   → CC list
 *
 * Schedule (current):
 *
 *   send_time UTC | send_time IST  | cron trigger | covers
 *   --------------|----------------|--------------|----------------------
 *   05:00         | 10:30 AM IST   | 04:55 UTC    | GSK send 1
 *   05:30         | 11:00 AM IST   | 05:25 UTC    | BeOne send 1, Otsuka send 1
 *   06:00         | 11:30 AM IST   | 05:55 UTC    | Mazda, Trane, Amgen send 1
 *   10:00         | 03:30 PM IST   | 09:55 UTC    | GSK send 2
 *   11:00         | 04:30 PM IST   | 10:55 UTC    | Otsuka send 2
 *   11:30         | 05:00 PM IST   | 11:25 UTC    | BeOne send 2
 *   12:00         | 05:30 PM IST   | 11:55 UTC    | GSK send 3, Mazda, Trane, Amgen send 2
 *   14:00         | 07:30 PM IST   | 13:55 UTC    | Indivior send 1
 */

export interface ScheduleSlot {
  id: string;
  label: string;
  istTime: string;
  companies: string[];
  /**
   * How many hours back this slot looks for articles.
   * Send 1 of the day → 72 (full overnight catchup).
   * Send 2 → 6 (only what's new since send 1 ~5h earlier).
   * Send 3 → 6 (only what's new since send 2 ~2-5h earlier).
   * Tweak per slot if needed. Falls back to FRESHNESS_HOURS env var if undefined.
   */
  lookbackHours?: number;
}

export const SCHEDULE: ScheduleSlot[] = [
  // First sends of the day — 72h window to catch overnight news
  { id: 'slot-0500-utc', label: '10:30 AM IST — GSK Send 1', istTime: '10:30 IST', companies: ['GSK'], lookbackHours: 72 },
  { id: 'slot-0530-utc', label: '11:00 AM IST — Send 1', istTime: '11:00 IST', companies: ['BeOne', 'Otsuka'], lookbackHours: 72 },
  { id: 'slot-0600-utc', label: '11:30 AM IST — Send 1', istTime: '11:30 IST', companies: ['Mazda', 'Trane', 'Amgen'], lookbackHours: 72 },

  // Second sends — 6h window to only catch what's new since send 1
  { id: 'slot-1000-utc', label: '03:30 PM IST — GSK Send 2', istTime: '15:30 IST', companies: ['GSK'], lookbackHours: 6 },
  { id: 'slot-1100-utc', label: '04:30 PM IST — Otsuka Send 2', istTime: '16:30 IST', companies: ['Otsuka'], lookbackHours: 6 },
  { id: 'slot-1130-utc', label: '05:00 PM IST — BeOne Send 2', istTime: '17:00 IST', companies: ['BeOne'], lookbackHours: 7 },

  // Third sends / second sends for some companies — 6h window
  { id: 'slot-1200-utc', label: '05:30 PM IST — Send 2/3', istTime: '17:30 IST', companies: ['GSK', 'Mazda', 'Trane', 'Amgen'], lookbackHours: 6 },

  // Late day Indivior send 1 — 72h since this is the only send of the day
  { id: 'slot-1400-utc', label: '07:30 PM IST — Indivior Send 1', istTime: '19:30 IST', companies: ['Indivior'], lookbackHours: 72 },
];

export function getSlot(id: string | null | undefined): ScheduleSlot | undefined {
  if (!id) return undefined;
  return SCHEDULE.find((s) => s.id === id);
}

export function resolveRecipients(company: string): { to: string[]; cc: string[] } {
  const key = company.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const toRaw =
    process.env[`RECIPIENTS_${key}`] ??
    process.env.DEFAULT_RECIPIENTS ??
    '';
  const ccRaw =
    process.env[`RECIPIENTS_${key}_CC`] ??
    process.env.DEFAULT_CC ??
    '';
  const split = (s: string) =>
    s.split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean);
  return { to: split(toRaw), cc: split(ccRaw) };
}
