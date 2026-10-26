import { describe, expect, it } from "vitest";
import { DEFAULT_CALENDAR } from "../src/calendar.js";
import { DEFAULT_CADENCE } from "../src/cadence.js";
import { InvalidTransitionError, applyAction, type QuoteState } from "../src/status.js";
import { summarize } from "../src/summary.js";

const ist = (s: string) => new Date(`${s}+05:30`);
const calendar = { ...DEFAULT_CALENDAR, holidays: [] };
const sentAt = ist("2026-10-19T16:00:00");
const ctx = (now: Date) => ({ now, cadence: DEFAULT_CADENCE, calendar });
const draft: QuoteState = { status: "draft", sentAt, cadenceStep: 0, nextActionAt: null };

describe("quote lifecycle", () => {
  it("runs confirm -> 3 reminders -> escalation", () => {
    let q = applyAction(draft, { type: "confirm" }, ctx(sentAt));
    expect(q.status).toBe("open");
    expect(q.nextActionAt).toEqual(ist("2026-10-21T16:00:00"));

    for (const expected of ["2026-10-24T16:00:00", "2026-10-30T16:00:00", "2026-11-02T16:00:00"]) {
      q = applyAction(q, { type: "advance" }, ctx(q.nextActionAt!));
      expect(q.status).toBe("open");
      expect(q.nextActionAt).toEqual(ist(expected));
    }

    q = applyAction(q, { type: "advance" }, ctx(q.nextActionAt!));
    expect(q.status).toBe("escalated");
    expect(q.nextActionAt).toBeNull();
    expect(() => applyAction(q, { type: "advance" }, ctx(sentAt))).toThrow(InvalidTransitionError);
  });

  it("pauses on buyer reply and resumes at the same step", () => {
    let q = applyAction(draft, { type: "confirm" }, ctx(sentAt));
    const replyAt = ist("2026-10-20T11:00:00");
    q = applyAction(q, { type: "buyer_replied" }, ctx(replyAt));
    expect(q.status).toBe("replied");
    expect(q.nextActionAt).toEqual(ist("2026-10-23T11:00:00"));
    q = applyAction(q, { type: "advance" }, ctx(q.nextActionAt!));
    expect(q.status).toBe("open");
    expect(q.cadenceStep).toBe(0);
    expect(q.nextActionAt).toEqual(ist("2026-10-23T11:00:00")); // step 0 was overdue -> now
  });

  it("records outcomes and blocks changes after close", () => {
    const open = applyAction(draft, { type: "confirm" }, ctx(sentAt));
    const lost = applyAction(open, { type: "lost", reason: "price" }, ctx(sentAt));
    expect(lost).toMatchObject({ status: "lost", lostReason: "price", nextActionAt: null });
    expect(() => applyAction(lost, { type: "won" }, ctx(sentAt))).toThrow(InvalidTransitionError);
    expect(applyAction(open, { type: "won" }, ctx(sentAt)).status).toBe("won");
    expect(applyAction(open, { type: "revised" }, ctx(sentAt)).status).toBe("revised");
  });

  it("lets an escalated quote still be won, lost or snoozed", () => {
    const esc: QuoteState = { status: "escalated", sentAt, cadenceStep: 4, nextActionAt: null };
    expect(applyAction(esc, { type: "won" }, ctx(sentAt)).status).toBe("won");
    const snoozed = applyAction(esc, { type: "snooze", days: 3 }, ctx(ist("2026-11-03T12:00:00")));
    expect(snoozed.status).toBe("open");
    expect(snoozed.nextActionAt).toEqual(ist("2026-11-06T12:00:00"));
    expect(() => applyAction(esc, { type: "snooze", days: 0 }, ctx(sentAt))).toThrow();
  });

  it("does not burst through overdue steps for an old quote", () => {
    const old: QuoteState = { ...draft, sentAt: ist("2026-09-01T12:00:00") };
    const now = ist("2026-10-26T12:00:00"); // Monday
    let q = applyAction(old, { type: "confirm" }, ctx(now));
    expect(q.nextActionAt).toEqual(now);
    q = applyAction(q, { type: "advance" }, ctx(now));
    expect(q.nextActionAt).toEqual(ist("2026-10-27T12:00:00"));
  });

  it("cannot confirm twice", () => {
    const open = applyAction(draft, { type: "confirm" }, ctx(sentAt));
    expect(() => applyAction(open, { type: "confirm" }, ctx(sentAt))).toThrow(InvalidTransitionError);
  });
});

describe("summarize", () => {
  it("totals open, at risk, and won/lost within the window", () => {
    const now = ist("2026-10-26T09:30:00");
    const since = ist("2026-10-19T09:30:00");
    const s = summarize(
      [
        { status: "open", amountPaise: 100, sentAt: ist("2026-10-01T10:00:00"), repId: "a" }, // at risk
        { status: "open", amountPaise: 200, sentAt: ist("2026-10-24T10:00:00"), repId: "a" },
        { status: "replied", amountPaise: 400, sentAt: ist("2026-10-01T10:00:00"), repId: "b" },
        { status: "won", amountPaise: 800, sentAt: sentAt, repId: "b", closedAt: ist("2026-10-22T10:00:00") },
        { status: "lost", amountPaise: 1600, sentAt: sentAt, repId: "b", closedAt: ist("2026-10-10T10:00:00") },
      ],
      now,
      since,
    );
    expect(s.open).toEqual({ count: 3, amountPaise: 700 });
    expect(s.atRisk).toEqual({ count: 1, amountPaise: 100 });
    expect(s.won).toEqual({ count: 1, amountPaise: 800 });
    expect(s.lost).toEqual({ count: 0, amountPaise: 0 });
    expect(s.byRep.a!.atRisk.amountPaise).toBe(100);
  });
});
