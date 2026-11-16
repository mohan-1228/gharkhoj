# ADR-0007: Pre-generated WebP variants instead of on-the-fly image optimisation

**Status:** Accepted · **Date:** 2026-11-15

## Context

Most users are on mobile data. Photos must be small, stripped of GPS metadata and moderated. Next.js `next/image` optimises on request, which costs CPU on the web tier and caches per container.

## Decision

- On upload, a single pipeline (`src/server/media/process-image.ts`, `sharp`) auto-rotates, **strips all metadata incl. EXIF GPS**, guards against decompression bombs and writes **WebP at 320/640/1280 px**.
- It runs **in-process locally** and in the **image-processor Lambda** on AWS (S3 event → Lambda → Rekognition moderation → callback). Same code in both places.
- Pages use plain `<img>` with `srcset`/`sizes` and lazy loading; `next/image` optimisation is disabled (`images.unoptimized`), and so is the `no-img-element` lint rule.

## Consequences

- ✅ Zero image CPU on the web tier; immutable, CDN-cached assets.
- ✅ Privacy: GPS never published.
- ⚠️ AVIF not generated yet (WebP has universal support; AVIF can be added as another variant).
- ⚠️ PDF floor plans are stored and linked, not rasterised to a preview (future).
