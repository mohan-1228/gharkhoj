# CLAUDE.md — Nepal Rentals (working name: "GharKhoj")

> Read this file first in every session. It is the source of truth for scope, stack, data model, conventions, and build order. If a decision here conflicts with a request, flag it before changing course.

## 1. Project Overview

A professional rental marketplace for Nepal, modeled on apartments.com. Landlords list rentable places (rooms, studios/flats, apartments, houses, office/studio spaces) with map location, photos, floor plans, and amenities. Renters search, filter, save favorites, and schedule tours.

- **Focus markets (launch cities):** Kathmandu, Lalitpur, Bhaktapur, Pokhara, Biratnagar, Bharatpur, Birgunj, Butwal, Dharan, Hetauda
- **Currency:** NPR (Nepali Rupees), monthly rent
- **Languages:** English first; architecture must allow Nepali (नेपाली) later (i18n-ready)
- **Goal:** production-quality portfolio project deployed end-to-end on AWS

## 2. Users and Roles

| Role | Capabilities |
|---|---|
| Visitor | Browse, search, view listing details, view map |
| Renter | Everything above + favorites, saved searches, tour requests, message landlord, profile |
| Landlord / Property Manager | Create/edit/delete/pause listings, upload media, manage tour requests, mark rented, view listing analytics |
| Admin | Moderate listings, verify landlords, handle reports, manage users, manage amenity/city lookup data |

## 3. Tech Stack

### Frontend
- **Next.js (App Router) + TypeScript** — SSR/ISR for SEO on listing and city pages
- **Tailwind CSS** + **shadcn/ui** (Radix primitives) for components
- **React Hook Form + Zod** for forms and validation (shared Zod schemas with backend)
- **TanStack Query** for client data fetching/caching
- **Leaflet + react-leaflet** with **OpenStreetMap** tiles (free, better coverage in Nepal than commercial alternatives in many areas); marker clustering via `leaflet.markercluster`
- **Nominatim / Photon** (or Amazon Location Service) for geocoding and address autocomplete
- **Embla Carousel** or similar for photo galleries; **yet-another-react-lightbox** for fullscreen
- **date-fns** for dates; **react-day-picker** for tour scheduling
- **next-intl** for i18n (English now, Nepali later)
- **nuqs** (or URL search params) so all filters live in the URL (shareable, SEO-friendly)

### Backend
- **Node.js + TypeScript** via Next.js Route Handlers for v1 (keep business logic in `src/server/services/` so it can be extracted to Lambda/ECS later)
- **Prisma ORM** + **PostgreSQL 16** with **PostGIS** extension (geo-radius and bounding-box queries)
- **Zod** request/response validation
- **Pino** structured logging
- **Rate limiting** (Upstash-style or API Gateway/WAF throttles in production)

### Auth
- **Amazon Cognito** user pool (email + phone OTP; groups: `renter`, `landlord`, `admin`)
- Next.js middleware verifies JWT; role checks in service layer
- Social login (Google) optional in phase 2

### Storage and Media
- **Amazon S3** (private bucket) + **CloudFront** (public delivery) for photos and floor plans
- **Pre-signed URL uploads** direct from browser to S3
- **Image processing:** S3 event → **Lambda (sharp)** to generate thumbnails/WebP variants (320, 640, 1280 px), strip EXIF GPS, enforce size/type limits
- Floor plans: JPG/PNG/PDF (PDF rendered to preview image)

### Search
- v1: **PostgreSQL** (B-tree indexes on price/city/beds, GIN on amenities array, **GiST on geography** column, `pg_trgm` for fuzzy text, Postgres full-text search on title/description/neighborhood)
- Upgrade path (only if needed): Amazon OpenSearch

### Notifications
- **Amazon SES** — email (tour request received/confirmed/declined, new message, listing approved)
- **Amazon SNS** — SMS for OTP/tour reminders (Nepal carrier coverage must be tested)
- Optional later: Web Push

### Infrastructure and DevOps (AWS)
- **Compute:** AWS Amplify Hosting or ECS Fargate for Next.js (decide in phase 7); Lambda for image processing and scheduled jobs
- **Database:** Amazon RDS for PostgreSQL (Multi-AZ off for dev; PostGIS enabled), in private subnets
- **CDN/Edge:** CloudFront; **WAF** on the public distribution
- **DNS/TLS:** Route 53 + ACM
- **Secrets:** AWS Secrets Manager / SSM Parameter Store
- **IaC:** **AWS CDK (TypeScript)**
- **CI/CD:** GitHub Actions → build, test, `cdk deploy` (OIDC role, no long-lived keys)
- **Observability:** CloudWatch Logs/Alarms, X-Ray (optional), Sentry for frontend errors
- **Analytics:** Plausible or PostHog (privacy-friendly)
- **Cost guardrails:** AWS Budgets alarm, S3 lifecycle rules, small RDS instance (db.t4g.micro/small) in dev

### Testing and Quality
- **Vitest** (unit), **React Testing Library** (components), **Playwright** (e2e: search → view → request tour; landlord create listing)
- **ESLint + Prettier + TypeScript strict**, **Husky + lint-staged**
- **Testcontainers** or Docker Compose Postgres/PostGIS for integration tests
- **Zod-driven API contract tests**

### Local Development
- **Docker Compose:** Postgres+PostGIS, MinIO (S3 stand-in), Mailpit (email capture)
- **pnpm** workspaces if the repo is split later
- `.env.example` committed; real secrets never committed

## 4. Features

### 4.1 Listings (Landlord)
- Property types: Room, Studio/Flat, Apartment, House, Office/Studio Space
- Fields: title, description, monthly rent (NPR), security deposit, negotiable flag, available-from date, minimum lease (months), bedrooms, bathrooms, total area (sq ft; optionally ropani/aana display), floor number / total floors, furnishing (unfurnished / semi / fully), parking (bike/car counts), facing direction, year built (optional)
- Utilities info: water supply (tank/boring/municipal), electricity backup (inverter/generator), internet availability, waste collection, gas (LPG/piped)
- Address: city, municipality/ward, tole/neighborhood, street/landmark, plus **map pin** (lat/lng, draggable) with "approximate vs exact location" toggle for privacy
- Photos: multi-upload, drag-to-reorder, cover photo, captions, per-photo room label
- Floor plans: one or more images/PDFs, label per unit
- Amenities (checkbox groups, stored as lookup table):
  - **Basics:** Wi-Fi, 24h water, hot water/geyser, electricity backup, furnished, kitchen, balcony/terrace, attached bathroom
  - **Building:** elevator, parking (bike/car), CCTV, security guard, gated compound, rooftop access, laundry, generator, rainwater harvesting, solar water heating
  - **Policies:** pets allowed, smoking allowed, family only / bachelors allowed / students allowed / couples allowed, visitors policy
  - **Nearby (tags):** school, hospital, bus/micro stop, supermarket, temple, gym, park
- Listing lifecycle: `draft → pending_review → published → paused → rented → archived` (+ `rejected` with reason)
- Multi-unit buildings (apartment complex with several available units) — phase 2
- Duplicate listing and renew/boost actions; "mark as rented" removes from search
- Landlord dashboard: listings, views, favorites count, tour requests inbox

### 4.2 Search and Browse (Renter/Visitor)
- Homepage: hero search (city/neighborhood), featured listings, popular cities and neighborhoods
- Filters: city, neighborhood, property type, price range (NPR slider), bedrooms, bathrooms, furnishing, amenities, tenant type, available-from, pet-friendly, parking, area range
- Sort: newest, price low→high / high→low, most relevant, nearest (to a point)
- **List view and Map view toggle**; "search this area" on map pan/zoom; clustered pins; hover card preview
- Draw/radius search (e.g., within 2 km of a point) via PostGIS
- Pagination or infinite scroll; URL-driven filters
- SEO pages: `/rent/kathmandu`, `/rent/kathmandu/baneshwor`, `/rent/kathmandu/apartments`
- Saved searches with email alerts (phase 2)

### 4.3 Listing Detail Page
- Gallery with lightbox, floor plan viewer (zoom), key facts bar, description, amenities grid, map with neighborhood, similar listings, landlord card (verified badge, response time), share (WhatsApp/Facebook/copy link), report listing
- Sticky **Schedule a tour** / **Contact** panel
- JSON-LD structured data for SEO; Open Graph images

### 4.4 Tour Scheduling
- Renter picks preferred date + time slots (up to 3), adds message and contact phone
- Landlord sets availability windows (weekly recurring + exceptions)
- Statuses: `requested → confirmed | declined | rescheduled → completed | cancelled | no_show`
- Email (SES) and optional SMS notifications; reminders 24h and 2h before (EventBridge Scheduler → Lambda)
- Add-to-calendar (.ics download)
- Virtual tour option (video call link field) — phase 2

### 4.5 Renter Account
- Profile, favorites (heart), saved searches, tour history, message threads, recently viewed

### 4.6 Messaging (phase 2)
- In-app threaded messages between renter and landlord; email notification fallback; phone numbers revealed only after tour confirmation or landlord opt-in

### 4.7 Admin
- Moderation queue (approve/reject with reason), reports queue, landlord verification (citizenship/ownership doc upload reviewed manually), user management/ban, lookup data management (cities, neighborhoods, amenities), basic metrics dashboard

### 4.8 Trust and Safety
- Landlord verification badge, listing report flow, image moderation (**Amazon Rekognition** moderation labels on upload), phone/email verification, rate limiting, spam/duplicate detection, EXIF stripping, contact-info scrubbing in descriptions (optional)

### 4.9 Non-Functional Requirements
- Mobile-first responsive (majority of Nepali users are on mobile; test on slow 3G)
- Performance: LCP < 2.5s on mid-range Android; image lazy-loading, responsive `srcset`, WebP/AVIF
- Accessibility: WCAG 2.1 AA
- SEO: SSR/ISR, sitemap.xml, robots.txt, canonical URLs, structured data
- Security: OWASP Top 10, input validation, CSRF protection, secure headers, least-privilege IAM, encrypted at rest/in transit, PII minimization
- Privacy: privacy policy, terms, cookie notice, data deletion on request
- Observability: structured logs, error tracking, alarms on 5xx/latency

## 5. Data Model (PostgreSQL + PostGIS)

```
users            (id, cognito_sub, email, phone, full_name, role, avatar_url, is_verified, created_at)
landlord_profiles(user_id PK/FK, business_name, bio, verification_status, verification_doc_key, response_rate)
cities           (id, name, name_ne, slug, province, centroid geography(Point), is_active)
neighborhoods    (id, city_id FK, name, name_ne, slug, centroid)
listings         (id, landlord_id FK, title, slug, description, property_type, status, rejection_reason,
                  rent_npr, deposit_npr, negotiable, available_from, min_lease_months,
                  bedrooms, bathrooms, area_sqft, floor_no, total_floors, furnishing,
                  parking_bikes, parking_cars, tenant_types text[], pets_allowed, smoking_allowed,
                  city_id FK, neighborhood_id FK, ward_no, street_address, landmark,
                  location geography(Point,4326), location_is_approximate,
                  search_vector tsvector, view_count, published_at, created_at, updated_at)
listing_photos   (id, listing_id FK, s3_key, caption, room_label, sort_order, is_cover, width, height)
floor_plans      (id, listing_id FK, s3_key, label, file_type, sort_order)
amenities        (id, code, label, label_ne, category, icon)
listing_amenities(listing_id FK, amenity_id FK, PRIMARY KEY(listing_id, amenity_id))
favorites        (user_id FK, listing_id FK, created_at, PK(user_id, listing_id))
saved_searches   (id, user_id FK, name, filters jsonb, alert_frequency, last_sent_at)
tour_availability(id, listing_id FK, day_of_week, start_time, end_time) + tour_exceptions(...)
tour_requests    (id, listing_id FK, renter_id FK, requested_slots jsonb, confirmed_slot timestamptz,
                  status, renter_message, landlord_note, contact_phone, created_at, updated_at)
conversations    (id, listing_id, renter_id, landlord_id) / messages (id, conversation_id, sender_id, body, created_at)
reports          (id, listing_id, reporter_id, reason, details, status, resolved_by)
audit_log        (id, actor_id, action, entity, entity_id, metadata jsonb, created_at)
```

**Indexes:** GiST on `listings.location`; B-tree on `(status, city_id, rent_npr)`, `(status, property_type)`, `bedrooms`; GIN on `search_vector` and `tenant_types`; unique on `slug`; partial index `WHERE status='published'`.

## 6. API Surface (REST, versioned `/api/v1`)

```
GET    /listings                  search + filters + sort + pagination (+ bbox, radius)
GET    /listings/map              lightweight pins for the current viewport
GET    /listings/:slug            detail
POST   /listings                  (landlord) create draft
PATCH  /listings/:id              (owner) update
POST   /listings/:id/submit       submit for review
POST   /listings/:id/status       pause / mark rented / archive
DELETE /listings/:id              (owner/admin)
POST   /uploads/presign           get pre-signed S3 URL (type + size validated)
POST   /listings/:id/photos       register uploaded photo (order, caption)
POST   /listings/:id/floor-plans  register uploaded floor plan
GET    /cities, /neighborhoods, /amenities
POST   /favorites/:listingId  DELETE /favorites/:listingId  GET /favorites
POST   /tours                     renter requests tour
PATCH  /tours/:id                 landlord confirm/decline/reschedule; renter cancel
GET    /tours/mine, /landlord/tours
GET    /landlord/listings, /landlord/stats
POST   /reports
GET    /admin/review-queue  POST /admin/listings/:id/approve|reject  GET /admin/reports  ...
```

Standards: consistent error shape `{ error: { code, message, details } }`, Zod validation on every input, pagination `{ items, nextCursor }`, idempotency for tour creation.

## 7. Suggested Repository Layout

```
/
├─ CLAUDE.md
├─ docker-compose.yml
├─ .env.example
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts                 # cities, neighborhoods, amenities, sample listings
├─ src/
│  ├─ app/                    # Next.js App Router (routes, layouts, pages)
│  │  ├─ (public)/            # home, rent/[city], listing/[slug]
│  │  ├─ (renter)/            # favorites, tours, messages
│  │  ├─ (landlord)/          # dashboard, listings/new, listings/[id]/edit
│  │  ├─ (admin)/
│  │  └─ api/v1/...
│  ├─ components/             # ui/ (shadcn), listings/, map/, forms/
│  ├─ server/
│  │  ├─ services/            # business logic (listings, tours, search, uploads)
│  │  ├─ repositories/        # Prisma/SQL access (raw SQL for PostGIS queries)
│  │  ├─ auth/                # Cognito JWT verify, role guards
│  │  └─ lib/                 # s3, ses, logger, errors
│  ├─ schemas/                # shared Zod schemas
│  ├─ lib/                    # client utils, formatters (NPR, area units)
│  └─ messages/               # en.json, ne.json
├─ infra/                     # AWS CDK app (network, rds, s3, cloudfront, cognito, lambdas, pipeline)
├─ lambdas/
│  ├─ image-processor/        # sharp thumbnails/WebP, EXIF strip, Rekognition moderation
│  └─ tour-reminders/
├─ tests/ (unit, integration, e2e)
└─ .github/workflows/
```

## 8. Nepal-Specific Considerations

- **Addresses:** use Province → District → Municipality/Metropolitan → Ward → Tole/Chowk + landmark; many places lack street numbers, so the map pin and landmark are primary
- **Maps:** OSM data is solid in Kathmandu Valley and Pokhara, thinner elsewhere; allow manual pin placement and fall back gracefully
- **Currency formatting:** `Rs. 25,000 / month`; support lakh/crore grouping (`en-IN` style grouping) where appropriate
- **Area units:** sq ft primary; optionally show ropani-ropani-aana-paisa-daam for land/houses
- **Dates:** store Gregorian; optionally display Bikram Sambat (BS) via a converter library
- **Phone:** validate Nepali mobile formats (`+977 98XXXXXXXX` / `97XXXXXXXX`); OTP via SNS (verify deliverability) with email fallback
- **Culture/market norms:** "family only / bachelors / students" tenant preferences are common and expected as filters; water supply and electricity backup are high-priority amenities; flats often priced per month with 1–3 months deposit
- **Connectivity:** optimize for low bandwidth; compress aggressively; consider PWA/offline-friendly shell
- **Payments:** none in v1 (no rent collection). Future: featured-listing payments via eSewa/Khalti/Fonepay
- **Legal:** terms of service, listing accuracy disclaimer; no discrimination beyond landlord-stated tenant policies shown transparently

## 9. Conventions for Claude Code

- TypeScript `strict`; no `any` without a comment. Prefer named exports. Small, focused modules.
- Business logic lives in `server/services`; route handlers stay thin (parse → call service → respond).
- All DB access via repositories; PostGIS queries use parameterized raw SQL (`prisma.$queryRaw`), never string concatenation.
- Validate every external input with Zod; share schemas between client forms and API.
- Never expose S3 keys or private bucket URLs; always serve media through CloudFront.
- Money stored as integer NPR (no floats). Timestamps stored UTC; display in `Asia/Kathmandu`.
- Every new feature ships with: migration (if needed), Zod schema, service + tests, UI, and a Playwright path for critical flows.
- Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`). Small PRs, one concern each.
- Ask before: adding a new major dependency, changing the schema in a breaking way, or altering auth/IAM.
- Run before finishing any task: `pnpm lint && pnpm typecheck && pnpm test`.
- Do not commit secrets; use `.env.local` and AWS Secrets Manager.

### Common Commands (to be created in phase 0)
```
pnpm dev                 # Next.js dev server
docker compose up -d     # Postgres/PostGIS, MinIO, Mailpit
pnpm prisma migrate dev  # apply migrations
pnpm prisma db seed      # seed reference data + sample listings
pnpm test / pnpm test:e2e
pnpm cdk diff / pnpm cdk deploy
```

## 9b. Security and IAM Notes
- Least-privilege IAM roles per Lambda/service; no `*` resources
- S3 bucket: block public access, CloudFront OAC only, CORS limited to app origin, upload size/content-type conditions on pre-signed POST
- RDS in private subnets; access via app security group only; automated backups on
- WAF managed rules + rate-based rule on `/api` and auth endpoints
- Audit-log admin and moderation actions

## 10. Build Roadmap (do in order; mark each done)

- [x] **Phase 0 — Foundation:** repo, Next.js + TS + Tailwind + shadcn, ESLint/Prettier/Husky, Docker Compose (Postgres+PostGIS, MinIO, Mailpit), Prisma schema, seed data (cities, neighborhoods, amenities)
- [x] **Phase 1 — Listings CRUD:** data model, landlord create/edit/delete (stub auth with a hardcoded landlord), form with Zod validation
- [x] **Phase 2 — Media:** pre-signed uploads, photo reorder/cover, floor plans, thumbnail Lambda (local: sharp in-process)
- [x] **Phase 3 — Public search:** filters, sorting, pagination, URL-driven state, listing detail page, city/neighborhood SEO pages
- [x] **Phase 4 — Maps:** Leaflet map view, clustered pins, search-this-area, pin picker in the landlord form, radius search
- [x] **Phase 5 — Auth and roles:** Cognito, role guards, favorites, landlord dashboard, renter account
- [x] **Phase 6 — Tours:** availability, requests, statuses, SES emails, reminders, .ics
- [x] **Phase 7 — Admin and trust:** moderation queue, reports, landlord verification, Rekognition image moderation
- [x] **Phase 8 — AWS deploy:** *(infrastructure, CI/CD and image complete + tested; first `cdk deploy` awaits cost approval — see docs/05-operations/deployment-guide.md)* CDK stacks (VPC, RDS, S3, CloudFront, Cognito, Lambdas, hosting), GitHub Actions CI/CD, WAF, alarms, budgets, custom domain
- [x] **Phase 9 — Polish:** performance pass, accessibility audit, e2e tests, README with architecture diagram, cost notes, lessons learned
- [ ] **Phase 10 — Later:** messaging, saved-search alerts, multi-unit buildings, Nepali language, PWA, featured listings/payments

## 11. Definition of Done (MVP)
A landlord can sign up, create a listing with map pin, photos, floor plan, and amenities, and submit it; an admin approves it; a visitor finds it via filters on list and map views; a renter signs in, favorites it, and requests a tour; the landlord confirms and both receive email — all running on AWS with CI/CD, monitoring, and documented architecture.

## 12. Open Decisions — RESOLVED (2026-11-15, see docs/02-design/adr)
1. ~~Amplify vs ECS Fargate vs Lambda API~~ → **ECS Fargate** (ADR-0002)
2. ~~Cognito vs custom JWT~~ → **Cognito Hosted UI + app session cookie** (ADR-0003)
3. ~~OSM/Nominatim vs Amazon Location~~ → **OSM + proxied Nominatim** (ADR-0004)
4. ~~Real scraped data~~ → **synthetic demo data only** (ADR-0006)
5. ~~Name and domain~~ → **GharKhoj**, CloudFront default domain for now; custom domain later
