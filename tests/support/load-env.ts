import { existsSync } from "node:fs";

/** Load .env.local (if present) and point Prisma at the isolated test database. */
export function loadTestEnv(): void {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? "postgresql://gharkhoj:gharkhoj@localhost:5433/gharkhoj_test?schema=public";
  process.env.MAIL_TRANSPORT = "log";
  process.env.IMAGE_PROCESSING = "inline";
  process.env.MODERATION = "off";
  process.env.LOG_LEVEL = "error";
  process.env.SESSION_SECRET ??= "integration-test-session-secret-long-enough";
  process.env.INTERNAL_API_SECRET ??= "integration-test-internal-secret-long-enough";
  process.env.MEDIA_BASE_URL ??= "http://localhost:9000/gharkhoj-media";
}
