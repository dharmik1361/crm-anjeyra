import { DEFAULT_CADENCE, DEFAULT_CALENDAR, LOST_REASONS, QUOTE_STATUSES } from "@qf/core";
import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

// Only this package touches models directly. Everything else goes through the tenant-scoped
// repositories, which require a tenantId on every call.

const timestamps = { timestamps: true } as const;

const tenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    plan: { type: String, enum: ["concierge", "team", "growth"], default: "concierge" },
    status: { type: String, enum: ["trial", "active", "paused", "exited"], default: "trial" },
    cadence: {
      steps: { type: [Number], default: DEFAULT_CADENCE.steps },
      escalateAfter: { type: Number, default: DEFAULT_CADENCE.escalateAfter },
    },
    calendar: {
      workdays: { type: [Number], default: DEFAULT_CALENDAR.workdays },
      holidays: { type: [String], default: DEFAULT_CALENDAR.holidays },
      quietStart: { type: String, default: DEFAULT_CALENDAR.quietStart },
      quietEnd: { type: String, default: DEFAULT_CALENDAR.quietEnd },
      reminderTime: { type: String, default: DEFAULT_CALENDAR.reminderTime },
    },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    report: { day: { type: Number, default: 1 }, time: { type: String, default: "09:30" } },
    defaultLanguage: { type: String, enum: ["gu", "hi", "en"], default: "gu" },
    importMappings: { type: Schema.Types.Mixed, default: {} },
    /** DPDP: we process buyer data only after the processing agreement is signed. */
    dpaSignedAt: { type: Date, default: null },
  },
  timestamps,
);

const userSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    /** E.164 without "+", e.g. 919812345678. Globally unique: a phone maps to exactly one tenant. */
    phone: { type: String, required: true, unique: true, match: /^\d{10,15}$/ },
    email: { type: String, lowercase: true, trim: true },
    role: { type: String, enum: ["owner", "rep", "coordinator"], required: true },
    language: { type: String, enum: ["gu", "hi", "en"], default: "gu" },
    /** Last inbound WhatsApp message; drives the 24h free-service-window decision. */
    lastInboundAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  timestamps,
);

const itemSchema = new Schema(
  { description: String, qty: Number, unit: String, ratePaise: Number },
  { _id: false },
);

const quoteSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    repId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    buyer: {
      name: { type: String, trim: true },
      company: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    quoteNumber: { type: String, trim: true },
    amountPaise: { type: Number, required: true, min: 0 },
    gstIncluded: { type: Boolean, default: null },
    items: { type: [itemSchema], default: [] },
    sentAt: { type: Date, required: true },
    source: { type: String, enum: ["whatsapp", "email", "import", "indiamart", "manual"], required: true },
    attachmentKeys: { type: [String], default: [] },
    language: { type: String, enum: ["gu", "hi", "en"] },
    notes: { type: String, trim: true },
    status: { type: String, enum: QUOTE_STATUSES, default: "draft" },
    lostReason: { type: String, enum: [...LOST_REASONS, null], default: null },
    revisedFromId: { type: Schema.Types.ObjectId, ref: "Quote", default: null },
    cadenceStep: { type: Number, default: 0 },
    nextActionAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    importBatchId: { type: Schema.Types.ObjectId, ref: "ImportBatch", default: null },
    dedupeHash: { type: String },
  },
  timestamps,
);
quoteSchema.index({ tenantId: 1, status: 1, nextActionAt: 1 });
quoteSchema.index({ tenantId: 1, repId: 1, status: 1 });
quoteSchema.index({ tenantId: 1, quoteNumber: 1 });
quoteSchema.index({ tenantId: 1, dedupeHash: 1 });
// The sweeper's query: only quotes with something scheduled.
quoteSchema.index({ nextActionAt: 1 }, { partialFilterExpression: { nextActionAt: { $type: "date" } } });

export const QUOTE_EVENT_TYPES = [
  "logged",
  "confirmed",
  "edited",
  "nudge_due",
  "draft_sent_to_rep",
  "rep_marked_sent",
  "buyer_replied",
  "outcome_won",
  "outcome_lost",
  "outcome_revised",
  "snoozed",
  "escalated",
  "owner_action",
] as const;
export type QuoteEventType = (typeof QUOTE_EVENT_TYPES)[number];

const quoteEventSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    quoteId: { type: Schema.Types.ObjectId, ref: "Quote", required: true },
    type: { type: String, enum: QUOTE_EVENT_TYPES, required: true },
    /** null = the system (sweeper, import). */
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);
quoteEventSchema.index({ quoteId: 1, at: 1 });
quoteEventSchema.index({ tenantId: 1, type: 1, at: 1 });

const importBatchSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    fileName: String,
    totalRows: Number,
    imported: Number,
    rowErrors: { type: [{ row: Number, message: String }], default: [] },
    status: { type: String, enum: ["preview", "committed", "failed"], default: "preview" },
  },
  timestamps,
);

const auditLogSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
    actor: { type: String, required: true },
    action: { type: String, required: true },
    target: String,
    meta: { type: Schema.Types.Mixed, default: {} },
    at: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);
auditLogSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 86_400 });

export const Tenant = mongoose.model("Tenant", tenantSchema);
export const User = mongoose.model("User", userSchema);
export const Quote = mongoose.model("Quote", quoteSchema);
export const QuoteEvent = mongoose.model("QuoteEvent", quoteEventSchema, "quote_events");
export const ImportBatch = mongoose.model("ImportBatch", importBatchSchema, "import_batches");
export const AuditLog = mongoose.model("AuditLog", auditLogSchema, "audit_logs");

type WithId<T> = T & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
export type TenantDoc = WithId<InferSchemaType<typeof tenantSchema>>;
export type UserDoc = WithId<InferSchemaType<typeof userSchema>>;
export type QuoteDoc = WithId<InferSchemaType<typeof quoteSchema>>;
export type QuoteEventDoc = InferSchemaType<typeof quoteEventSchema> & { _id: Types.ObjectId };
