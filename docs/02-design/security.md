# Security Design & Threat Model

## 1. Assets

| Asset                                                                       | Sensitivity             |
| --------------------------------------------------------------------------- | ----------------------- |
| Account data (email, phone, name)                                           | Personal data           |
| Verification documents (citizenship / lalpurja)                             | Highly sensitive        |
| Exact property location (when landlord chose approximate)                   | Privacy-sensitive       |
| Session cookies, Cognito client secret, DB credentials, internal API secret | Secrets                 |
| Listing integrity (no scams)                                                | Business-critical trust |

## 2. Trust boundaries

Internet → **CloudFront + WAF** → ALB (accepts CloudFront only) → ECS tasks (private subnets) → RDS (isolated subnets). Browsers upload straight to S3 using narrowly scoped presigned POSTs. Lambdas call back into the app through CloudFront using a shared secret.

## 3. STRIDE analysis

| Threat                     | Example                                                                       | Mitigations                                                                                                                                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Spoofing**               | Forged session; bypassing CloudFront to hit the ALB                           | Cognito OIDC with PKCE + state + nonce; HS256-signed cookie with issuer/audience checks; ALB only allows the CloudFront prefix list **and** a secret `X-Origin-Verify` header; Lambda → app uses a constant-time shared-secret check                                |
| **Tampering**              | Uploading into another listing's folder; editing someone else's listing       | Upload keys derived server-side; prefix + size + type re-verified; ownership checked in every service (`assertOwnerOrAdmin`); presigned POST conditions                                                                                                             |
| **Repudiation**            | Admin denies taking down a listing                                            | Append-only `audit_log` for admin, moderation, verification-document views, sign-ups and account deletion                                                                                                                                                           |
| **Information disclosure** | Leaking exact address, phone numbers or verification docs; EXIF GPS in photos | Approximate-location offset on the server; phone + address revealed only after tour confirmation; docs under `private/` with 5-min signed URLs; CloudFront explicitly denied anything outside `media/`; EXIF stripped; logs redact cookies, auth headers and phones |
| **Denial of service**      | Scraping, brute force, spam listings/reports/tours                            | WAF managed rules + 2000 req/5 min/IP + 300 API writes/5 min/IP; in-app limits (tours, reports, geocoding, listing creation); image decompression-bomb guard (60 MP); presign size limits                                                                           |
| **Elevation of privilege** | Renter calling admin APIs; self-promotion to admin                            | Role from DB on every request (not from the cookie); sign-up roles limited to renter/landlord; admin via an admin or the bootstrap allow-list for verified emails only; admins can't ban themselves or other admins                                                 |

## 4. OWASP Top 10 (2021) mapping

| Risk                               | Controls in GharKhoj                                                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 Broken access control          | Service-layer guards; middleware page guards; owner checks; integration tests for forbidden paths                                                                                                   |
| A02 Cryptographic failures         | TLS everywhere (CloudFront HTTPS redirect, `rds.force_ssl`, S3 `enforceSSL`); encryption at rest (RDS, S3, Secrets Manager); HSTS preload header                                                    |
| A03 Injection                      | Prisma + tagged-template raw SQL (bound parameters only); Zod validation on every input; React output escaping; HTML-escaped email templates; JSON-LD `<` escaping                                  |
| A04 Insecure design                | Threat model (this doc); state machines for listings/tours; progressive disclosure of contact info                                                                                                  |
| A05 Security misconfiguration      | IaC with assertion tests (no public bucket/DB, WAF attached, wildcard-IAM check); strict CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `poweredByHeader: false` |
| A06 Vulnerable components          | `pnpm audit` in CI; Dependabot; patched Next/React for CVE-2025-55182; overrides for vulnerable transitive deps                                                                                     |
| A07 Identification & auth failures | Cognito password policy, email verification, optional MFA; session expiry; banned users rejected on every request                                                                                   |
| A08 Software & data integrity      | OIDC deploys (no static keys); immutable ECR tags; lockfile + `--frozen-lockfile`; signed sessions                                                                                                  |
| A09 Logging & monitoring failures  | Structured logs with request ids; alarms on 5xx/latency/unhealthy tasks/DB/Lambda errors/DLQ; audit log                                                                                             |
| A10 SSRF                           | Server fetches only fixed hosts (Nominatim, Cognito); media processing reads only S3 keys under validated prefixes                                                                                  |

## 5. Secrets management

| Secret                                                                                       | Where it lives                                             | Rotation                                |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| DB credentials                                                                               | Secrets Manager (generated by RDS construct) → ECS secrets | Enable RDS rotation (runbook)           |
| `SESSION_SECRET`                                                                             | Secrets Manager (generated)                                | Rotate → every user is signed out       |
| `INTERNAL_API_SECRET`                                                                        | Secrets Manager; read by the ECS task + both Lambdas       | Rotate, then force a new ECS deployment |
| Cognito client secret                                                                        | Secrets Manager (copied from the user pool client)         | Recreate client                         |
| Origin-verify header                                                                         | Secrets Manager (CloudFormation dynamic reference)         | Rotate + redeploy                       |
| Local secrets live in `.env.local` (git-ignored). `.env.example` contains placeholders only. |

## 6. IAM least privilege

- Task role: S3 put/read/delete limited to `uploads/*`, `media/*`, `private/*`; SES send; Cognito group admin on the one user pool; SNS publish (SMS has no resource ARN, feature-flagged off).
- image-processor: read `uploads/*`, write `media/*`, read one secret, Rekognition (no resource-level support).
- GitHub role: push to one ECR repo; assume the CDK bootstrap roles only; trusted only for `main` / the `production` environment of one repo.
- **Allowed `*` resources** (enforced by `infra/test/stacks.test.ts`): `rekognition:DetectModerationLabels`, `sns:Publish`, `ecr:GetAuthorizationToken`, ECS Exec `ssmmessages:*`, `logs:DescribeLogGroups`. Each is an AWS API without resource-level permissions.

## 7. Known gaps / next steps

1. CloudFront → ALB is HTTP inside AWS (no custom domain yet). With a custom domain: ACM certificate on the ALB + `HTTPS_ONLY` origin policy.
2. In-process rate limiting is per container (WAF is the global limiter). Move to Redis/ElastiCache if per-user limits must be exact.
3. `x-forwarded-for` can be prefixed by clients; in-app limits use the first hop. Prefer `CloudFront-Viewer-Address` by adding it to the origin request policy.
4. Session revocation is by expiry/ban check; add a session table if "sign out everywhere" is needed.
5. Enable RDS secret rotation and GuardDuty / Security Hub in the production account.
