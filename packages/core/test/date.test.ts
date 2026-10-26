import { describe, expect, it } from "vitest";
import { parseIndianDate } from "../src/date.js";

const noon = (d: string) => new Date(`${d}T12:00:00+05:30`);

describe("parseIndianDate", () => {
  it.each([
    ["19/10/2026", noon("2026-10-19")],
    ["19-10-2026", noon("2026-10-19")],
    ["19.10.26", noon("2026-10-19")],
    ["5/1/2026", noon("2026-01-05")],
    ["2026-10-19", noon("2026-10-19")],
    ["31/02/2026", null],
    ["10/19/2026", null],
    ["yesterday", null],
  ])("%s", (input, expected) => {
    expect(parseIndianDate(input)).toEqual(expected);
  });

  it("accepts Date objects and Excel serials", () => {
    const d = new Date("2026-10-19T06:30:00Z");
    expect(parseIndianDate(d)).toBe(d);
    expect(parseIndianDate(46314)?.toISOString().slice(0, 10)).toBe("2026-10-19");
  });
});
