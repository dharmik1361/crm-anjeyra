/**
 * Parse dates the way Indian spreadsheets write them. DD/MM/YYYY is assumed over MM/DD/YYYY.
 * Date-only values are taken as 12:00 IST so they never fall on the wrong IST day.
 */
export function parseIndianDate(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "number" && raw > 20000 && raw < 80000) {
    // Excel serial day number (1900 date system).
    return new Date(Date.UTC(1899, 11, 30) + raw * 86_400_000 + 6.5 * 3_600_000);
  }
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  const noon = (y: number, m: number, d: number) => {
    const date = new Date(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00+05:30`);
    return Number.isNaN(date.getTime()) || date.getUTCDate() !== d ? null : date;
  };
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return noon(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const year = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
    if (+m[2]! > 12) return null;
    return noon(year, +m[2]!, +m[1]!);
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
