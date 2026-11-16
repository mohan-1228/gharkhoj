# ADR-0009: One CloudFront distribution; media served from the same origin

**Status:** Accepted · **Date:** 2026-11-15

## Decision

A single distribution routes `/media/*` to the private S3 bucket (Origin Access Control) and everything else to the ALB. `MEDIA_BASE_URL` equals `APP_URL` in production.

## Rationale

- CSP stays simple (`img-src 'self'`) and doesn't need the CloudFront domain at build time.
- One TLS certificate and domain, fewer DNS lookups on mobile.
- An explicit bucket policy **denies CloudFront everything outside `media/`**, so originals (`uploads/`) and verification documents (`private/`) can never be fetched publicly, even with a crafted path.

## Consequences

- ⚠️ The S3 bucket CORS must reference the distribution domain, which would create a CloudFormation cycle; this is solved with a small custom resource (`putBucketCors`) applied after both exist.
