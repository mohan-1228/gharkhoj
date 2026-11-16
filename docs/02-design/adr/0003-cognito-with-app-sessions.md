# ADR-0003: Amazon Cognito Hosted UI + app-issued session cookie

**Status:** Accepted (chosen by the product owner) · **Date:** 2026-11-15 · Resolves CLAUDE.md §12.2

## Context

We need sign-up/sign-in with email verification, optional MFA, password reset, and three roles. Building password storage and OTP ourselves is risky.

## Decision

- Use **Cognito Hosted UI** with the OAuth 2.0 **Authorization Code + PKCE** flow and a confidential client. The server exchanges the code and verifies the ID token (`aws-jwt-verify`), checking state and nonce.
- After verification the app issues its **own** short session cookie (HS256 JWT, httpOnly, SameSite=Lax, 7 days). Cognito tokens never reach the browser.
- **The database is the authority for roles.** Cognito groups (`renter`, `landlord`, `admin`) are kept in sync as a mirror, on a best-effort basis.
- Local development uses `AUTH_MODE=dev` (pick a demo account), which is refused in production builds unless explicitly allowed for E2E tests.

## Alternatives

- Validating Cognito access tokens on every request in middleware: couples every request to Cognito JWKS and makes role changes lag until token refresh.
- Custom JWT auth: we would own password hashing, reset flows and OTP delivery.

## Consequences

- ✅ Instant role changes and bans (DB checked per request).
- ✅ No passwords or tokens in our database or browser storage.
- ⚠️ "Sign out everywhere" requires a session table (future).
- ⚠️ SMS OTP to Nepali carriers needs SNS sandbox exit and deliverability testing; email is the default factor.
