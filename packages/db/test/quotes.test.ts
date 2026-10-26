import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  applyQuoteAction,
  connectDb,
  createQuote,
  createTenant,
  createUser,
  findDueQuotes,
  findDuplicate,
  getQuote,
  listQuoteEvents,
  listQuotes,
  updateTenantSettings,
} from "../src/index.js";

const ist = (s: string) => new Date(`${s}+05:30`);
let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

async function setup() {
  const a = await createTenant({ name: "Patel Chemicals", slug: "patel" });
  const b = await createTenant({ name: "Shah Packaging", slug: "shah" });
  await updateTenantSettings(String(a._id), { calendar: { holidays: [] } }, "test");
  const repA = await createUser(String(a._id), { name: "Ramesh", phone: "9812345678", role: "rep" });
  const repB = await createUser(String(b._id), { name: "Suresh", phone: "9898989898", role: "rep" });
  return { a: String(a._id), b: String(b._id), repA: String(repA._id), repB: String(repB._id) };
}

const input = (repId: string) => ({
  repId,
  buyer: { name: "Mehul", company: "Gujarat Oils", phone: "9876543210" },
  quoteNumber: "Q-118",
  amountPaise: 24_500_000,
  sentAt: ist("2026-10-19T16:00:00"),
  source: "manual" as const,
});

describe("quote repository", () => {
  it("creates confirmed quotes with a schedule and events", async () => {
    const { a, repA } = await setup();
    const q = await createQuote(a, input(repA), null, { confirm: true, now: ist("2026-10-19T16:00:00") });
    expect(q.status).toBe("open");
    expect(q.nextActionAt).toEqual(ist("2026-10-21T16:00:00"));
    expect(q.buyer?.phone).toBe("919876543210");
    const events = await listQuoteEvents(a, String(q._id));
    expect(events.map((e) => e.type)).toEqual(["logged", "confirmed"]);
  });

  it("isolates tenants", async () => {
    const { a, b, repA, repB } = await setup();
    const q = await createQuote(a, input(repA), null, { confirm: true });
    expect(await getQuote(b, String(q._id))).toBeNull();
    expect((await listQuotes(b)).total).toBe(0);
    await expect(createQuote(a, input(repB), null, { confirm: true })).rejects.toThrow(/does not belong/);
    await expect(applyQuoteAction(b, String(q._id), { type: "won" }, null)).rejects.toThrow(/not found/);
  });

  it("detects duplicates by quote number", async () => {
    const { a, repA } = await setup();
    await createQuote(a, input(repA), null, { confirm: true });
    expect(await findDuplicate(a, { ...input(repA), quoteNumber: " q-118 " })).not.toBeNull();
    expect(await findDuplicate(a, { ...input(repA), quoteNumber: "Q-119" })).toBeNull();
  });

  it("sweeps due quotes through to escalation", async () => {
    const { a, repA } = await setup();
    const q = await createQuote(a, input(repA), null, { confirm: true, now: ist("2026-10-19T16:00:00") });
    let now = ist("2026-10-19T16:00:00");
    for (let i = 0; i < 4; i++) {
      const current = (await getQuote(a, String(q._id)))!;
      now = current.nextActionAt!;
      const due = await findDueQuotes(now);
      expect(due.map((d) => String(d._id))).toEqual([String(q._id)]);
      await applyQuoteAction(a, String(q._id), { type: "advance" }, null, { now });
    }
    const final = (await getQuote(a, String(q._id)))!;
    expect(final.status).toBe("escalated");
    expect(await findDueQuotes(ist("2027-01-01T00:00:00"))).toHaveLength(0);
    const types = (await listQuoteEvents(a, String(q._id))).map((e) => e.type);
    expect(types.filter((t) => t === "nudge_due")).toHaveLength(3);
    expect(types.at(-1)).toBe("escalated");
  });

  it("revises into a new open quote linked to the old one", async () => {
    const { a, repA } = await setup();
    const q = await createQuote(a, input(repA), null, { confirm: true });
    const res = (await applyQuoteAction(a, String(q._id), { type: "revised" }, null, { revisedAmountPaise: 23_000_000 }))!;
    expect(res.status).toBe("revised");
    const rev = (await getQuote(a, (res as { revisionId: string }).revisionId))!;
    expect(rev).toMatchObject({ status: "open", amountPaise: 23_000_000, quoteNumber: "Q-118-R" });
    expect(String(rev.revisedFromId)).toBe(String(q._id));
  });

  it("rejects a stale concurrent write", async () => {
    const { a, repA } = await setup();
    const q = await createQuote(a, input(repA), null, { confirm: true });
    const [r1, r2] = await Promise.all([
      applyQuoteAction(a, String(q._id), { type: "won" }, null),
      applyQuoteAction(a, String(q._id), { type: "snooze", days: 2 }, null),
    ]);
    expect([r1, r2].filter(Boolean)).toHaveLength(1);
  });
});
