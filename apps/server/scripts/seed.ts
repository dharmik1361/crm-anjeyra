// Demo data: one client with an owner, two reps and ~24 quotes at every lifecycle stage.
import { loadEnv } from "@qf/config";
import { addWorkingDays, DEFAULT_CALENDAR } from "@qf/core";
import { applyQuoteAction, connectDb, createQuote, createTenant, createUser, disconnectDb, Tenant } from "@qf/db";
import { sweepOnce } from "../src/jobs/sweeper.js";
import { logger } from "../src/lib/logger.js";

const env = loadEnv();
await connectDb(env.MONGO_URL!);

if (await Tenant.exists({ slug: "demo-patel" })) {
  console.log("Demo tenant already exists — drop .mongo-dev/ to reseed.");
  await disconnectDb();
  process.exit(0);
}

const tenant = await createTenant({ name: "Patel Industrial Supplies (demo)", slug: "demo-patel", plan: "concierge" });
const tid = String(tenant._id);
await createUser(tid, { name: "Kiran Patel", phone: "9825000001", role: "owner" });
const ramesh = await createUser(tid, { name: "Ramesh", phone: "9825000002", role: "rep" });
const priya = await createUser(tid, { name: "Priya", phone: "9825000003", role: "rep" });

const buyers = [
  ["Gujarat Oils Pvt Ltd", "Mehul Shah", "9876500011"],
  ["Sanand Auto Components", "Harsh Desai", "9876500012"],
  ["Vatva Chem Industries", "Nikunj Joshi", "9876500013"],
  ["Kalol Packaging", "Ritesh Modi", "9876500014"],
  ["Naroda Fabricators", "Bhavesh Patel", "9876500015"],
  ["Rajkot Pumps & Motors", "Jignesh Parmar", "9876500016"],
  ["Mehsana Dairy Equipments", "Dhaval Thakkar", "9876500017"],
  ["Ankleshwar Polymers", "Sanjay Mehta", "9876500018"],
];

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const ages = [0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 14, 15, 18, 20, 25, 3, 5, 9, 13, 16, 21, 2, 30];

for (const [i, age] of ages.entries()) {
  const [company, name, phone] = buyers[i % buyers.length]!;
  const q = await createQuote(
    tid,
    {
      repId: String(i % 3 === 0 ? priya._id : ramesh._id),
      buyer: { company, name, phone },
      quoteNumber: `PIS/26-27/${String(118 + i).padStart(4, "0")}`,
      amountPaise: (50_000 + ((i * 37_919) % 950_000)) * 100,
      sentAt: daysAgo(age),
      source: "import",
    },
    null,
    // Replay the cadence as if the quote had been logged on the day it was sent.
    { confirm: true, now: daysAgo(age) },
  );
  // Walk the schedule forward to today so events look like real history.
  let cursor = q;
  while (cursor?.nextActionAt && cursor.nextActionAt <= now) {
    cursor = (await applyQuoteAction(tid, String(q._id), { type: "advance" }, null, { now: cursor.nextActionAt }))!;
  }
  if (i === 3) await applyQuoteAction(tid, String(q._id), { type: "won" }, null);
  if (i === 7) await applyQuoteAction(tid, String(q._id), { type: "lost", reason: "price" }, null);
  if (i === 10) await applyQuoteAction(tid, String(q._id), { type: "buyer_replied" }, null);
  if (i === 16) await applyQuoteAction(tid, String(q._id), { type: "snooze", days: 2 }, null);
}
await sweepOnce(logger, now);
console.log(`Seeded tenant ${tid} with ${ages.length} quotes (calendar check: next working day ${addWorkingDays(now, 1, DEFAULT_CALENDAR).toDateString()})`);
await disconnectDb();
