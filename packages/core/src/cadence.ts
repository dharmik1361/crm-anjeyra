import { addWorkingDays, nextSendableTime, type WorkCalendar } from "./calendar.js";

export interface CadenceConfig {
  /** Working days after the quote was sent at which the rep is reminded. PRD default: 2, 5, 10. */
  steps: number[];
  /** Working days after the last step with no outcome before the owner is told. */
  escalateAfter: number;
}

export const DEFAULT_CADENCE: CadenceConfig = { steps: [2, 5, 10], escalateAfter: 2 };

export function validateCadence(c: CadenceConfig): void {
  if (c.steps.length === 0) throw new Error("Cadence needs at least one step");
  c.steps.forEach((d, i) => {
    if (!Number.isInteger(d) || d < 1) throw new Error("Cadence steps must be positive integers");
    if (i > 0 && d <= c.steps[i - 1]!) throw new Error("Cadence steps must be strictly increasing");
  });
  if (!Number.isInteger(c.escalateAfter) || c.escalateAfter < 0) {
    throw new Error("escalateAfter must be a non-negative integer");
  }
}

/**
 * When the action for `step` is due. Steps 0..n-1 are rep reminders; step n is the owner
 * escalation. Returns null past the escalation (nothing left to schedule).
 */
export function scheduledAt(
  sentAt: Date,
  step: number,
  cadence: CadenceConfig,
  cal: WorkCalendar,
): Date | null {
  const { steps, escalateAfter } = cadence;
  let days: number;
  if (step < steps.length) days = steps[step]!;
  else if (step === steps.length) days = steps[steps.length - 1]! + escalateAfter;
  else return null;
  return nextSendableTime(addWorkingDays(sentAt, days, cal), cal);
}

/**
 * Like scheduledAt, but never earlier than `minGapDays` working days after `now`. An overdue
 * step goes out at the floor instead, so an old quote gets one reminder at a time rather than
 * every missed step in a burst.
 */
export function nextActionAt(
  sentAt: Date,
  step: number,
  cadence: CadenceConfig,
  cal: WorkCalendar,
  now: Date,
  minGapDays = 0,
): Date | null {
  const at = scheduledAt(sentAt, step, cadence, cal);
  if (!at) return null;
  const floor = nextSendableTime(addWorkingDays(now, minGapDays, cal), cal);
  return at < floor ? floor : at;
}
