import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session-token";

/**
 * Edge middleware:
 *  1. Page guards — redirect signed-out users to /login, block wrong roles early.
 *     (Coarse UX check only; services re-check roles against the DB.)
 *  2. CSRF — state-changing /api requests must come from our own origin.
 *     Session cookies are SameSite=Lax as a second layer.
 *  3. Request id propagation for log correlation.
 */
const PAGE_RULES: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/landlord", roles: ["landlord", "admin"] },
  { prefix: "/account", roles: ["renter", "landlord", "admin"] },
];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sameOrigin(req: NextRequest): boolean {
  const allowed = new URL(process.env.APP_URL ?? req.nextUrl.origin).origin;
  const origin = req.headers.get("origin");
  if (origin) return origin === allowed || origin === req.nextUrl.origin;
  // Some clients omit Origin on same-origin requests; fall back to Fetch Metadata.
  const site = req.headers.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);

  if (pathname.startsWith("/api/")) {
    // Lambdas authenticate with a shared secret instead of a browser origin.
    const isInternal = pathname.startsWith("/api/v1/internal/");
    if (!SAFE_METHODS.has(req.method) && !isInternal && !sameOrigin(req)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Cross-site request blocked" } },
        { status: 403 },
      );
    }
    return NextResponse.next({ request: { headers } });
  }

  const rule = PAGE_RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (rule) {
    const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET ?? "");
    if (!claims) {
      const url = new URL("/login", req.url);
      url.searchParams.set("returnTo", pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
    if (!rule.roles.includes(claims.role)) {
      const url = new URL(rule.prefix === "/landlord" ? "/account/become-landlord" : "/", req.url);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Skip static assets and Next internals.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|.*\\.(?:png|jpg|svg|webp|ico|css|js)$).*)",
  ],
};
