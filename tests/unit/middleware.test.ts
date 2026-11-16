// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { middleware } from "@/middleware";
import { signSession } from "@/server/auth/session-token";

const SECRET = "m".repeat(40);
beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
  process.env.APP_URL = "http://localhost:3000";
});

const req = (path: string, init: { method?: string; headers?: Record<string, string>; cookie?: string } = {}) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? "GET",
    headers: { ...(init.headers ?? {}), ...(init.cookie ? { cookie: `gk_session=${init.cookie}` } : {}) },
  });

describe("middleware", () => {
  it("blocks cross-site state-changing API calls (CSRF)", async () => {
    const res = await middleware(
      req("/api/v1/favorites/x", { method: "POST", headers: { origin: "https://evil.example" } }),
    );
    expect(res.status).toBe(403);
  });
  it("allows same-origin API writes and all reads", async () => {
    expect(
      (await middleware(req("/api/v1/favorites/x", { method: "POST", headers: { origin: "http://localhost:3000" } })))
        .status,
    ).toBe(200);
    expect((await middleware(req("/api/v1/listings"))).status).toBe(200);
  });
  it("lets Lambdas call internal endpoints (they use a shared secret instead)", async () => {
    expect((await middleware(req("/api/v1/internal/media-processed", { method: "POST" }))).status).toBe(200);
  });
  it("redirects signed-out users from protected pages to /login with returnTo", async () => {
    const res = await middleware(req("/landlord/listings?x=1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?returnTo=%2Flandlord%2Flistings%3Fx%3D1");
  });
  it("keeps renters out of landlord and admin areas", async () => {
    const renter = await signSession({ sub: "u", role: "renter" }, SECRET);
    expect((await middleware(req("/landlord", { cookie: renter }))).headers.get("location")).toContain(
      "/account/become-landlord",
    );
    expect((await middleware(req("/admin", { cookie: renter }))).headers.get("location")).toBe(
      "http://localhost:3000/",
    );
    expect((await middleware(req("/account", { cookie: renter }))).status).toBe(200);
  });
});
