# Release notes — GharKhoj v1.0.0 (16 Nov 2026)

## For users

GharKhoj is ready. Renters can search rentals in 10 cities by price, rooms, utilities and tenant type, explore on a map, save favourites and book visits online with email confirmations and reminders. Landlords can list properties with photos, floor plans and a map pin (with an optional privacy-preserving approximate location), set visiting hours and manage requests from a dashboard. Every listing is reviewed by our team, suspicious listings can be reported, and landlords can earn a Verified badge.

## For the team

- All MVP acceptance criteria (CLAUDE.md §11) are covered by the automated end-to-end test `tests/e2e/mvp-flow.spec.ts`.
- 136 automated tests passing; `pnpm audit --prod` clean; production image built and smoke-tested.
- Infrastructure synthesised and tested; **not yet deployed**. Follow the [deployment guide](../05-operations/deployment-guide.md) (requires approving ≈ $125–130/month).

## Known limitations

- SMS notifications are off until SNS production access and Nepali carrier testing are done.
- SES starts in sandbox: request production access before public launch.
- PDF floor plans are linked, not previewed as images.
- English UI only (Nepali planned); saved-search _email alerts_ are stored but not sent yet.
- No custom domain yet: CloudFront → ALB uses HTTP inside AWS until a domain + ACM certificate are added.

## Upgrade / migration notes

Fresh install. Migrations: `20261115000000_init`, `20261116000000_reference_data`.
