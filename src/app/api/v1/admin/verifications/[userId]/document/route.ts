import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { route } from "@/server/lib/http";
import { verificationDocumentUrl } from "@/server/services/admin-service";

/** Redirects an admin to a 5-minute signed URL for the private document. */
export const GET = route<{ userId: string }>(async (_req, { params }) => {
  const res = NextResponse.redirect(await verificationDocumentUrl(await getCurrentUser(), params.userId));
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
});
