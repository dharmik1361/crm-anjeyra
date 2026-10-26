export type QuoteStatus = "draft" | "open" | "replied" | "escalated" | "won" | "lost" | "revised";

export interface Quote {
  id: string;
  repId: string;
  repName: string | null;
  buyer: { name?: string; company?: string; phone?: string; email?: string };
  quoteNumber: string | null;
  amountPaise: number;
  sentAt: string;
  source: string;
  status: QuoteStatus;
  lostReason: string | null;
  cadenceStep: number;
  nextActionAt: string | null;
  closedAt: string | null;
  revisedFromId: string | null;
  notes: string | null;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  role: "owner" | "rep" | "coordinator";
  language: string;
  active: boolean;
}

export interface Bucket {
  count: number;
  amountPaise: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  cadence: { steps: number[]; escalateAfter: number };
  calendar: { workdays: number[]; holidays: string[]; quietStart: string; quietEnd: string; reminderTime: string };
  dpaSignedAt: string | null;
}
