# Test Plan & Test Report — GharKhoj v1.0

## 1. Strategy

```
            ▲  fewer, slower, end-to-end confidence
   E2E      │  Playwright: full MVP flow, search, mobile, accessibility (12 cases)
   Infra    │  CDK assertions: security posture of AWS resources (13)
Integration │  Services against REAL PostGIS + MinIO (46)
   Unit     │  Pure logic: state machines, schemas, Nepal formatting, time, security helpers (65)
            ▼  many, fast
```

| Level          | Tooling                                                | Runs where                        | What it proves                                                                                                                               |
| -------------- | ------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | Vitest (+ jsdom)                                       | `pnpm test` · CI · pre-push habit | Business rules in isolation (lifecycle, tour rules, slot generation in UTC+5:45, Zod schemas, EXIF stripping, CSRF/guards, trust heuristics) |
| Integration    | Vitest + Docker PostGIS + MinIO                        | `pnpm test:integration` · CI      | SQL/PostGIS queries, permissions, idempotency, emails (mocked transport), S3 flows. The test DB is rebuilt from migrations each run          |
| E2E            | Playwright (Chromium desktop + Pixel 7) + axe-core     | `pnpm test:e2e` · CI              | Real browser against a **production build**: CLAUDE.md §11 Definition of Done, URL-driven filters, SEO tags, guards, mobile UX, WCAG         |
| Infrastructure | `aws-cdk-lib/assertions`                               | `pnpm --dir infra test` · CI      | No public bucket/DB, WAF attached, ALB locked to CloudFront, scheduler, alarms, budget, least-privilege IAM                                  |
| Static         | ESLint (strict TS, no `any`), `tsc --noEmit`, Prettier | Husky pre-commit, CI              | Type safety and conventions                                                                                                                  |
| Security       | `pnpm audit --prod`, Dependabot                        | CI weekly                         | No high/critical known vulnerabilities                                                                                                       |

Test data: integration tests create their own users/listings (`tests/support/fixtures.ts`) and truncate between tests; E2E uses unique emails/titles per run, so it can be re-run against the seeded dev DB.

## 2. Requirements traceability (summary)

Full mapping is in the [SRS](../01-requirements/SRS.md) (each FR lists its tests). Coverage by area:

| Area                         | Unit                          | Integration         | E2E                        |
| ---------------------------- | ----------------------------- | ------------------- | -------------------------- |
| Listings CRUD & lifecycle    | listing-state, listing-schema | listing-service (8) | mvp-flow                   |
| Media                        | process-image, media-keys     | media-service (6)   | mvp-flow (upload)          |
| Search & maps                | privacy, geocode, rate-limit  | search (8)          | search, mvp-flow (map)     |
| Auth & accounts              | session-token, middleware     | auth-service (9)    | search (guards), all flows |
| Tours                        | tour-rules (13)               | tour-service (7)    | mvp-flow                   |
| Admin & trust                | trust                         | admin-service (8)   | mvp-flow (approve)         |
| Formatting / Nepal specifics | format (15)                   | —                   | —                          |

## 3. Test results (16 Nov 2026, local)

| Suite                                                                             | Files   | Cases | Result                      |
| --------------------------------------------------------------------------------- | ------- | ----- | --------------------------- |
| Unit                                                                              | 12      | 65    | ✅ all passed               |
| Integration (PostGIS 16 + MinIO)                                                  | 6       | 46    | ✅ all passed               |
| Infrastructure (CDK)                                                              | 1       | 13    | ✅ all passed               |
| E2E desktop Chromium                                                              | 3 specs | 11    | ✅ all passed               |
| E2E mobile (Pixel 7, `@mobile`)                                                   | 1       | 1     | ✅ passed                   |
| `pnpm audit --prod`                                                               | —       | —     | ✅ no known vulnerabilities |
| `cdk synth` (5 stacks)                                                            | —       | —     | ✅                          |
| Production Docker image build + run (migrations, health, pages, security headers) | —       | —     | ✅                          |

### Defects found by testing and fixed

| Found by          | Defect                                                            | Fix                                                          |
| ----------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| Integration       | Test files ran concurrently and truncated each other's data       | Single-fork, serial integration project                      |
| Integration       | Shadow-DB leftovers broke `migrate deploy` on the test DB         | Global setup rebuilds the `*_test` schema each run (guarded) |
| Screenshot review | "Search this area" showed on page load (programmatic `fitBounds`) | Only shown after real user interaction                       |
| Screenshot review | Duplicate "Parking" filter chip                                   | Removed amenity duplicate                                    |
| Browser run       | Tour status label wrong from the landlord's view                  | Viewer-aware labels; landlords decline instead of cancel     |
| axe-core          | Invalid `<dl>` structure on listing facts and dashboard tiles     | Restructured semantics                                       |
| Docker run        | `sslmode=require` against local non-TLS DB                        | `DB_SSLMODE` env (default `require`)                         |
| CDK tests         | ECS Exec granted `logs:*` on `*`                                  | Dedicated exec log group scopes permissions                  |

## 4. Not covered automatically (manual / post-deploy)

| Item                                                           | How to verify                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Real Cognito sign-up/sign-in, MFA                              | Post-deploy smoke checklist ([release checklist](../05-operations/release-checklist.md)) |
| Rekognition moderation verdicts                                | Upload a test image in staging; check `photo.moderation_reject` audit events             |
| SES deliverability (inbox vs spam), SNS SMS to Nepali carriers | Staging test with real addresses/numbers; required before SES/SNS production access      |
| Lambda image processing on AWS                                 | Upload in staging; photo status turns `ready`; DLQ empty                                 |
| Lighthouse on real devices / networks                          | Run Lighthouse mobile against the CloudFront URL; real Android test on NTC & Ncell 4G    |
| Screen-reader walkthrough                                      | NVDA/VoiceOver checklist in [accessibility](accessibility.md)                            |

## 5. How to run

```bash
docker compose up -d && pnpm db:migrate && pnpm storage:setup && pnpm db:seed
pnpm lint && pnpm typecheck && pnpm test     # fast gate (required before every PR)
pnpm test:integration                         # needs docker compose
pnpm test:e2e                                 # builds + starts prod server on :3100
pnpm --dir infra test                         # CDK assertions
```

## 6. Entry / exit criteria for a release

- **Entry:** feature branches merged to `develop`, CI green.
- **Exit:** all suites green; no open P1/P2 defects; `pnpm audit` clean; release checklist completed; Definition-of-Done E2E passing.
