import pino from "pino";

// Buyer PII and money never go to logs.
export const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "*.phone",
      "*.email",
      "*.buyer",
      "*.amountPaise",
      "body.rows",
    ],
    censor: "[redacted]",
  },
};

export const logger = pino(loggerOptions);
