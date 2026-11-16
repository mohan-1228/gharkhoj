# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/).

## [1.0.0] — 2026-11-16

First production-ready release (MVP per CLAUDE.md §11).

### Added

- **Foundation:** Next.js 15 + TypeScript strict, Tailwind/shadcn, Prisma schema for the full data model (PostGIS geography, generated tsvector, partial and trigram indexes), Docker Compose dev stack, seed data for 10 launch cities.
- **Listings:** landlord CRUD with lifecycle state machine, duplicate, re-moderation of edited live listings, owner-only access.
- **Media:** presigned direct-to-S3 uploads, sharp pipeline (EXIF/GPS stripped, WebP 320/640/1280), Rekognition moderation, reorder/cover/captions, PDF floor plans, image-processor Lambda.
- **Search:** filters, sorts, pagination, full-text + fuzzy keyword search, bbox/radius geo search, URL state, SEO city/neighbourhood/type pages, sitemap, robots, JSON-LD, approximate-location privacy offset.
- **Maps:** Leaflet map view with clustered price pins, search-this-area, radius/near-me, landlord pin picker with Nominatim landmark search (proxied, cached, throttled).
- **Auth:** Cognito Hosted UI (code + PKCE), app session cookie, DB-authoritative roles, CSRF protection, page guards, dev sign-in for local use, admin bootstrap allow-list.
- **Accounts:** favourites, saved searches, recently viewed, profile, become landlord, account deletion; landlord dashboard.
- **Tours:** availability windows and blocked dates, slot generation in Nepal time, idempotent requests, confirm/decline/reschedule/cancel/complete/no-show, emails, 24h/2h reminders via EventBridge Scheduler, .ics export, progressive disclosure of contact details.
- **Admin & trust:** moderation queue with scam/duplicate flags, reports + takedowns, landlord verification with private documents, user bans/roles, lookup management, metrics, audit log.
- **Infrastructure:** AWS CDK stacks (CI/OIDC, WAF, network, RDS, app), production Dockerfile, GitHub Actions CI/CD, alarms, dashboard, budget, infrastructure tests.
- **Quality:** 136 automated tests (unit, integration, E2E incl. axe accessibility, CDK assertions); privacy, terms and help pages; cookie notice.
- **Docs:** PRD, SRS, architecture, data model, API reference, security/threat model, 11 ADRs, test plan/report, performance and accessibility reports, deployment guide, runbook, cost estimate, release checklist, user guide, stakeholder technical overview.

### Security

- Upgraded Next.js to 15.5.29 / React to 19.1.10 (CVE-2025-55182); overrides for vulnerable transitive packages; `pnpm audit` clean.
