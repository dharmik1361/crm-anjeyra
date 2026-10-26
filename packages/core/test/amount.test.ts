import { describe, expect, it } from "vitest";
import { formatINR, formatINRShort, parseAmountToPaise } from "../src/amount.js";

describe("parseAmountToPaise", () => {
  const cases: Array<[string, number | null]> = [
    ["245000", 24_500_000],
    ["2,45,000", 24_500_000],
    ["₹2,45,000", 24_500_000],
    ["Rs. 245000/-", 24_500_000],
    ["Rs 2,45,000 only", 24_500_000],
    ["INR 2,45,000", 24_500_000],
    ["2.45 L", 24_500_000],
    ["2.45L", 24_500_000],
    ["2.45 lakh", 24_500_000],
    ["2.45 lac", 24_500_000],
    ["1.2 cr", 1_200_000_000],
    ["1.2 Crore", 1_200_000_000],
    ["50k", 5_000_000],
    ["245000.50", 24_500_050],
    ["૨,૪૫,૦૦૦", 24_500_000], // Gujarati digits
    ["२४५०००", 24_500_000], // Devanagari digits
    ["2.5 લાખ", 25_000_000],
    ["3 लाख", 30_000_000],
    ["", null],
    ["abc", null],
    ["0", null],
    ["2.45 widgets", null],
    ["12 and 15", null],
  ];
  it.each(cases)("%s -> %s", (input, expected) => {
    expect(parseAmountToPaise(input)).toBe(expected);
  });
});

describe("formatting", () => {
  it("uses Indian grouping", () => {
    expect(formatINR(24_500_000)).toBe("₹2,45,000");
    expect(formatINR(1_234_567_800)).toBe("₹1,23,45,678");
  });
  it("shortens lakhs and crores", () => {
    expect(formatINRShort(24_500_000)).toBe("₹2.45 L");
    expect(formatINRShort(1_200_000_000)).toBe("₹1.2 Cr");
    expect(formatINRShort(4_500_000)).toBe("₹45,000");
  });
});
