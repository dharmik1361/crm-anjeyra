// Local MongoDB for development without Docker. Data persists in .mongo-dev/ at the repo root.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const dbPath = fileURLToPath(new URL("../../../.mongo-dev", import.meta.url));
mkdirSync(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: { port: 27018, dbPath, storageEngine: "wiredTiger" },
});
console.log(`Dev MongoDB ready at ${server.getUri()}quotefollow (data in .mongo-dev/)`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  });
}
