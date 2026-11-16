# Software Requirements Specification (SRS) — GharKhoj v1.0

This document lists the testable requirements, with an ID for each, and traces them to code and tests. Product context is in the [PRD](PRD.md).

**Conventions:** _shall_ = mandatory. "Svc" = service module in `src/server/services/`. Test references point to files under `tests/` (U = unit, I = integration, E = end-to-end, C = CDK infrastructure test).

## 1. System overview

GharKhoj is a full-stack Next.js 15 web application (server-rendered pages + REST API under `/api/v1`) backed by PostgreSQL 16 + PostGIS, object storage (S3), identity (Amazon Cognito), email (SES) and two AWS Lambda functions. See [architecture](../02-design/architecture.md).

## 2. Functional requirements

### 2.1 Listings

| ID    | Requirement                                                                                                                               | Implementation                                      | Tests                               |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------- |
| FR-L1 | The system shall let a landlord/admin create a listing draft with the fields in CLAUDE.md §4.1                                            | `listing-service.createDraft`, `schemas/listing.ts` | U listing-schema, I listing-service |
| FR-L2 | Money shall be stored as integer NPR; coordinates restricted to Nepal's bounding box                                                      | Zod schema; DB `CHECK` constraints                  | U listing-schema                    |
| FR-L3 | A neighbourhood shall belong to the listing's city                                                                                        | `assertNeighborhoodInCity`                          | I listing-service                   |
| FR-L4 | Only the owner or an admin may update/delete a listing                                                                                    | `assertOwnerOrAdmin`                                | I listing-service                   |
| FR-L5 | Lifecycle transitions shall follow the state machine (draft → pending_review → published → paused/rented → archived; rejected → resubmit) | `listing-state.ts`                                  | U listing-state                     |
| FR-L6 | Editing the title/description of a published listing shall send it back to review                                                         | `REVIEW_SENSITIVE_FIELDS`                           | I listing-service                   |
| FR-L7 | Submission shall require ≥ 1 ready photo and a map location                                                                               | `assertSubmittable`                                 | I media-service, E mvp-flow         |
| FR-L8 | Landlords shall be able to duplicate a listing (no photos)                                                                                | `duplicateListing`                                  | I listing-service                   |
| FR-L9 | Listing creation shall be rate-limited per landlord (20/hour)                                                                             | `rateLimit`                                         | —                                   |

### 2.2 Media

| ID    | Requirement                                                                                             | Implementation                          | Tests                         |
| ----- | ------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------- |
| FR-M1 | Uploads shall go directly from browser to S3 using presigned POST with type and size conditions         | `media-service.createPresignedUpload`   | I media-service               |
| FR-M2 | Upload keys shall be derived server-side and scoped to the listing/user                                 | `uploadPrefix`                          | U media-keys, I media-service |
| FR-M3 | The server shall re-verify existence, size, type and prefix before registering media                    | `verifyUploadedObject`                  | I media-service               |
| FR-M4 | Images shall be auto-rotated, stripped of all metadata (incl. GPS) and converted to WebP 320/640/1280   | `process-image.ts` (shared with Lambda) | U process-image               |
| FR-M5 | Images shall be moderated with Rekognition when enabled; rejected images never published                | `moderation.ts`                         | — (needs AWS)                 |
| FR-M6 | PDF floor plans shall be validated by magic bytes                                                       | `registerFloorPlan`                     | I media-service               |
| FR-M7 | Photos shall support reorder, cover selection, captions and room labels (max 25)                        | `updatePhotos`                          | I media-service               |
| FR-M8 | Public media shall be served only via CloudFront from `media/`; originals and private docs never public | Bucket policy + OAC                     | C stacks                      |

### 2.3 Search & discovery

| ID     | Requirement                                                                                                                                                       | Implementation                                                           | Tests                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------- |
| FR-S1  | Search shall return only published listings                                                                                                                       | `search-repository`                                                      | I search                          |
| FR-S2  | Filters: city, neighbourhood, type, price range, min beds/baths, furnishing, ALL selected amenities, tenant type overlap, pets, parking, move-in date, area range | `whereClauses`                                                           | I search                          |
| FR-S3  | Sorts: newest, price asc/desc, relevance (`ts_rank`), nearest                                                                                                     | `orderBy`                                                                | I search                          |
| FR-S4  | Geo: bounding box and radius (PostGIS `&&`, `ST_DWithin`)                                                                                                         | `search-repository`                                                      | I search                          |
| FR-S5  | Keyword search over title/landmark/description (full text) + neighbourhood/city names                                                                             | `search_vector` + ILIKE                                                  | I search                          |
| FR-S6  | Pagination shall return `{ items, total, page, pages, nextCursor }`                                                                                               | `search-service`                                                         | I search                          |
| FR-S7  | Filter state shall live in the URL                                                                                                                                | `nuqs` parsers                                                           | E search                          |
| FR-S8  | Approximate locations shall be offset deterministically by 50–450 m before leaving the server                                                                     | `privacy.publicCoordinates`                                              | U privacy                         |
| FR-S9  | SEO routes `/rent/[city]` and `/rent/[city]/[neighbourhood                                                                                                        | type]` with canonical URLs; sitemap.xml, robots.txt; JSON-LD on listings | `app/(public)/rent`, `sitemap.ts` | E search |
| FR-S10 | Geocoding shall be Nepal-only, cached 24 h and throttled to ≤ 1 req/s                                                                                             | `geocode-service`                                                        | U geocode                         |

### 2.4 Identity & accounts

| ID     | Requirement                                                                                            | Implementation                           | Tests                  |
| ------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------- |
| FR-A1  | Sign-in via Cognito Hosted UI, Authorization Code + PKCE, state and nonce validated, ID token verified | `auth/cognito.ts`, `auth/callback` route | — (needs Cognito)      |
| FR-A2  | Sessions shall be httpOnly, SameSite=Lax, signed (HS256), 7-day expiry                                 | `session-token.ts`                       | U session-token        |
| FR-A3  | Authorization shall use the role stored in the database; banned users are treated as signed out        | `getCurrentUser`                         | I auth-service         |
| FR-A4  | Existing accounts shall be linked to Cognito identities only for verified emails                       | `upsertFromCognito`                      | I auth-service         |
| FR-A5  | Sign-up roles limited to renter/landlord; admin only by admin or the bootstrap allow-list              | `auth-service`, `BOOTSTRAP_ADMIN_EMAILS` | I auth-service         |
| FR-A6  | `returnTo` redirects shall be same-site only                                                           | `safeReturnTo`                           | U session-token        |
| FR-A7  | State-changing API calls shall be same-origin (CSRF)                                                   | `middleware.ts`                          | U middleware           |
| FR-A8  | Protected pages shall redirect signed-out users to `/login?returnTo=`                                  | `middleware.ts`                          | U middleware, E search |
| FR-A9  | Users shall be able to update their profile (Nepali mobile validation) and delete their account        | `auth-service`                           | I auth-service         |
| FR-A10 | Dev sign-in shall be impossible in production unless explicitly allowed                                | `env.ts` guard                           | (build guard)          |

### 2.5 Favourites, saved searches, recently viewed

| ID    | Requirement                                                         | Tests                      |
| ----- | ------------------------------------------------------------------- | -------------------------- |
| FR-F1 | Signed-in users can favourite published listings (idempotent)       | I auth-service (favorites) |
| FR-F2 | Users can save up to 20 searches with an alert-frequency preference | —                          |
| FR-F3 | Recently viewed listings are kept on-device only (localStorage)     | —                          |

### 2.6 Tours

| ID     | Requirement                                                                                                          | Implementation                        | Tests                        |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------- |
| FR-T1  | Landlords define weekly windows + blocked dates; default 09:00–18:00 daily                                           | `setAvailability`, `DEFAULT_WINDOWS`  | I tour-service               |
| FR-T2  | Bookable 30-min slots for 14 days, ≥ 2 h lead time, excluding confirmed slots, computed in Asia/Kathmandu (UTC+5:45) | `generateSlots`, `lib/time.ts`        | U tour-rules                 |
| FR-T3  | Renters request 1–3 slots with a valid Nepali mobile and optional message                                            | `createTourSchema`, `requestTour`     | I tour-service               |
| FR-T4  | Requests shall be idempotent per `Idempotency-Key`                                                                   | unique `(renter_id, idempotency_key)` | I tour-service               |
| FR-T5  | One open request per renter per listing; no self-tours                                                               | `requestTour`                         | I tour-service               |
| FR-T6  | Status transitions and per-party permissions per CLAUDE.md §4.4                                                      | `tourTransition`                      | U tour-rules                 |
| FR-T7  | A slot cannot be confirmed twice for the same listing                                                                | `updateTour` clash check              | I tour-service               |
| FR-T8  | Emails: request → landlord; confirm → both; decline/reschedule → renter; cancel → other party                        | `notify`                              | I tour-service, E mvp-flow   |
| FR-T9  | Reminders 24 h and 2 h before, each sent once, via scheduler                                                         | `sendDueReminders`                    | I tour-service, C stacks     |
| FR-T10 | `.ics` export for confirmed tours, only for participants                                                             | `tourIcs`, `buildIcs`                 | U tour-rules, I tour-service |
| FR-T11 | Landlord phone + exact address revealed to renter only after confirmation                                            | `toTourDto`                           | I tour-service               |

### 2.7 Trust, safety & administration

| ID    | Requirement                                                                                            | Tests                       |
| ----- | ------------------------------------------------------------------------------------------------------ | --------------------------- |
| FR-X1 | Moderation queue (FIFO) with approve / reject-with-reason; emails to landlord                          | I admin-service, E mvp-flow |
| FR-X2 | Flag phone numbers, emails, links and off-platform payment cues in listing text                        | U trust, I admin-service    |
| FR-X3 | Flag possible duplicates (same title by same landlord, or within 30 m at ±10 % rent)                   | I admin-service             |
| FR-X4 | Anyone can report a published listing; admins resolve, dismiss or take down                            | I admin-service             |
| FR-X5 | Landlord verification documents stored privately; admins view via 5-min signed URL; views audited      | I admin-service             |
| FR-X6 | Admins can ban/unban (banned landlord's live listings paused) and change roles; cannot ban self/admins | I admin-service             |
| FR-X7 | Lookup data management for cities, neighbourhoods, amenities                                           | —                           |
| FR-X8 | All admin, moderation and account actions audit-logged                                                 | I admin-service             |

## 3. Non-functional requirements

| ID     | Category        | Requirement                                                                                            | How it is met / verified                                                                                         |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| NFR-1  | Performance     | LCP < 2.5 s on mid-range Android                                                                       | Measured 0.3 s (4G) / 0.8 s (Fast 3G) on a local prod build — [performance report](../04-testing/performance.md) |
| NFR-2  | Performance     | API p95 < 500 ms at launch load                                                                        | Indexed queries (partial, GiST, GIN); alarm at p95 > 2 s                                                         |
| NFR-3  | Accessibility   | WCAG 2.1 AA                                                                                            | axe-core in E2E (0 serious/critical), manual checklist — [a11y report](../04-testing/accessibility.md)           |
| NFR-4  | Security        | OWASP Top 10 controls                                                                                  | [Security & threat model](../02-design/security.md)                                                              |
| NFR-5  | Security        | Least-privilege IAM; no wildcard resources except APIs without resource-level permissions              | C stacks (automated check)                                                                                       |
| NFR-6  | Privacy         | PII minimisation, deletion on request, essential cookies only                                          | Privacy policy, `deleteAccount`, cookie notice                                                                   |
| NFR-7  | Availability    | Survive single task failure; automatic rollback of bad deploys                                         | ECS ≥1 task + autoscaling, circuit breaker, ALB health checks                                                    |
| NFR-8  | Durability      | Daily DB backups (7 days), point-in-time recovery                                                      | RDS automated backups                                                                                            |
| NFR-9  | Observability   | Structured JSON logs with request ids; alarms on 5xx, latency, unhealthy tasks, DB, Lambda errors, DLQ | Pino, CloudWatch alarms                                                                                          |
| NFR-10 | SEO             | SSR, sitemap, canonical, JSON-LD, OG tags                                                              | E search                                                                                                         |
| NFR-11 | i18n            | All UI strings addable to `src/messages/ne.json`; Nepali names stored                                  | next-intl, `name_ne` columns                                                                                     |
| NFR-12 | Cost            | Monthly budget alarm; dev-tier sizing                                                                  | AWS Budgets, [cost estimate](../05-operations/cost-estimate.md)                                                  |
| NFR-13 | Maintainability | TypeScript strict, lint/format/commit hooks, CI gates                                                  | ESLint, Prettier, Husky, GitHub Actions                                                                          |

## 4. External interfaces

- **REST API:** `/api/v1/*` — see [API reference](../02-design/api-reference.md). Errors use the envelope `{ error: { code, message, details } }`.
- **Amazon Cognito Hosted UI:** OAuth 2.0/OIDC endpoints `/oauth2/authorize`, `/oauth2/token`, `/logout`.
- **OpenStreetMap:** raster tiles (browser) and Nominatim search (server-side proxy).
- **Amazon S3** presigned POST (browser) and SDK (server/Lambda); **SES** send email; **SNS** SMS (feature-flagged); **Rekognition** DetectModerationLabels.

## 5. Constraints & assumptions

- Launch region `ap-south-1` (Mumbai), the closest AWS region to Nepal.
- Synthetic demo data only; no scraped listings (CLAUDE.md §12.4).
- No payments in v1.
- SES and SNS start in sandbox mode — production access must be requested before launch (see the [runbook](../05-operations/runbook.md)).
