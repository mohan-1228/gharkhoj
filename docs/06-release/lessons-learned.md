# Lessons Learned (v1.0 retrospective)

## What went well

- **Deciding open questions up front** (hosting, auth, geocoding, data, name) avoided rework: every later phase built on a stable foundation.
- **Pure domain modules** (`listing-state`, `tour-rules`, `lib/time`) made the trickiest rules (lifecycle, UTC+05:45 slot maths) cheap to test exhaustively.
- **Integration tests against real PostGIS + MinIO** caught issues mocks would have hidden (e.g. amenity fixtures, migration drift).
- **Infrastructure assertions as tests** caught a real least-privilege gap (ECS Exec granting `logs:*` on `*`) before anything was deployed.
- **Looking at screenshots** found UX bugs tests didn't: "Search this area" showing on load, a duplicate filter chip, wrong tour labels for landlords.
- **axe-core in E2E** found invalid definition-list markup that is invisible to sighted testing.

## What was harder than expected

| Surprise                                                                            | Resolution                                                                              | Takeaway                                                                |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Upstream MinIO images no longer published                                           | Chainguard MinIO + bucket setup in TypeScript                                           | Keep local infra swappable; script setup with the same SDK the app uses |
| The scaffolded Next/React versions had a critical RCE (CVE-2025-55182)              | Upgraded to patched 15.5.29 / 19.1.10 on day one                                        | Always audit fresh scaffolds                                            |
| Tailwind 4.3 broke `next/font` on Node 20                                           | Pinned 4.1.x                                                                            | Pin minors for build tooling; let Dependabot propose upgrades behind CI |
| Prisma can't model generated columns, partial indexes or `geography`                | Hand-reviewed SQL migrations + `Unsupported` fields + raw SQL repositories              | Treat generated migrations as drafts, not truth                         |
| `next build` evaluates server modules → env validation + DB access at build time    | Dynamic rendering for DB-backed pages; placeholder build env; dev-auth production guard | Design the build to need no live dependencies                           |
| CloudFront ↔ S3 CORS dependency cycle                                               | Custom resource applies CORS after both exist                                           | Draw dependency graphs before writing IaC                               |
| A loose E2E selector (`/^$/` matching unnamed images) made the test race the upload | Exact accessible-name assertions                                                        | Prefer role + exact name selectors                                      |
| A chained shell command kept going after a failed commit hook                       | Added `scripts/ship-phase.sh` with `set -e`                                             | Automate the release choreography; never chain git steps unchecked      |

## Do differently next time

- Add a staging AWS environment in CDK from the start (`envName=staging`) and deploy every `develop` merge there.
- Write the E2E Definition-of-Done test in Phase 1 as a skeleton, then extend it each phase.
- Move all UI strings into `next-intl` messages as they are written, not later.
