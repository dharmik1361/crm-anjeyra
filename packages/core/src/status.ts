import { addWorkingDays, nextSendableTime, type WorkCalendar } from "./calendar.js";
import { nextActionAt, type CadenceConfig } from "./cadence.js";

export const QUOTE_STATUSES = ["draft", "open", "replied", "escalated", "won", "lost", "revised"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const TERMINAL_STATUSES: readonly QuoteStatus[] = ["won", "lost", "revised"];
export const ACTIVE_STATUSES: readonly QuoteStatus[] = ["open", "replied", "escalated"];

export const LOST_REASONS = [
  "price",
  "delivery_time",
  "competitor",
  "project_cancelled",
  "no_response",
  "specs_mismatch",
  "other",
] as const;
export type LostReason = (typeof LOST_REASONS)[number];

/** Working days a rep-reported buyer reply pauses the cadence before we check in again. */
export const REPLY_PAUSE_DAYS = 3;

export interface QuoteState {
  status: QuoteStatus;
  sentAt: Date;
  /** Index of the next cadence action: 0..steps-1 = rep reminders, steps = owner escalation. */
  cadenceStep: number;
  nextActionAt: Date | null;
  lostReason?: LostReason | null;
}

export type QuoteAction =
  | { type: "confirm" }
  /** The sweeper performed the action due for the current step. */
  | { type: "advance" }
  | { type: "buyer_replied" }
  | { type: "won" }
  | { type: "lost"; reason: LostReason }
  /** The old quote closes as revised; the caller creates the new quote. */
  | { type: "revised" }
  | { type: "snooze"; days: number };

export interface TransitionContext {
  now: Date;
  cadence: CadenceConfig;
  calendar: WorkCalendar;
}

export class InvalidTransitionError extends Error {
  constructor(from: QuoteStatus, action: QuoteAction["type"]) {
    super(`Cannot ${action} a quote that is ${from}`);
    this.name = "InvalidTransitionError";
  }
}

const ALLOWED: Record<QuoteAction["type"], readonly QuoteStatus[]> = {
  confirm: ["draft"],
  advance: ["open", "replied"],
  buyer_replied: ["open", "escalated", "replied"],
  won: ["open", "replied", "escalated"],
  lost: ["open", "replied", "escalated"],
  revised: ["open", "replied", "escalated"],
  snooze: ["open", "replied", "escalated"],
};

export function canApply(status: QuoteStatus, action: QuoteAction["type"]): boolean {
  return ALLOWED[action].includes(status);
}

/** Pure state transition. Every write to a quote's status goes through here. */
export function applyAction(state: QuoteState, action: QuoteAction, ctx: TransitionContext): QuoteState {
  if (!canApply(state.status, action.type)) throw new InvalidTransitionError(state.status, action.type);
  const { now, cadence, calendar } = ctx;

  switch (action.type) {
    case "confirm":
      return {
        ...state,
        status: "open",
        cadenceStep: 0,
        nextActionAt: nextActionAt(state.sentAt, 0, cadence, calendar, now),
      };

    case "advance": {
      // A paused (replied) quote whose pause ran out goes back into the cadence at its current step.
      if (state.status === "replied") {
        return {
          ...state,
          status: "open",
          nextActionAt: nextActionAt(state.sentAt, state.cadenceStep, cadence, calendar, now),
        };
      }
      if (state.cadenceStep >= cadence.steps.length) {
        return { ...state, status: "escalated", cadenceStep: state.cadenceStep + 1, nextActionAt: null };
      }
      const step = state.cadenceStep + 1;
      return { ...state, cadenceStep: step, nextActionAt: nextActionAt(state.sentAt, step, cadence, calendar, now, 1) };
    }

    case "buyer_replied":
      return {
        ...state,
        status: "replied",
        nextActionAt: nextSendableTime(addWorkingDays(now, REPLY_PAUSE_DAYS, calendar), calendar),
      };

    case "snooze": {
      if (!Number.isInteger(action.days) || action.days < 1 || action.days > 60) {
        throw new Error("Snooze must be 1–60 working days");
      }
      return {
        ...state,
        status: "open",
        nextActionAt: nextSendableTime(addWorkingDays(now, action.days, calendar), calendar),
      };
    }

    case "won":
      return { ...state, status: "won", nextActionAt: null };
    case "lost":
      return { ...state, status: "lost", lostReason: action.reason, nextActionAt: null };
    case "revised":
      return { ...state, status: "revised", nextActionAt: null };
  }
}
