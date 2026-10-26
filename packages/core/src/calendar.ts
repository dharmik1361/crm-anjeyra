// All business time is India Standard Time. IST has no DST, so a fixed +05:30 offset is exact.
const IST_OFFSET_MIN = 330;
const DAY_MS = 86_400_000;

export interface WorkCalendar {
  /** 0 = Sunday … 6 = Saturday. Most Gujarat industrial units work Mon–Sat. */
  workdays: number[];
  /** "YYYY-MM-DD" in IST. */
  holidays: string[];
  /** "HH:MM" IST. Reminders never go out at or after this time… */
  quietStart: string;
  /** …or before this time. */
  quietEnd: string;
  /** "HH:MM" IST. Where reminders that land in quiet hours are moved to. */
  reminderTime: string;
}

/**
 * Defaults for a new tenant. Holidays are editable per tenant; the list below is the
 * common Gujarat industrial set for 2026 (including the Diwali shutdown week) and must be
 * reviewed every year.
 */
export const GUJARAT_HOLIDAYS_2026 = [
  "2026-01-14", // Uttarayan
  "2026-01-15", // Vasi Uttarayan
  "2026-01-26", // Republic Day
  "2026-03-04", // Dhuleti
  "2026-08-15", // Independence Day
  "2026-10-02", // Gandhi Jayanti
  "2026-11-09", // Diwali shutdown week
  "2026-11-10",
  "2026-11-11",
  "2026-11-12",
  "2026-11-13",
];

export const DEFAULT_CALENDAR: WorkCalendar = {
  workdays: [1, 2, 3, 4, 5, 6],
  holidays: GUJARAT_HOLIDAYS_2026,
  quietStart: "20:00",
  quietEnd: "09:30",
  reminderTime: "10:00",
};

export function parseHHMM(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid time "${value}", expected HH:MM`);
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  if (minutes >= 24 * 60) throw new Error(`Invalid time "${value}"`);
  return minutes;
}

/** Shift a UTC instant into a Date whose UTC fields read as IST wall-clock time. */
function toIstWall(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MIN * 60_000);
}

function fromIstWall(wall: Date): Date {
  return new Date(wall.getTime() - IST_OFFSET_MIN * 60_000);
}

export function istDateKey(date: Date): string {
  return toIstWall(date).toISOString().slice(0, 10);
}

export function istMinutesOfDay(date: Date): number {
  const w = toIstWall(date);
  return w.getUTCHours() * 60 + w.getUTCMinutes();
}

export function isWorkingDay(date: Date, cal: WorkCalendar): boolean {
  const w = toIstWall(date);
  return cal.workdays.includes(w.getUTCDay()) && !cal.holidays.includes(istDateKey(date));
}

/** Same IST calendar day as `date`, at `minutes` past IST midnight. */
export function atIstTime(date: Date, minutes: number): Date {
  const w = toIstWall(date);
  const midnight = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate());
  return fromIstWall(new Date(midnight + minutes * 60_000));
}

/** Move forward `n` working days, keeping the IST time of day. n = 0 returns `date` unchanged. */
export function addWorkingDays(date: Date, n: number, cal: WorkCalendar): Date {
  if (n < 0) throw new Error("addWorkingDays only moves forward");
  if (cal.workdays.length === 0) throw new Error("Calendar has no working days");
  let cursor = date;
  let remaining = n;
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (isWorkingDay(cursor, cal)) remaining--;
  }
  return cursor;
}

/** Number of working days strictly after `from` up to and including `to` (by IST date). */
export function workingDaysBetween(from: Date, to: Date, cal: WorkCalendar): number {
  if (to <= from) return 0;
  let count = 0;
  let cursor = from;
  const endKey = istDateKey(to);
  while (istDateKey(cursor) < endKey) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (isWorkingDay(cursor, cal)) count++;
  }
  return count;
}

/**
 * If `date` falls on a non-working day or inside quiet hours, move it to the reminder time
 * on the next suitable working day. Otherwise return it unchanged.
 */
export function nextSendableTime(date: Date, cal: WorkCalendar): Date {
  const quietStart = parseHHMM(cal.quietStart);
  const quietEnd = parseHHMM(cal.quietEnd);
  const reminder = parseHHMM(cal.reminderTime);
  const minutes = istMinutesOfDay(date);

  if (isWorkingDay(date, cal) && minutes >= quietEnd && minutes < quietStart) return date;

  // Before the quiet window ends on a working day: same day at reminder time.
  if (isWorkingDay(date, cal) && minutes < quietEnd) return atIstTime(date, reminder);

  let cursor = atIstTime(date, reminder);
  do {
    cursor = new Date(cursor.getTime() + DAY_MS);
  } while (!isWorkingDay(cursor, cal));
  return cursor;
}
