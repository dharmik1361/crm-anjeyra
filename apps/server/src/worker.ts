import { loadEnv } from "@qf/config";
import { istDateKey, istMinutesOfDay, parseHHMM } from "@qf/core";
import { connectDb, disconnectDb, listTenants } from "@qf/db";
import { formatDigest, tenantSnapshot } from "./jobs/digest.js";
import { sweepOnce } from "./jobs/sweeper.js";
import { logger } from "./lib/logger.js";

const env = loadEnv();
if (!env.MONGO_URL) throw new Error("MONGO_URL is required (run `pnpm dev:db` locally)");
await connectDb(env.MONGO_URL);

const DIGEST_TIME = parseHHMM("09:30");
let lastDigestDay: string | null = null;
let running = false;

async function founderDigest(now: Date) {
  const tenants = (await listTenants()).filter((t) => t.status !== "exited");
  const parts: string[] = [];
  for (const t of tenants) {
    const snap = await tenantSnapshot(String(t._id), now);
    if (snap) parts.push(formatDigest(snap));
  }
  // M1: send over WhatsApp to the founder number. Until then the digest lives in logs + console.
  logger.info({ digest: parts.join("\n\n") }, "founder digest");
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    await sweepOnce(logger, now);
    const today = istDateKey(now);
    if (lastDigestDay !== today && istMinutesOfDay(now) >= DIGEST_TIME) {
      lastDigestDay = today;
      await founderDigest(now);
    }
  } catch (err) {
    logger.error({ err }, "worker tick failed");
  } finally {
    running = false;
  }
}

logger.info({ intervalSec: env.SWEEP_INTERVAL_SEC }, "worker started");
await tick();
const timer = setInterval(tick, env.SWEEP_INTERVAL_SEC * 1000);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    clearInterval(timer);
    await disconnectDb();
    process.exit(0);
  });
}
