import { connectDb } from "@qf/db";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { sweepOnce } from "../src/jobs/sweeper.js";
import { logger } from "../src/lib/logger.js";

const TOKEN = "test-admin-token-0123456789";
let mongo: MongoMemoryServer;
let app: Awaited<ReturnType<typeof buildApp>>;
const auth = { authorization: `Bearer ${TOKEN}` };

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  app = await buildApp({ adminToken: TOKEN, logger: false });
});
afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongo.stop();
});

function multipartCsv(name: string, csv: string) {
  const boundary = "----qfboundary";
  const body =
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`;
  return { payload: body, headers: { ...auth, "content-type": `multipart/form-data; boundary=${boundary}` } };
}

describe("API", () => {
  let tid = "";
  let repId = "";

  it("rejects requests without the admin token", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/tenants" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/tenants", headers: { authorization: "Bearer nope" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
  });

  it("creates a tenant, reps and a quote, then runs outcomes", async () => {
    const t = await app.inject({ method: "POST", url: "/v1/tenants", headers: auth, payload: { name: "Shah Packaging", slug: "shah" } });
    expect(t.statusCode).toBe(201);
    tid = t.json().id;
    const u = await app.inject({ method: "POST", url: `/v1/tenants/${tid}/users`, headers: auth, payload: { name: "Ramesh", phone: "98123 45678", role: "rep" } });
    expect(u.json().phone).toBe("919812345678");
    repId = u.json().id;

    const body = { repId, buyer: { company: "Gujarat Oils" }, quoteNumber: "Q-1", amountPaise: 24_500_000, sentAt: new Date().toISOString() };
    const q = await app.inject({ method: "POST", url: `/v1/tenants/${tid}/quotes`, headers: auth, payload: body });
    expect(q.statusCode).toBe(201);
    expect(q.json().status).toBe("open");
    const dup = await app.inject({ method: "POST", url: `/v1/tenants/${tid}/quotes`, headers: auth, payload: body });
    expect(dup.statusCode).toBe(409);

    const qid = q.json().id;
    const bad = await app.inject({ method: "POST", url: `/v1/tenants/${tid}/quotes/${qid}/actions`, headers: auth, payload: { type: "lost" } });
    expect(bad.statusCode).toBe(400);
    const lost = await app.inject({ method: "POST", url: `/v1/tenants/${tid}/quotes/${qid}/actions`, headers: auth, payload: { type: "lost", reason: "price" } });
    expect(lost.json()).toMatchObject({ status: "lost", lostReason: "price" });
    const again = await app.inject({ method: "POST", url: `/v1/tenants/${tid}/quotes/${qid}/actions`, headers: auth, payload: { type: "won" } });
    expect(again.statusCode).toBe(409);

    const detail = await app.inject({ method: "GET", url: `/v1/tenants/${tid}/quotes/${qid}`, headers: auth });
    expect(detail.json().events.map((e: { type: string }) => e.type)).toEqual(["logged", "confirmed", "outcome_lost"]);
  });

  it("imports a CSV with a dry run first, skipping bad rows and duplicates", async () => {
    const csv = [
      "Quotation No.,Party Name,Mobile,Amount,Date,Sales Person,Status",
      "PIS-1,Vatva Chem,9876500013,\"2,45,000\",01/09/2026,Ramesh,Pending",
      "PIS-2,Kalol Packaging,9876500014,1.2 L,02/09/2026,ramesh,Order received",
      "PIS-3,Naroda Fab,123,abc,31/02/2026,Unknown,???",
      "PIS-4,Rajkot Pumps,,85000,03/09/2026,Nobody,open",
      "PIS-1,Vatva Chem,9876500013,\"2,45,000\",01/09/2026,Ramesh,Pending",
    ].join("\n");
    const parsed = await app.inject({ method: "POST", url: `/v1/tenants/${tid}/import/parse`, ...multipartCsv("quotes.csv", csv) });
    expect(parsed.statusCode).toBe(200);
    const p = parsed.json();
    expect(p.rows).toHaveLength(5);
    expect(p.mapping).toMatchObject({ quoteNumber: 0, company: 1, buyerPhone: 2, amount: 3, sentAt: 4, rep: 5, status: 6 });

    const payload = { fileName: p.fileName, headers: p.headers, rows: p.rows, mapping: p.mapping };
    const dry = (await app.inject({ method: "POST", url: `/v1/tenants/${tid}/import/commit`, headers: auth, payload })).json();
    expect(dry).toMatchObject({ dryRun: true, total: 5, valid: 3 });
    expect(dry.errors.some((e: { row: number; message: string }) => e.row === 5 && /salesperson/.test(e.message))).toBe(true);

    const done = (await app.inject({ method: "POST", url: `/v1/tenants/${tid}/import/commit`, headers: auth, payload: { ...payload, dryRun: false } })).json();
    expect(done).toMatchObject({ imported: 2, duplicates: 1 });

    const list = (await app.inject({ method: "GET", url: `/v1/tenants/${tid}/quotes?status=open,won`, headers: auth })).json();
    expect(list.items.map((i: { status: string }) => i.status).sort()).toEqual(["open", "won"]);

    const reparsed = (await app.inject({ method: "POST", url: `/v1/tenants/${tid}/import/parse`, ...multipartCsv("again.csv", csv) })).json();
    expect(reparsed.mapping).toEqual(p.mapping);
  });

  it("puts swept quotes on the chase list until someone acts", async () => {
    // The imported Sept quote is overdue, so confirm scheduled it for the next sendable time
    // (tomorrow 10:00 if this runs in quiet hours). Sweeping 3 days ahead always makes it due.
    const sweepAt = new Date(Date.now() + 3 * 86_400_000);
    await sweepOnce(logger, sweepAt);
    const today = (await app.inject({ method: "GET", url: `/v1/tenants/${tid}/today`, headers: auth })).json();
    expect(today.pending).toHaveLength(1);
    expect(today.pending[0]).toMatchObject({ reason: "nudge_due", step: 0 });
    expect(today.summary.open.count).toBe(1);

    const qid = today.pending[0].quote.id;
    // The rep acts after the nudge: move the clock (Date only) past the sweep.
    vi.useFakeTimers({ toFake: ["Date"], now: sweepAt.getTime() + 60_000 });
    await app.inject({ method: "POST", url: `/v1/tenants/${tid}/quotes/${qid}/actions`, headers: auth, payload: { type: "sent" } });
    const after = (await app.inject({ method: "GET", url: `/v1/tenants/${tid}/today`, headers: auth })).json();
    vi.useRealTimers();
    expect(after.pending).toHaveLength(0);
  });
});
