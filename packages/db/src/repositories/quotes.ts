import { createHash } from "node:crypto";
import {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  applyAction,
  nextActionAt,
  normalizePhone,
  type QuoteAction,
  type QuoteStatus,
} from "@qf/core";
import { Types } from "mongoose";
import { Quote, QuoteEvent, User, type QuoteDoc, type QuoteEventType } from "../models.js";
import { getTenant, tenantRules } from "./tenants.js";
import { ValidationError } from "./users.js";

export interface QuoteInput {
  repId: string;
  buyer: { name?: string; company?: string; phone?: string; email?: string };
  quoteNumber?: string;
  amountPaise: number;
  sentAt: Date;
  source: "whatsapp" | "email" | "import" | "indiamart" | "manual";
  items?: Array<{ description?: string; qty?: number; unit?: string; ratePaise?: number }>;
  notes?: string;
  gstIncluded?: boolean | null;
  importBatchId?: string;
}

export interface QuoteFilters {
  status?: QuoteStatus[];
  repId?: string;
  /** Age in days since sentAt. */
  minAgeDays?: number;
  maxAgeDays?: number;
  search?: string;
  limit?: number;
  skip?: number;
}

const ACTION_EVENT: Record<QuoteAction["type"], QuoteEventType> = {
  confirm: "confirmed",
  advance: "nudge_due",
  buyer_replied: "buyer_replied",
  won: "outcome_won",
  lost: "outcome_lost",
  revised: "outcome_revised",
  snooze: "snoozed",
};

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Record");
  return new Types.ObjectId(id);
};

export function dedupeHash(tenantId: string, q: Pick<QuoteInput, "quoteNumber" | "buyer" | "amountPaise" | "sentAt">) {
  const key = q.quoteNumber?.trim()
    ? `qn:${q.quoteNumber.trim().toLowerCase()}`
    : `bp:${q.buyer.phone ?? q.buyer.company ?? ""}:${q.amountPaise}:${q.sentAt.toISOString().slice(0, 10)}`;
  return createHash("sha256").update(`${tenantId}|${key}`).digest("hex").slice(0, 32);
}

async function logEvent(
  tenantId: Types.ObjectId,
  quoteId: Types.ObjectId,
  type: QuoteEventType,
  actorId: string | null,
  meta: Record<string, unknown> = {},
  at = new Date(),
) {
  await QuoteEvent.create({ tenantId, quoteId, type, actorId: actorId ? oid(actorId) : null, meta, at });
}

async function assertRep(tenantId: string, repId: string) {
  const rep = await User.exists({ _id: oid(repId), tenantId: oid(tenantId) });
  if (!rep) throw new ValidationError("Rep does not belong to this tenant");
}

/** Returns an existing active quote that looks like the same one, if any. */
export async function findDuplicate(tenantId: string, input: QuoteInput) {
  return (await Quote.findOne({
    tenantId: oid(tenantId),
    dedupeHash: dedupeHash(tenantId, input),
    status: { $nin: ["revised"] },
  }).lean()) as QuoteDoc | null;
}

/**
 * Create a quote. Manual and imported quotes are already reviewed by a person, so they are
 * confirmed immediately (draft → open, cadence scheduled). WhatsApp captures stay draft until the rep confirms.
 */
export async function createQuote(
  tenantId: string,
  input: QuoteInput,
  actorId: string | null,
  opts: { confirm: boolean; now?: Date },
) {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) throw new ValidationError("Amount must be positive");
  await assertRep(tenantId, input.repId);
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new NotFoundError("Tenant");
  const now = opts.now ?? new Date();
  const buyerPhone = input.buyer.phone ? (normalizePhone(input.buyer.phone) ?? input.buyer.phone) : undefined;

  let state = { status: "draft" as QuoteStatus, sentAt: input.sentAt, cadenceStep: 0, nextActionAt: null as Date | null };
  if (opts.confirm) state = applyAction(state, { type: "confirm" }, { now, ...tenantRules(tenant) });

  const doc = await Quote.create({
    ...input,
    buyer: { ...input.buyer, phone: buyerPhone },
    tenantId: tenant._id,
    repId: oid(input.repId),
    importBatchId: input.importBatchId ? oid(input.importBatchId) : null,
    status: state.status,
    cadenceStep: state.cadenceStep,
    nextActionAt: state.nextActionAt,
    dedupeHash: dedupeHash(tenantId, input),
  });
  await logEvent(tenant._id, doc._id, "logged", actorId, { source: input.source }, now);
  if (opts.confirm) await logEvent(tenant._id, doc._id, "confirmed", actorId, {}, now);
  return doc.toObject() as QuoteDoc;
}

export async function getQuote(tenantId: string, quoteId: string) {
  return (await Quote.findOne({ _id: oid(quoteId), tenantId: oid(tenantId) }).lean()) as QuoteDoc | null;
}

export async function listQuotes(tenantId: string, f: QuoteFilters = {}, now = new Date()) {
  const query: Record<string, unknown> = { tenantId: oid(tenantId) };
  if (f.status?.length) query.status = { $in: f.status };
  if (f.repId) query.repId = oid(f.repId);
  const sentAt: Record<string, Date> = {};
  if (f.minAgeDays !== undefined) sentAt.$lte = new Date(now.getTime() - f.minAgeDays * 86_400_000);
  if (f.maxAgeDays !== undefined) sentAt.$gte = new Date(now.getTime() - f.maxAgeDays * 86_400_000);
  if (Object.keys(sentAt).length) query.sentAt = sentAt;
  if (f.search?.trim()) {
    const re = new RegExp(f.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ "buyer.name": re }, { "buyer.company": re }, { quoteNumber: re }, { "buyer.phone": re }];
  }
  const [items, total] = await Promise.all([
    Quote.find(query)
      .sort({ nextActionAt: 1, sentAt: -1 })
      .skip(f.skip ?? 0)
      .limit(Math.min(f.limit ?? 100, 500))
      .lean(),
    Quote.countDocuments(query),
  ]);
  return { items: items as QuoteDoc[], total };
}

export async function listQuoteEvents(tenantId: string, quoteId: string) {
  return QuoteEvent.find({ tenantId: oid(tenantId), quoteId: oid(quoteId) }).sort({ at: 1 }).lean();
}

const EDITABLE = ["buyer", "quoteNumber", "amountPaise", "sentAt", "items", "notes", "gstIncluded", "repId"] as const;
export type QuotePatch = Partial<Pick<QuoteInput, (typeof EDITABLE)[number]>>;

export async function updateQuoteFields(tenantId: string, quoteId: string, patch: QuotePatch, actorId: string | null) {
  const quote = await getQuote(tenantId, quoteId);
  if (!quote) throw new NotFoundError("Quote");
  if (patch.repId) await assertRep(tenantId, patch.repId);
  if (patch.amountPaise !== undefined && (!Number.isInteger(patch.amountPaise) || patch.amountPaise <= 0)) {
    throw new ValidationError("Amount must be positive");
  }
  const set: Record<string, unknown> = {};
  for (const k of EDITABLE) if (patch[k] !== undefined) set[k] = k === "repId" ? oid(patch.repId!) : patch[k];

  // Changing the send date of an active quote reschedules its pending step.
  if (patch.sentAt && ACTIVE_STATUSES.includes(quote.status as QuoteStatus) && quote.nextActionAt) {
    const tenant = (await getTenant(tenantId))!;
    const { cadence, calendar } = tenantRules(tenant);
    set.nextActionAt = nextActionAt(patch.sentAt, quote.cadenceStep, cadence, calendar, new Date());
  }
  const updated = (await Quote.findOneAndUpdate(
    { _id: quote._id, tenantId: quote.tenantId },
    { $set: set },
    { new: true, runValidators: true },
  ).lean()) as QuoteDoc;
  await logEvent(quote.tenantId, quote._id, "edited", actorId, { fields: Object.keys(set) });
  return updated;
}

/**
 * Apply a lifecycle action. Uses the previous status + nextActionAt as an optimistic lock so
 * the sweeper and a human acting at the same moment cannot both win.
 */
export async function applyQuoteAction(
  tenantId: string,
  quoteId: string,
  action: QuoteAction,
  actorId: string | null,
  opts: { now?: Date; revisedAmountPaise?: number; meta?: Record<string, unknown> } = {},
) {
  const now = opts.now ?? new Date();
  const quote = await getQuote(tenantId, quoteId);
  if (!quote) throw new NotFoundError("Quote");
  const tenant = (await getTenant(tenantId))!;

  const next = applyAction(
    {
      status: quote.status as QuoteStatus,
      sentAt: quote.sentAt,
      cadenceStep: quote.cadenceStep,
      nextActionAt: quote.nextActionAt ?? null,
      lostReason: (quote.lostReason as never) ?? null,
    },
    action,
    { now, ...tenantRules(tenant) },
  );
  if (action.type === "revised" && !(opts.revisedAmountPaise && opts.revisedAmountPaise > 0)) {
    throw new ValidationError("Revised quotes need the new amount");
  }

  const updated = (await Quote.findOneAndUpdate(
    { _id: quote._id, tenantId: quote.tenantId, status: quote.status, nextActionAt: quote.nextActionAt ?? null },
    {
      $set: {
        status: next.status,
        cadenceStep: next.cadenceStep,
        nextActionAt: next.nextActionAt,
        lostReason: next.lostReason ?? null,
        closedAt: TERMINAL_STATUSES.includes(next.status) ? now : null,
      },
    },
    { new: true },
  ).lean()) as QuoteDoc | null;
  if (!updated) return null; // someone else changed it first

  const meta: Record<string, unknown> = { from: quote.status, to: next.status, step: quote.cadenceStep, ...opts.meta };
  if (action.type === "lost") meta.reason = action.reason;
  if (action.type === "snooze") meta.days = action.days;
  if (action.type === "advance" && next.status === "escalated") {
    await logEvent(quote.tenantId, quote._id, "escalated", actorId, meta, now);
  } else {
    await logEvent(quote.tenantId, quote._id, ACTION_EVENT[action.type], actorId, meta, now);
  }

  if (action.type === "revised") {
    const revision = await createQuote(
      tenantId,
      {
        repId: String(quote.repId),
        buyer: {
          name: quote.buyer?.name ?? undefined,
          company: quote.buyer?.company ?? undefined,
          phone: quote.buyer?.phone ?? undefined,
          email: quote.buyer?.email ?? undefined,
        },
        quoteNumber: quote.quoteNumber ? `${quote.quoteNumber}-R` : undefined,
        amountPaise: opts.revisedAmountPaise!,
        sentAt: now,
        source: quote.source as QuoteInput["source"],
        items: quote.items as QuoteInput["items"],
        notes: quote.notes ?? undefined,
      },
      actorId,
      { confirm: true, now },
    );
    await Quote.updateOne({ _id: revision._id }, { revisedFromId: quote._id });
    return { ...updated, revisionId: String(revision._id) };
  }
  return updated;
}

/** Rep-reported "I sent the follow-up" — an event only, no status change. */
export async function markFollowUpSent(tenantId: string, quoteId: string, actorId: string | null, now = new Date()) {
  const quote = await getQuote(tenantId, quoteId);
  if (!quote) throw new NotFoundError("Quote");
  await logEvent(quote.tenantId, quote._id, "rep_marked_sent", actorId, { step: quote.cadenceStep }, now);
}

/**
 * Cross-tenant by design: the sweeper is the one caller allowed to look across tenants.
 * Returns only ids + tenant so every follow-up write still goes through the scoped functions.
 */
export async function findDueQuotes(now: Date, limit = 200) {
  return Quote.find({ nextActionAt: { $lte: now }, status: { $in: ["open", "replied"] } })
    .sort({ nextActionAt: 1 })
    .limit(limit)
    .select({ _id: 1, tenantId: 1 })
    .lean();
}

/**
 * The chase list: active quotes whose most recent cadence event is a due nudge or an escalation
 * that nobody has acted on yet (no "sent", buyer reply or snooze after it).
 */
export async function listPendingFollowUps(tenantId: string) {
  const rows = await QuoteEvent.aggregate<{ _id: Types.ObjectId; type: QuoteEventType; at: Date; step?: number }>([
    {
      $match: {
        tenantId: oid(tenantId),
        type: { $in: ["confirmed", "nudge_due", "escalated", "rep_marked_sent", "buyer_replied", "snoozed"] },
      },
    },
    { $sort: { at: -1, _id: -1 } },
    { $group: { _id: "$quoteId", type: { $first: "$type" }, at: { $first: "$at" }, step: { $first: "$meta.step" } } },
    { $match: { type: { $in: ["nudge_due", "escalated"] } } },
  ]);
  if (!rows.length) return [];
  const quotes = (await Quote.find({
    tenantId: oid(tenantId),
    _id: { $in: rows.map((r) => r._id) },
    status: { $in: [...ACTIVE_STATUSES] },
  }).lean()) as QuoteDoc[];
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  return quotes
    .map((quote) => {
      const r = byId.get(String(quote._id))!;
      return { quote, reason: r.type as "nudge_due" | "escalated", dueSince: r.at, step: r.step ?? quote.cadenceStep };
    })
    .sort((x, y) => (x.reason === y.reason ? x.dueSince.getTime() - y.dueSince.getTime() : x.reason === "escalated" ? -1 : 1));
}
