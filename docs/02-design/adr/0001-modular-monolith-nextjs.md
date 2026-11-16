# ADR-0001: Modular monolith on Next.js (App Router)

**Status:** Accepted · **Date:** 2026-11-15

## Context

We need SEO-friendly server-rendered pages (listing and city pages) plus a REST API, built by a very small team, deployable to AWS, with room to scale later.

## Options

1. **Next.js full-stack (pages + Route Handlers)**: one codebase, one deployable, shared TypeScript types/Zod schemas.
2. Next.js frontend + separate Node API (Express/Nest) on Lambda: clearer split, but two deployables, duplicated auth and CORS.
3. SPA + API: weak SEO for listing pages.

## Decision

Option 1, with a strict layering rule: `route handler → service → repository`. Services live in `src/server/services/`, take the acting user as a parameter and never touch HTTP objects, so they can be moved into Lambdas or a separate service later without rewriting them.

## Consequences

- ✅ Fast iteration; Zod schemas shared between forms and the API; one Docker image.
- ✅ The SSR pages call services directly (no internal HTTP hop).
- ⚠️ Web and API scale together; acceptable at MVP traffic. Split later if the API's load profile diverges.
