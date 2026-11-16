import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + DB readiness probe used by the ALB target group and Playwright. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up", version: process.env.APP_VERSION ?? "dev" });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
