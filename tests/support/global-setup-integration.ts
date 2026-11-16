import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { loadTestEnv } from "./load-env";

/**
 * Once per integration run: rebuild the disposable test DB from migrations and
 * load reference data. Refuses to touch any database not named *_test.
 */
export default async function setup() {
  loadTestEnv();
  const url = new URL(process.env.DATABASE_URL!);
  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to reset non-test database "${dbName}"`);

  const prisma = new PrismaClient();
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$disconnect();

  const env = { ...process.env, SEED_DEMO: "false" };
  execSync("pnpm exec prisma migrate deploy", { stdio: "pipe", env });
  execSync("pnpm exec tsx --conditions=react-server prisma/seed/index.ts", { stdio: "pipe", env });
}
