# ADR-0006: Synthetic demo data only; reference data shipped as a migration

**Status:** Accepted · **Date:** 2026-11-15 · Resolves CLAUDE.md §12.4

## Decision

- No scraped real listings (legal, privacy and accuracy reasons). `prisma/seed` generates deterministic synthetic listings with generated placeholder photos, for development and demos only.
- Production-necessary **reference data** (10 launch cities, ~40 neighbourhoods with Nepali names and centroids, 28 amenities) ships as the idempotent SQL migration `20261116000000_reference_data`, so production never runs the seed script.

## Consequences

- ✅ Every environment has identical reference data automatically.
- ⚠️ Launch needs real landlords onboarded (go-to-market task, not engineering).
