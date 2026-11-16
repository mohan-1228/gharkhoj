# ADR-0010: Docker Compose dev stack (PostGIS, Chainguard MinIO, Mailpit)

**Status:** Accepted · **Date:** 2026-11-15

## Context

Upstream MinIO images are no longer published on Docker Hub/quay (pulls fail), so the local S3 stand-in needed another source.

## Decision

- `postgis/postgis:16-3.4` (DB on host port **5433**, to avoid clashing with a local Postgres), `cgr.dev/chainguard/minio` (S3 API on 9000, console on 9001), `axllent/mailpit` (SMTP 1025, UI 8025).
- Bucket, CORS and public-read on `media/` are configured by `pnpm storage:setup` (TypeScript + AWS SDK) instead of `mc`, so the same code path is exercised as in the app.
- Integration tests run against a separate `gharkhoj_test` database, rebuilt from migrations on every run (guarded to only ever drop `*_test` databases).

## Consequences

- ✅ Real Postgres/PostGIS and S3 semantics in tests (no mocks for data access).
- ⚠️ Chainguard's free tier only offers `:latest`; pin by digest if reproducibility issues appear.
