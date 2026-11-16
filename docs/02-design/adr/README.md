# Architecture Decision Records

Each ADR records one significant decision: its context, the options considered, the decision itself and its consequences. ADRs are immutable once accepted; to change a decision, write a new ADR that supersedes the old one.

| #                                                     | Decision                                                               | Status   |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| [0001](0001-modular-monolith-nextjs.md)               | Modular monolith on Next.js (App Router)                               | Accepted |
| [0002](0002-ecs-fargate-hosting.md)                   | Host on ECS Fargate behind CloudFront                                  | Accepted |
| [0003](0003-cognito-with-app-sessions.md)             | Amazon Cognito Hosted UI + app-issued session cookie                   | Accepted |
| [0004](0004-openstreetmap-nominatim.md)               | OpenStreetMap tiles + Nominatim (proxied) for maps & geocoding         | Accepted |
| [0005](0005-postgres-postgis-search.md)               | PostgreSQL + PostGIS for data _and_ search; raw SQL for geo            | Accepted |
| [0006](0006-synthetic-seed-data.md)                   | Synthetic demo data only; reference data as a migration                | Accepted |
| [0007](0007-image-pipeline.md)                        | Pre-generated WebP variants (sharp) instead of on-the-fly optimisation | Accepted |
| [0008](0008-i18n-next-intl.md)                        | next-intl, English first, Nepali-ready                                 | Accepted |
| [0009](0009-single-distribution-same-origin-media.md) | One CloudFront distribution; media on the same origin                  | Accepted |
| [0010](0010-local-dev-stack.md)                       | Docker Compose with Chainguard MinIO + Mailpit for local parity        | Accepted |
| [0011](0011-dependency-security-policy.md)            | Dependency pinning & security patch policy                             | Accepted |
