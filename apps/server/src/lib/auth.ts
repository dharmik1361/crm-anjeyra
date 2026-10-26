import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * S0: the console is founder-only, guarded by one bearer token. M1 replaces this with
 * WhatsApp magic-link sessions scoped to a tenant and role.
 */
export function bearerAuth(token: string) {
  const expected = Buffer.from(token);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization ?? "";
    const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  };
}
