import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import {
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import type { Role } from "@prisma/client";
import { env } from "../lib/env";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

/**
 * Amazon Cognito Hosted UI — OAuth 2.0 Authorization Code flow with PKCE (ADR-0003).
 * Tokens never reach the browser: the server exchanges the code, verifies the
 * ID token's signature/audience/expiry/nonce, then issues our own session cookie.
 */
const b64url = (buf: Buffer) => buf.toString("base64url");

export function createPkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge, state: b64url(randomBytes(16)), nonce: b64url(randomBytes(16)) };
}

export function authorizeUrl(opts: { state: string; nonce: string; challenge: string; signup: boolean }): string {
  const url = new URL(opts.signup ? "/signup" : "/oauth2/authorize", env.COGNITO_DOMAIN);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.COGNITO_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${env.APP_URL}/api/v1/auth/callback`);
  url.searchParams.set("scope", "openid email profile phone");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("nonce", opts.nonce);
  url.searchParams.set("code_challenge", opts.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function logoutUrl(): string {
  const url = new URL("/logout", env.COGNITO_DOMAIN);
  url.searchParams.set("client_id", env.COGNITO_CLIENT_ID!);
  url.searchParams.set("logout_uri", `${env.APP_URL}/`);
  return url.toString();
}

export async function exchangeCode(code: string, verifier: string): Promise<{ idToken: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.COGNITO_CLIENT_ID!,
    code,
    redirect_uri: `${env.APP_URL}/api/v1/auth/callback`,
    code_verifier: verifier,
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (env.COGNITO_CLIENT_SECRET) {
    headers.Authorization = `Basic ${Buffer.from(`${env.COGNITO_CLIENT_ID}:${env.COGNITO_CLIENT_SECRET}`).toString("base64")}`;
  }
  const res = await fetch(new URL("/oauth2/token", env.COGNITO_DOMAIN), {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    logger.warn({ status: res.status }, "cognito token exchange failed");
    throw new AppError("UNAUTHENTICATED", "Sign-in failed. Please try again.");
  }
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw new AppError("UNAUTHENTICATED", "Sign-in failed. Please try again.");
  return { idToken: json.id_token };
}

let verifier:
  ReturnType<typeof CognitoJwtVerifier.create<{ userPoolId: string; clientId: string; tokenUse: "id" }>> | undefined;

export interface CognitoIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  phone: string | null;
  nonce: string | undefined;
}

export async function verifyIdToken(idToken: string): Promise<CognitoIdentity> {
  verifier ??= CognitoJwtVerifier.create({
    userPoolId: env.COGNITO_USER_POOL_ID!,
    clientId: env.COGNITO_CLIENT_ID!,
    tokenUse: "id",
  });
  const p = await verifier.verify(idToken);
  return {
    sub: p.sub,
    email: String(p.email ?? "").toLowerCase(),
    emailVerified: String(p.email_verified) === "true",
    name: typeof p.name === "string" ? p.name : null,
    phone: typeof p.phone_number === "string" ? p.phone_number : null,
    nonce: typeof p.nonce === "string" ? p.nonce : undefined,
  };
}

const idp = () => new CognitoIdentityProviderClient({ region: env.AWS_REGION });

/** Mirror the DB role into Cognito groups (renter/landlord/admin). Best effort — DB stays authoritative. */
export async function syncCognitoGroup(cognitoSub: string | null, role: Role, previous?: Role): Promise<void> {
  if (env.AUTH_MODE !== "cognito" || !cognitoSub) return;
  try {
    const client = idp();
    if (previous && previous !== role) {
      await client.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: env.COGNITO_USER_POOL_ID!,
          Username: cognitoSub,
          GroupName: previous,
        }),
      );
    }
    await client.send(
      new AdminAddUserToGroupCommand({ UserPoolId: env.COGNITO_USER_POOL_ID!, Username: cognitoSub, GroupName: role }),
    );
  } catch (err) {
    logger.warn({ err, role }, "cognito group sync failed");
  }
}

export async function deleteCognitoUser(cognitoSub: string | null): Promise<void> {
  if (env.AUTH_MODE !== "cognito" || !cognitoSub) return;
  await idp()
    .send(new AdminDeleteUserCommand({ UserPoolId: env.COGNITO_USER_POOL_ID!, Username: cognitoSub }))
    .catch((err) => logger.warn({ err }, "cognito user delete failed"));
}
