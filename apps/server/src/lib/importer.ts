import { normalizePhone, parseAmountToPaise, parseIndianDate } from "@qf/core";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";

export const IMPORT_FIELDS = [
  "quoteNumber",
  "buyerName",
  "company",
  "buyerPhone",
  "buyerEmail",
  "amount",
  "sentAt",
  "rep",
  "status",
  "notes",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ColumnMapping = Partial<Record<ImportField, number>>;

/** Header words (English, Hinglish, Gujarati) we recognise when guessing the mapping. */
const HINTS: Record<ImportField, RegExp> = {
  quoteNumber: /quot.*(no|num|#)|^q\.?\s*no|ref|કોટેશન/i,
  buyerName: /contact|person|buyer|customer name|^name$|નામ/i,
  company: /company|firm|party|client|કંપની|પાર્ટી/i,
  buyerPhone: /phone|mobile|mob|whats|contact no|ફોન|મોબાઇલ/i,
  buyerEmail: /e-?mail/i,
  amount: /amount|value|total|rs|₹|inr|રકમ/i,
  sentAt: /date|sent|તારીખ/i,
  rep: /sales|rep|executive|handled|owner|by/i,
  status: /status|stage|result/i,
  notes: /note|remark|comment/i,
};

export interface ParsedSheet {
  headers: string[];
  rows: unknown[][];
}

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return v.text;
  }
  return v;
}

export async function parseSheet(fileName: string, data: Buffer, maxRows = 2000): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  let ws: ExcelJS.Worksheet | undefined;
  if (/\.csv$/i.test(fileName)) {
    ws = await wb.csv.read(Readable.from(data));
  } else if (/\.xlsx$/i.test(fileName)) {
    await wb.xlsx.load(data as unknown as ArrayBuffer);
    ws = wb.worksheets[0];
  } else {
    throw Object.assign(new Error("Upload a .csv or .xlsx file"), { statusCode: 400 });
  }
  if (!ws) return { headers: [], rows: [] };
  const all: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue);
    if (values.some((v) => v !== null && String(v).trim() !== "")) all.push(values);
  });
  const [header = [], ...rows] = all;
  if (rows.length > maxRows) throw Object.assign(new Error(`Max ${maxRows} rows per import`), { statusCode: 400 });
  return { headers: header.map((h) => String(h ?? "").trim()), rows };
}

export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  // Most specific fields first so "Quotation No" isn't taken as a phone "No".
  for (const field of ["buyerEmail", "quoteNumber", "buyerPhone", "amount", "sentAt", "rep", "company", "buyerName", "status", "notes"] as ImportField[]) {
    const idx = headers.findIndex((h, i) => !used.has(i) && HINTS[field].test(h));
    if (idx >= 0) {
      mapping[field] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

const STATUS_WORDS: Record<string, "open" | "won" | "lost"> = {
  open: "open", pending: "open", followup: "open", "follow up": "open", "": "open",
  won: "won", win: "won", order: "won", "order received": "won", confirmed: "won", po: "won",
  lost: "lost", cancel: "lost", cancelled: "lost", rejected: "lost", "not interested": "lost",
};

export interface NormalisedRow {
  row: number;
  quoteNumber?: string;
  buyer: { name?: string; company?: string; phone?: string; email?: string };
  amountPaise: number;
  sentAt: Date;
  rep: string;
  status: "open" | "won" | "lost";
  notes?: string;
}

/** Validate and normalise one spreadsheet row. Row numbers are 1-based and include the header. */
export function normaliseRow(raw: unknown[], mapping: ColumnMapping, index: number, defaultRep?: string) {
  const get = (f: ImportField) => {
    const i = mapping[f];
    const v = i === undefined ? null : raw[i];
    return v === null || v === undefined ? undefined : v;
  };
  const str = (f: ImportField) => {
    const v = get(f);
    return v === undefined ? undefined : String(v).trim() || undefined;
  };
  const row = index + 2;
  const errors: string[] = [];

  const amountRaw = get("amount");
  const amountPaise = typeof amountRaw === "number" ? Math.round(amountRaw * 100) : parseAmountToPaise(String(amountRaw ?? ""));
  if (!amountPaise || amountPaise <= 0) errors.push(`amount "${amountRaw ?? ""}" is not a valid rupee amount`);

  const sentAt = parseIndianDate(get("sentAt"));
  if (!sentAt) errors.push(`date "${String(get("sentAt") ?? "")}" is not a valid date (use DD/MM/YYYY)`);

  const phoneRaw = str("buyerPhone");
  const phone = phoneRaw ? normalizePhone(phoneRaw) : undefined;
  if (phoneRaw && !phone) errors.push(`phone "${phoneRaw}" is not valid`);

  const company = str("company");
  const buyerName = str("buyerName");
  if (!company && !buyerName) errors.push("needs a company or buyer name");

  const rep = str("rep") ?? defaultRep;
  if (!rep) errors.push("needs a salesperson (map a column or pick a default)");

  const statusWord = (str("status") ?? "").toLowerCase();
  const status = STATUS_WORDS[statusWord];
  if (!status) errors.push(`status "${statusWord}" not recognised (open, won, lost)`);

  if (errors.length) return { ok: false as const, row, errors };
  return {
    ok: true as const,
    value: {
      row,
      quoteNumber: str("quoteNumber"),
      buyer: { name: buyerName, company, phone: phone ?? undefined, email: str("buyerEmail") },
      amountPaise: amountPaise!,
      sentAt: sentAt!,
      rep: rep!,
      status: status!,
      notes: str("notes"),
    } satisfies NormalisedRow,
  };
}
