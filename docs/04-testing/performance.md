# Performance Report

**Target (CLAUDE.md §4.9):** LCP < 2.5 s on a mid-range Android phone; test on slow networks.

## Method

- Production build (`next build && next start`) on localhost, seeded data.
- Playwright Chromium emulating a **Pixel 7** with **4× CPU slowdown** (mid-range Android), using CDP network throttling.
- Metrics via `PerformanceObserver` (LCP, CLS) and the paint timing API (FCP); transfer = encoded bytes.

## Results (16 Nov 2026)

| Page                     | Network                    | LCP        | FCP    | CLS   | Transfer |
| ------------------------ | -------------------------- | ---------- | ------ | ----- | -------- |
| Home `/`                 | 4G (9 Mbps, 85 ms)         | **0.32 s** | 0.32 s | 0.000 | 359 KB   |
| Search `/rent/kathmandu` | 4G                         | **0.32 s** | 0.32 s | 0.000 | 384 KB   |
| Listing detail           | 4G                         | **0.32 s** | 0.32 s | 0.000 | 615 KB   |
| Home `/`                 | Fast 3G (1.6 Mbps, 150 ms) | **0.82 s** | 0.82 s | 0.000 | 359 KB   |
| Search                   | Fast 3G                    | **0.80 s** | 0.80 s | 0.000 | 383 KB   |
| Listing detail           | Fast 3G                    | **0.80 s** | 0.80 s | 0.000 | 615 KB   |

✅ All well under the 2.5 s LCP target with zero layout shift.

> **Caveat:** localhost has no real network distance to the server. Re-measure with Lighthouse (mobile) against the CloudFront URL after deployment. Mumbai → Kathmandu adds roughly 30–60 ms RTT.

## What makes it fast

| Technique                                                                                                                                 | Where                    |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Server-side rendering; LCP element is text, not an image                                                                                  | All public pages         |
| Pre-generated WebP 320/640/1280 with `srcset`/`sizes`; lazy loading below the fold; `fetchpriority=high` for the first card/gallery image | `ListingCard`, `Gallery` |
| Maps are client-only, loaded on demand (`next/dynamic`) with skeletons                                                                    | `components/map/*`       |
| Fonts self-hosted by `next/font` with `display: swap`                                                                                     | `app/layout.tsx`         |
| Fixed aspect-ratio boxes for images/maps → CLS 0                                                                                          | cards, gallery, maps     |
| Indexed SQL: partial index on published listings, GiST on location, GIN on tsvector/tenant types                                          | migration `init`         |
| CDN: immutable `/_next/static/*` and `/media/*`; public search API `s-maxage=60`                                                          | CloudFront behaviours    |
| Low-bandwidth friendly: native form controls; no heavy UI kits; one query per search page                                                 | —                        |

## Budgets to keep

| Budget                                   | Current                                     |
| ---------------------------------------- | ------------------------------------------- |
| JS + CSS + HTML for a public page (gzip) | ≈ 360–390 KB total transfer incl. framework |
| Listing page incl. 1280 px hero          | ≈ 615 KB                                    |
| API p95                                  | Alarm at 2 s (target < 500 ms)              |

## Next optimisations (if needed)

1. Add AVIF variants (≈ 20–30% smaller than WebP).
2. Let CloudFront cache public HTML for 30–60 s (`Cache-Control` on public pages; already user-independent).
3. Code-split the lightbox (only loads on tap).
4. Self-host map tiles / use a tile CDN closer to Nepal.
