import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { authorizeUrl, createPkce } from "@/server/auth/cognito";
import { env } from "@/server/lib/env";
import { route } from "@/server/lib/http";
import { safeReturnTo } from "@/server/services/auth-service";

/** GET /api/v1/auth/login?returnTo=/x&role=landlord&signup=1 — start the Cognito Hosted UI flow. */
export const GET = route(async (req) => {
  const sp = req.nextUrl.searchParams;
  const returnTo = safeReturnTo(sp.get("returnTo"));
  if (env.AUTH_MODE !== "cognito") {
    return NextResponse.redirect(new URL(`/login?returnTo=${encodeURIComponent(returnTo)}`, env.APP_URL));
  }
  const role = sp.get("role") === "landlord" ? "landlord" : "renter";
  const pkce = createPkce();
  // State, nonce and PKCE verifier live in a short-lived, signed, httpOnly cookie.
  const token = await new SignJWT({ state: pkce.state, nonce: pkce.nonce, verifier: pkce.verifier, returnTo, role })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("gharkhoj-oauth")
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(env.SESSION_SECRET));
  const res = NextResponse.redirect(authorizeUrl({ ...pkce, signup: sp.get("signup") === "1" }));
  res.cookies.set("gk_oauth", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: 600,
  });
  return res;
});
