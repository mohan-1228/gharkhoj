import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "../lib/env";
import { AppError } from "../lib/errors";

/** Authenticate Lambda → app calls with a shared secret (constant-time compare). */
export function assertInternalRequest(req: NextRequest): void {
  const given = Buffer.from(req.headers.get("x-internal-secret") ?? "");
  const expected = Buffer.from(env.INTERNAL_API_SECRET);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new AppError("UNAUTHENTICATED", "Invalid internal credentials");
  }
}
