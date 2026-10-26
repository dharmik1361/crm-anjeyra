import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { dbReady } from "@qf/db";
import Fastify from "fastify";
import { bearerAuth } from "./lib/auth.js";
import { errorHandler } from "./lib/errors.js";
import { loggerOptions } from "./lib/logger.js";
import { importRoutes } from "./routes/imports.js";
import { quoteRoutes } from "./routes/quotes.js";
import { tenantRoutes } from "./routes/tenants.js";

export async function buildApp(opts: { adminToken: string; logger?: boolean; corsOrigin?: string }) {
  const app = Fastify({ logger: opts.logger === false ? false : loggerOptions, trustProxy: true, bodyLimit: 5 * 1024 * 1024 });
  await app.register(helmet);
  await app.register(cors, { origin: opts.corsOrigin ?? false });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  app.setErrorHandler(errorHandler);

  app.get("/healthz", async (_req, reply) => {
    const ok = dbReady();
    return reply.code(ok ? 200 : 503).send({ ok, db: ok ? "up" : "down" });
  });

  await app.register(async (secured) => {
    secured.addHook("onRequest", bearerAuth(opts.adminToken));
    await secured.register(tenantRoutes);
    await secured.register(quoteRoutes);
    await secured.register(importRoutes);
  });

  return app;
}
