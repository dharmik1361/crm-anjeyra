import { DEFAULT_CADENCE } from "@qf/core";
import { createTenant, createUser, getTenant, listTenants, listUsers, updateTenantSettings } from "@qf/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { userDto } from "../lib/serialize.js";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

export async function tenantRoutes(app: FastifyInstance) {
  app.get("/v1/tenants", async () => {
    const tenants = await listTenants();
    return { items: tenants.map((t) => ({ id: String(t._id), name: t.name, slug: t.slug, plan: t.plan, status: t.status })) };
  });

  app.post("/v1/tenants", async (req, reply) => {
    const body = z
      .object({
        name: z.string().min(2),
        slug: z.string().regex(/^[a-z0-9-]{2,40}$/, "lowercase letters, digits and dashes"),
        plan: z.enum(["concierge", "team", "growth"]).optional(),
      })
      .parse(req.body);
    const t = await createTenant(body);
    return reply.code(201).send({ id: String(t._id) });
  });

  app.get<{ Params: { tid: string } }>("/v1/tenants/:tid", async (req, reply) => {
    const t = await getTenant(req.params.tid).catch(() => null);
    if (!t) return reply.code(404).send({ error: "not_found" });
    return {
      id: String(t._id),
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      status: t.status,
      cadence: t.cadence ?? DEFAULT_CADENCE,
      calendar: t.calendar,
      dpaSignedAt: t.dpaSignedAt ?? null,
      importMappings: t.importMappings ?? {},
    };
  });

  app.patch<{ Params: { tid: string } }>("/v1/tenants/:tid", async (req, reply) => {
    const body = z
      .object({
        name: z.string().min(2).optional(),
        plan: z.enum(["concierge", "team", "growth"]).optional(),
        status: z.enum(["trial", "active", "paused", "exited"]).optional(),
        cadence: z.object({ steps: z.array(z.number().int().positive()).min(1).max(6), escalateAfter: z.number().int().min(0).max(10) }).optional(),
        calendar: z
          .object({
            workdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
            holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
            quietStart: hhmm.optional(),
            quietEnd: hhmm.optional(),
            reminderTime: hhmm.optional(),
          })
          .optional(),
        dpaSignedAt: z.coerce.date().nullable().optional(),
      })
      .parse(req.body);
    const t = await updateTenantSettings(req.params.tid, body, "admin");
    if (!t) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  app.get<{ Params: { tid: string } }>("/v1/tenants/:tid/users", async (req) => {
    return { items: (await listUsers(req.params.tid)).map(userDto) };
  });

  app.post<{ Params: { tid: string } }>("/v1/tenants/:tid/users", async (req, reply) => {
    const body = z
      .object({
        name: z.string().min(1),
        phone: z.string().min(10),
        role: z.enum(["owner", "rep", "coordinator"]),
        email: z.string().email().optional(),
        language: z.enum(["gu", "hi", "en"]).optional(),
      })
      .parse(req.body);
    const u = await createUser(req.params.tid, body);
    return reply.code(201).send(userDto(u));
  });
}
