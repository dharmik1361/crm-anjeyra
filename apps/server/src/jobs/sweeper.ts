import { applyQuoteAction, findDueQuotes } from "@qf/db";
import type { Logger } from "pino";

/**
 * Advance every quote whose next action is due. Mongo is the source of truth for timing, so this
 * is safe to run repeatedly, after restarts, and on more than one worker (writes are
 * optimistically locked in applyQuoteAction).
 */
export async function sweepOnce(log: Logger, now = new Date()) {
  let advanced = 0;
  let failed = 0;
  for (;;) {
    const due = await findDueQuotes(now, 200);
    if (!due.length) break;
    let progressed = 0;
    for (const d of due) {
      try {
        const res = await applyQuoteAction(String(d.tenantId), String(d._id), { type: "advance" }, null, { now });
        if (res) {
          advanced++;
          progressed++;
        }
      } catch (err) {
        failed++;
        log.error({ err, quoteId: String(d._id) }, "sweep: failed to advance quote");
      }
    }
    if (!progressed) break; // everything left is failing or contended; retry next tick
  }
  if (advanced || failed) log.info({ advanced, failed }, "sweep done");
  return { advanced, failed };
}
