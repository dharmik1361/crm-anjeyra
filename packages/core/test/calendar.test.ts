import { describe, expect, it } from "vitest";
import {
  DEFAULT_CALENDAR,
  addWorkingDays,
  istDateKey,
  isWorkingDay,
  nextSendableTime,
  workingDaysBetween,
  type WorkCalendar,
} from "../src/calendar.js";

// Helper: build a UTC instant from an IST wall-clock time.
const ist = (s: string) => new Date(`${s}+05:30`);
const cal: WorkCalendar = { ...DEFAULT_CALENDAR, holidays: [] };

describe("working days (IST, Mon–Sat)", () => {
  it("treats Sunday as off and Saturday as on", () => {
    expect(isWorkingDay(ist("2026-10-25T11:00:00"), cal)).toBe(false); // Sunday
    expect(isWorkingDay(ist("2026-10-24T11:00:00"), cal)).toBe(true); // Saturday
  });

  it("uses the IST date, not the UTC date", () => {
    // 00:30 IST Monday is still Sunday in UTC.
    const d = ist("2026-10-26T00:30:00");
    expect(istDateKey(d)).toBe("2026-10-26");
    expect(isWorkingDay(d, cal)).toBe(true);
  });

  it("skips Sundays when adding working days", () => {
    // Fri + 2 working days = Sat, Mon -> Mon
    const r = addWorkingDays(ist("2026-10-23T15:00:00"), 2, cal);
    expect(r).toEqual(ist("2026-10-26T15:00:00"));
  });

  it("skips holidays", () => {
    const withHoliday = { ...cal, holidays: ["2026-10-27"] };
    const r = addWorkingDays(ist("2026-10-26T15:00:00"), 1, withHoliday);
    expect(r).toEqual(ist("2026-10-28T15:00:00"));
  });

  it("jumps the whole Diwali shutdown week with default holidays", () => {
    // Sat 7 Nov + 1 working day: Sun 8 off, 9–13 holidays, Sat 14 is next.
    const r = addWorkingDays(ist("2026-11-07T11:00:00"), 1, DEFAULT_CALENDAR);
    expect(istDateKey(r)).toBe("2026-11-14");
  });

  it("counts working days between dates", () => {
    expect(workingDaysBetween(ist("2026-10-23T10:00:00"), ist("2026-10-27T10:00:00"), cal)).toBe(3);
    expect(workingDaysBetween(ist("2026-10-27T10:00:00"), ist("2026-10-23T10:00:00"), cal)).toBe(0);
  });
});

describe("quiet hours", () => {
  it("leaves a time inside working hours unchanged", () => {
    const d = ist("2026-10-26T14:00:00");
    expect(nextSendableTime(d, cal)).toEqual(d);
  });

  it("moves an early-morning time to 10:00 the same day", () => {
    expect(nextSendableTime(ist("2026-10-26T07:00:00"), cal)).toEqual(ist("2026-10-26T10:00:00"));
  });

  it("moves a late-evening time to 10:00 the next working day", () => {
    // Saturday 21:00 -> Monday 10:00
    expect(nextSendableTime(ist("2026-10-24T21:00:00"), cal)).toEqual(ist("2026-10-26T10:00:00"));
  });

  it("moves a Sunday time to Monday 10:00", () => {
    expect(nextSendableTime(ist("2026-10-25T12:00:00"), cal)).toEqual(ist("2026-10-26T10:00:00"));
  });
});
