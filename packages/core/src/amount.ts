// Money is always integer paise. Parsing covers how Gujarat suppliers actually write amounts:
// "₹2,45,000", "Rs. 245000/-", "2.45 L", "2.45 lakh", "1.2 cr", "50k", Gujarati and Devanagari digits.

const DIGIT_BLOCKS = [0x0ae6 /* Gujarati ૦ */, 0x0966 /* Devanagari ० */];

function normaliseDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    const block = DIGIT_BLOCKS.find((start) => code >= start && code <= start + 9);
    out += block === undefined ? ch : String(code - block);
  }
  return out;
}

const MULTIPLIERS: Array<[RegExp, number]> = [
  [/^(cr|crs|crore|crores|કરોડ|करोड़|करोड)$/, 1e7],
  [/^(l|lac|lacs|lakh|lakhs|lk|લાખ|लाख)$/, 1e5],
  [/^(k|thousand|હજાર|हजार)$/, 1e3],
];

/** Parse a human-written rupee amount into paise. Returns null when it is not a single clear amount. */
export function parseAmountToPaise(raw: string): number | null {
  let s = normaliseDigits(raw).toLowerCase().trim();
  s = s
    .replace(/₹|\binr\b|\brs\.?|\brupees?\b|રૂ\.?|रु\.?/g, " ")
    .replace(/\/-/g, " ")
    .replace(/\bonly\b/g, " ")
    .replace(/\(.*?\)/g, " ")
    .trim();

  const m = /^([0-9][0-9,]*(?:\.[0-9]+)?)\s*([^\s0-9.,]+)?\s*$/u.exec(s);
  if (!m) return null;

  const numeric = Number(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return null;

  let multiplier = 1;
  if (m[2]) {
    const hit = MULTIPLIERS.find(([re]) => re.test(m[2]!));
    if (!hit) return null;
    multiplier = hit[1];
  }
  const paise = Math.round(numeric * multiplier * 100);
  return paise > 0 ? paise : null;
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** "₹2,45,000" — whole rupees, Indian digit grouping. */
export function formatINR(paise: number): string {
  return `₹${inr.format(Math.round(paise / 100))}`;
}

/** Short form for WhatsApp lines: "₹2.45 L", "₹1.2 Cr", "₹45,000". */
export function formatINRShort(paise: number): string {
  const rupees = paise / 100;
  const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");
  if (rupees >= 1e7) return `₹${trim(rupees / 1e7)} Cr`;
  if (rupees >= 1e5) return `₹${trim(rupees / 1e5)} L`;
  return formatINR(paise);
}
