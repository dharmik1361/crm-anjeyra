/**
 * Normalise a phone number to E.164 digits without "+" (the form WhatsApp Cloud API uses).
 * Bare 10-digit Indian mobiles get the 91 prefix. Returns null if it can't be a valid number.
 */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (/^0[6-9]\d{9}$/.test(digits)) digits = `91${digits.slice(1)}`;
  else if (/^[6-9]\d{9}$/.test(digits)) digits = `91${digits}`;
  if (digits.includes("+")) return null;
  if (digits.startsWith("91") && !/^91[6-9]\d{9}$/.test(digits)) return null;
  return /^\d{10,15}$/.test(digits) ? digits : null;
}
