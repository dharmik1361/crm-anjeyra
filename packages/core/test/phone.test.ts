import { describe, expect, it } from "vitest";
import { normalizePhone } from "../src/phone.js";

describe("normalizePhone", () => {
  it.each([
    ["9812345678", "919812345678"],
    ["98123 45678", "919812345678"],
    ["09812345678", "919812345678"],
    ["+91 98123-45678", "919812345678"],
    ["919812345678", "919812345678"],
    ["0091 9812345678", "919812345678"],
    ["+971501234567", "971501234567"],
    ["12345", null],
    ["915812345678", null],
    ["", null],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});
