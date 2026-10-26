import { LOST_REASONS, QUOTE_STATUSES } from "@qf/core";
import {
  applyQuoteAction,
  createQuote,
  findDuplicate,
  getQuote,
  listQuoteEvents,
  listQuotes,
  listUsers,
  markFollowUpSent,
  updateQuoteFields,
} from "@qf/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { tenantSnapshot } from "../jobs/digest.js";
import { quoteDto } from "../lib/serialize.js";

type P = { Params: { tid: string; qid: string } };

const buyer = z.object({
  name: z.string().trim().optional(),
  company: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
});

const quoteBody = z.object({
  repId: z.string(),
  buyer,
  quoteNumber: z.string().trim().optional(),
  amountPaise: z.number().int().positive(),
  sentAt: z.coerce.date(),
  notes: z.string().optional(),
  items: z.array(z.object({ description: z.string().optional(), qty: z.number().optional(), unit: z.string().optional(), ratePaise: z.number().int().optional() })).optional(),
  allowDuplicate: z.boolean().optional(),
});

const actionBody = z.discriminatedUnion("type", [
  z.object({ type: z.literal("won") }),
  z.object({ type: z.literal("lost"), reason: z.enum(LOST_REASONS) }),
  z.object({ type: z.literal("revised"), amountPaise: z.number().int().positive() }),
  z.object({ type: z.literal("snooze"), days: z.number().int().min(1).max(60) }),
  z.object({ type: z.literal("buyer_replied") }),
  z.object({ type: z.literal("sent") }),
]);

async function repMap(tid: string) {
  return new Map((await listUsers(tid)).map((u) => [String(u._id), u]));
}

export async function quoteRoutes(app: FastifyInstance) {
  app.get<{ Params: { tid: string }; Querystring: Record<string, string | undefined> }>("/v1/tenants/:tid/quotes", async (req) => {
    const q = z
      .object({
        status: z.string().optional().transform((s) => (s ? s.split(",").filter(Boolean) : undefined)).pipe(z.array(z.enum(QUOTE_STATUSES)).optional()),
        repId: z.string().optional(),
        minAgeDays: z.coerce.number().min(0).optional(),
        maxAgeDays: z.coerce.number().min(0).optional(),
        search: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(500).optional(),
        skip: z.coerce.number().int().min(0).optional(),
      })
      .parse(req.query);
    const [{ items, total }, reps] = await Promise.all([listQuotes(req.params.tid, q), repMap(req.params.tid)]);
    return { items: items.map((i) => quoteDto(i, reps)), total };
  });

  app.post<{ Params: { tid: string } }>("/v1/tenants/:tid/quotes", async (req, reply) => {
    const { allowDuplicate, ...body } = quoteBody.parse(req.body);
    const input = { ...body, source: "manual" as const };
    if (!allowDuplicate) {
      const dup = await findDuplicate(req.params.tid, input);
      if (dup) return reply.code(409).send({ error: "duplicate", message: "Looks like this quote is already logged", existingId: String(dup._id) });
    }
    const q = await createQuote(req.params.tid, input, null, { confirm: true });
    return reply.code(201).send(quoteDto(q, await repMap(req.params.tid)));
  });

  app.get<P>("/v1/tenants/:tid/quotes/:qid", async (req, reply) => {
    const q = await getQuote(req.params.tid, req.params.qid);
    if (!q) return reply.code(404).send({ error: "not_found" });
    const events = await listQuoteEvents(req.params.tid, req.params.qid);
    return {
      quote: quoteDto(q, await repMap(req.params.tid)),
      events: events.map((e) => ({ id: String(e._id), type: e.type, at: e.at, actorId: e.actorId ? String(e.actorId) : null, meta: e.meta })),
    };
  });

  app.patch<P>("/v1/tenants/:tid/quotes/:qid", async (req) => {
    const patch = quoteBody.omit({ allowDuplicate: true }).partial().parse(req.body);
    const q = await updateQuoteFields(req.params.tid, req.params.qid, patch, null);
    return quoteDto(q, await repMap(req.params.tid));
  });

  app.post<P>("/v1/tenants/:tid/quotes/:qid/actions", async (req, reply) => {
    const body = actionBody.parse(req.body);
    const { tid, qid } = req.params;
    if (body.type === "sent") {
      await markFollowUpSent(tid, qid, null);
      return { ok: true };
    }
    const res =
      body.type === "revised"
        ? await applyQuoteAction(tid, qid, { type: "revised" }, null, { revisedAmountPaise: body.amountPaise })
        : await applyQuoteAction(tid, qid, body, null);
    if (!res) return reply.code(409).send({ error: "conflict", message: "Quote changed meanwhile, refresh and retry" });
    return quoteDto(res, await repMap(tid));
  });

  /** Dashboard: totals plus the chase list. */
  app.get<{ Params: { tid: string } }>("/v1/tenants/:tid/today", async (req, reply) => {
    const snap = await tenantSnapshot(req.params.tid);
    if (!snap) return reply.code(404).send({ error: "not_found" });
    const reps = new Map(snap.users.map((u) => [String(u._id), u]));
    return {
      summary: snap.summary,
      pending: snap.pending.map((p) => ({ reason: p.reason, dueSince: p.dueSince, step: p.step, quote: quoteDto(p.quote, reps) })),
    };
  });
}
