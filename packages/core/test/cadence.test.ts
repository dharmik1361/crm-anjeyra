import { describe, expect, it } from "vitest";
import { DEFAULT_CALENDAR } from "../src/calendar.js";
import { DEFAULT_CADENCE, nextActionAt, scheduledAt, validateCadence } from "../src/cadence.js";

const ist = (s: string) => new Date(`${s}+05:30`);
const cal = { ...DEFAULT_CALENDAR, holidays: [] };
const sentAt = ist("2026-10-19T16:00:00"); // Monday

describe("default cadence Day 2 / 5 / 10, escalate +2", () => {
  it("schedules each step in working days from sentAt", () => {
    expect(scheduledAt(sentAt, 0, DEFAULT_CADENCE, cal)).toEqual(ist("2026-10-21T16:00:00")); // Wed
    expect(scheduledAt(sentAt, 1, DEFAULT_CADENCE, cal)).toEqual(ist("2026-10-24T16:00:00")); // Sat
    expect(scheduledAt(sentAt, 2, DEFAULT_CADENCE, cal)).toEqual(ist("2026-10-30T16:00:00")); // Fri
    expect(scheduledAt(sentAt, 3, DEFAULT_CADENCE, cal)).toEqual(ist("2026-11-02T16:00:00")); // escalation, Mon
    expect(scheduledAt(sentAt, 4, DEFAULT_CADENCE, cal)).toBeNull();
  });

  it("applies quiet hours to the scheduled time", () => {
    const lateSend = ist("2026-10-19T22:30:00");
    expect(scheduledAt(lateSend, 0, DEFAULT_CADENCE, cal)).toEqual(ist("2026-10-22T10:00:00"));
  });

  it("never schedules in the past", () => {
    const now = ist("2026-10-28T12:00:00");
    expect(nextActionAt(sentAt, 0, DEFAULT_CADENCE, cal, now)).toEqual(now);
  });

  it("spaces overdue steps at least minGapDays apart", () => {
    const now = ist("2026-11-20T12:00:00"); // long after every step
    expect(nextActionAt(sentAt, 1, DEFAULT_CADENCE, cal, now, 1)).toEqual(ist("2026-11-21T12:00:00"));
  });
});

describe("validateCadence", () => {
  it("rejects bad configs", () => {
    expect(() => validateCadence({ steps: [], escalateAfter: 2 })).toThrow();
    expect(() => validateCadence({ steps: [5, 2], escalateAfter: 2 })).toThrow();
    expect(() => validateCadence({ steps: [2, 5], escalateAfter: -1 })).toThrow();
    expect(() => validateCadence(DEFAULT_CADENCE)).not.toThrow();
  });
});
