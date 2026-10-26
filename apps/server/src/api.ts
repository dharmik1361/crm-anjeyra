import { loadEnv } from "@qf/config";
import { connectDb, disconnectDb } from "@qf/db";
import { buildApp } from "./app.js";

const env = loadEnv();
if (!env.MONGO_URL) throw new Error("MONGO_URL is required (run `pnpm dev:db` locally)");

await connectDb(env.MONGO_URL);
const app = await buildApp({ adminToken: env.ADMIN_TOKEN });
await app.listen({ port: env.PORT, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close();
    await disconnectDb();
    process.exit(0);
  });
}
