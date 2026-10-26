import { InvalidTransitionError } from "@qf/core";
import { NotFoundError, ValidationError } from "@qf/db";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export function errorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ZodError) {
    return reply.code(400).send({ error: "invalid_request", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  }
  if (err instanceof ValidationError) return reply.code(400).send({ error: "invalid_request", message: err.message });
  if (err instanceof NotFoundError) return reply.code(404).send({ error: "not_found", message: err.message });
  if (err instanceof InvalidTransitionError) return reply.code(409).send({ error: "invalid_transition", message: err.message });
  if ((err as { code?: number }).code === 11000) return reply.code(409).send({ error: "duplicate", message: "Already exists" });
  if ((err as { name?: string }).name === "ValidationError") {
    return reply.code(400).send({ error: "invalid_request", message: err.message });
  }
  const status = (err as FastifyError).statusCode;
  if (status && status < 500) return reply.code(status).send({ error: "request_error", message: err.message });
  req.log.error({ err }, "unhandled error");
  return reply.code(500).send({ error: "internal", message: "Something went wrong" });
}
