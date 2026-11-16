// @vitest-environment node
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "@/server/auth/session-token";
import { safeReturnTo } from "@/server/services/auth-service";

const SECRET = "x".repeat(40);

describe("session token", () => {
  it("round-trips claims", async () => {
    const t = await signSession({ sub: "u1", role: "landlord" }, SECRET);
    expect(await verifySession(t, SECRET)).toEqual({ sub: "u1", role: "landlord" });
  });
  it("rejects a token signed with another secret", async () => {
    const t = await signSession({ sub: "u1", role: "admin" }, "y".repeat(40));
    expect(await verifySession(t, SECRET)).toBeNull();
  });
  it("rejects tokens with the wrong audience (e.g. the OAuth state cookie)", async () => {
    const t = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setAudience("gharkhoj-oauth")
      .setIssuer("gharkhoj")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(t, SECRET)).toBeNull();
  });
  it("rejects unknown roles and garbage", async () => {
    const t = await new SignJWT({ role: "superuser" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setAudience("gharkhoj-web")
      .setIssuer("gharkhoj")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(t, SECRET)).toBeNull();
    expect(await verifySession("not.a.jwt", SECRET)).toBeNull();
    expect(await verifySession(undefined, SECRET)).toBeNull();
  });
});

describe("safeReturnTo (open redirect guard)", () => {
  it.each([
    ["/landlord", "/landlord"],
    ["/rent?city=pokhara", "/rent?city=pokhara"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    [null, "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });
});
