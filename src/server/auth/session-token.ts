import { jwtVerify, SignJWT } from "jose";

/**
 * Session token = HS256 JWT in an httpOnly cookie. Edge-safe (no Node APIs) so
 * the middleware can verify it. Contains only the user id and a role hint;
 * authorization always re-reads the role from the database.
 */
export const SESSION_COOKIE = "gk_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionClaims {
  sub: string;
  role: "renter" | "landlord" | "admin";
}

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSession(claims: SessionClaims, secret: string): Promise<string> {
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("gharkhoj")
    .setAudience("gharkhoj-web")
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key(secret));
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: "gharkhoj",
      audience: "gharkhoj-web",
      algorithms: ["HS256"],
    });
    const role = payload.role;
    if (!payload.sub || (role !== "renter" && role !== "landlord" && role !== "admin")) return null;
    return { sub: payload.sub, role };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(secure: boolean) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: SESSION_TTL_SECONDS };
}
