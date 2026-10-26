import { ImportBatch, Tenant, applyQuoteAction, createQuote, findDuplicate, findUserByNameOrPhone } from "@qf/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { IMPORT_FIELDS, guessMapping, normaliseRow, parseSheet, type ColumnMapping } from "../lib/importer.js";

type T = { Params: { tid: string } };

/** Mongo keys can't contain "." or "$", and header rows often do ("Quotation No."). */
const mappingKey = (headers: string[]) => headers.join("|").replace(/[.$]/g, "_");

const commitBody = z.object({
  fileName: z.string().default("import"),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.unknown())).max(2000),
  mapping: z.record(z.enum(IMPORT_FIELDS), z.number().int().min(0)),
  defaultRep: z.string().optional(),
  dryRun: z.boolean().default(true),
});

export async function importRoutes(app: FastifyInstance) {
  /** Upload a CSV/XLSX; returns the parsed rows and a guessed (or remembered) column mapping. */
  app.post<T>("/v1/tenants/:tid/import/parse", async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "invalid_request", message: "Attach a file" });
    const sheet = await parseSheet(file.filename, await file.toBuffer());
    const tenant = await Tenant.findById(req.params.tid).lean();
    const remembered = (tenant?.importMappings as Record<string, ColumnMapping> | undefined)?.[mappingKey(sheet.headers)];
    return { fileName: file.filename, ...sheet, mapping: remembered ?? guessMapping(sheet.headers), fields: IMPORT_FIELDS };
  });

  /** Validate (dryRun) or import rows. Duplicates and invalid rows are skipped and reported. */
  app.post<T>("/v1/tenants/:tid/import/commit", async (req) => {
    const tid = req.params.tid;
    const body = commitBody.parse(req.body);
    const mapping = body.mapping as ColumnMapping;
    const errors: Array<{ row: number; message: string }> = [];
    const valid = [];
    const repCache = new Map<string, string | null>();

    for (const [i, raw] of body.rows.entries()) {
      const res = normaliseRow(raw, mapping, i, body.defaultRep);
      if (!res.ok) {
        res.errors.forEach((message) => errors.push({ row: res.row, message }));
        continue;
      }
      const key = res.value.rep.toLowerCase();
      if (!repCache.has(key)) {
        const user = await findUserByNameOrPhone(tid, res.value.rep);
        repCache.set(key, user ? String(user._id) : null);
      }
      const repId = repCache.get(key);
      if (!repId) {
        errors.push({ row: res.value.row, message: `salesperson "${res.value.rep}" is not set up for this client` });
        continue;
      }
      valid.push({ ...res.value, repId });
    }

    if (body.dryRun) return { dryRun: true, total: body.rows.length, valid: valid.length, errors };

    const batch = await ImportBatch.create({ tenantId: tid, fileName: body.fileName, totalRows: body.rows.length });
    let imported = 0;
    let duplicates = 0;
    for (const r of valid) {
      const input = {
        repId: r.repId,
        buyer: r.buyer,
        quoteNumber: r.quoteNumber,
        amountPaise: r.amountPaise,
        sentAt: r.sentAt,
        source: "import" as const,
        notes: r.notes,
        importBatchId: String(batch._id),
      };
      if (await findDuplicate(tid, input)) {
        duplicates++;
        errors.push({ row: r.row, message: "duplicate of an existing quote, skipped" });
        continue;
      }
      const q = await createQuote(tid, input, null, { confirm: true });
      if (r.status !== "open") {
        await applyQuoteAction(tid, String(q._id), r.status === "won" ? { type: "won" } : { type: "lost", reason: "other" }, null, {
          meta: { imported: true },
        });
      }
      imported++;
    }
    await ImportBatch.updateOne({ _id: batch._id }, { imported, rowErrors: errors, status: "committed" });
    await Tenant.updateOne({ _id: tid }, { $set: { [`importMappings.${mappingKey(body.headers)}`]: mapping } });
    return { dryRun: false, batchId: String(batch._id), total: body.rows.length, imported, duplicates, errors };
  });
}
