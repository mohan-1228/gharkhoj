import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { exchangeCode, verifyIdToken } from "@/server/auth/cognito";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/auth/session-token";
import { env } from "@/server/lib/env";
import { route } from "@/server/lib/http";
import { logger } from "@/server/lib/logger";
import { upsertFromCognito } from "@/server/services/auth-service";

const fail = (reason: string) =>
  NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, env.APP_URL));

/** GET /api/v1/auth/callback — Cognito redirects here with ?code&state. */
export const GET = route(async (req) => {
  if (env.AUTH_MODE !== "cognito") return fail("disabled");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookie = req.cookies.get("gk_oauth")?.value;
  if (!code || !state || !cookie) return fail("expired");

  let flow: { state: string; nonce: string; verifier: string; returnTo: string; role: "renter" | "landlord" };
  try {
    const { payload } = await jwtVerify(cookie, new TextEncoder().encode(env.SESSION_SECRET), {
      audience: "gharkhoj-oauth",
    });
    flow = payload as unknown as typeof flow;
  } catch {
    return fail("expired");
  }
  if (flow.state !== state) return fail("state"); // CSRF on the OAuth flow

  try {
    const { idToken } = await exchangeCode(code, flow.verifier);
    const identity = await verifyIdToken(idToken);
    if (identity.nonce !== flow.nonce) return fail("nonce"); // replay protection
    const user = await upsertFromCognito(identity, flow.role);
    const res = NextResponse.redirect(new URL(flow.returnTo, env.APP_URL));
    res.cookies.set(
      SESSION_COOKIE,
      await signSession({ sub: user.id, role: user.role }, env.SESSION_SECRET),
      sessionCookieOptions(env.NODE_ENV === "production"),
    );
    res.cookies.delete({ name: "gk_oauth", path: "/api/v1/auth" });
    return res;
  } catch (err) {
    logger.warn({ err }, "oauth callback failed");
    return fail("signin");
  }
});
