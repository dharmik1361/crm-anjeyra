import { ACTIVE_STATUSES, type QuoteStatus } from "./status.js";

/** PRD: "at risk" = an active quote more than 7 days old with no buyer reply. */
export const AT_RISK_AGE_DAYS = 7;

export interface SummaryQuote {
  status: QuoteStatus;
  amountPaise: number;
  sentAt: Date;
  repId: string;
  /** When the status last became won/lost (for "this week" totals). */
  closedAt?: Date | null;
}

export interface Bucket {
  count: number;
  amountPaise: number;
}

export interface Summary {
  open: Bucket;
  atRisk: Bucket;
  won: Bucket;
  lost: Bucket;
  byRep: Record<string, { open: Bucket; atRisk: Bucket; won: Bucket; lost: Bucket }>;
}

const empty = (): Bucket => ({ count: 0, amountPaise: 0 });
const add = (b: Bucket, paise: number) => {
  b.count++;
  b.amountPaise += paise;
};

export function isAtRisk(q: Pick<SummaryQuote, "status" | "sentAt">, now: Date): boolean {
  return (
    (q.status === "open" || q.status === "escalated") &&
    now.getTime() - q.sentAt.getTime() > AT_RISK_AGE_DAYS * 86_400_000
  );
}

/** Totals for the owner report. Won/lost count only quotes closed within [since, now]. */
export function summarize(quotes: SummaryQuote[], now: Date, since: Date): Summary {
  const s: Summary = { open: empty(), atRisk: empty(), won: empty(), lost: empty(), byRep: {} };
  for (const q of quotes) {
    const rep = (s.byRep[q.repId] ??= { open: empty(), atRisk: empty(), won: empty(), lost: empty() });
    const closedInWindow = !!q.closedAt && q.closedAt >= since && q.closedAt <= now;
    if (ACTIVE_STATUSES.includes(q.status)) {
      add(s.open, q.amountPaise);
      add(rep.open, q.amountPaise);
      if (isAtRisk(q, now)) {
        add(s.atRisk, q.amountPaise);
        add(rep.atRisk, q.amountPaise);
      }
    } else if (q.status === "won" && closedInWindow) {
      add(s.won, q.amountPaise);
      add(rep.won, q.amountPaise);
    } else if (q.status === "lost" && closedInWindow) {
      add(s.lost, q.amountPaise);
      add(rep.lost, q.amountPaise);
    }
  }
  return s;
}
