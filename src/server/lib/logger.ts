import "server-only";
import pino from "pino";

/** Structured JSON logger. CloudWatch ingests one JSON object per line. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "gharkhoj-web" },
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token", "*.contactPhone", "*.phone"],
    censor: "[redacted]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
