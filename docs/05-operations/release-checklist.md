# Release Checklist

## Before merging `release/*` → `main`

- [ ] All CI jobs green (quality, integration + E2E, infra, docker)
- [ ] `pnpm audit --prod` clean; Dependabot PRs triaged
- [ ] Migrations reviewed: additive/backward-compatible with the currently running version (old tasks keep serving during a rolling deploy)
- [ ] New env vars added to `.env.example`, `infra/lib/app-stack.ts` and the docs
- [ ] `CHANGELOG.md` updated; version bumped in `package.json`
- [ ] `pnpm cdk diff` reviewed — no unexpected replacements (especially RDS, Cognito user pool, S3 bucket)
- [ ] Manual accessibility checklist done ([accessibility.md](../04-testing/accessibility.md))

## Deploy

- [ ] Merge to `main` → `Deploy` workflow → approve the `production` environment
- [ ] Smoke test step passed (health reports the new commit SHA)

## Post-deploy smoke test (≈ 10 minutes)

- [ ] Home, `/rent/kathmandu`, a listing page load over HTTPS; images load from `/media/…`
- [ ] Map view shows pins; "Search this area" works after panning
- [ ] Sign up a fresh test account via Cognito (email code arrives) → sign out → sign in
- [ ] Landlord: create a listing, upload a photo → photo becomes _ready_ within ~10 s (Lambda) → submit
- [ ] Admin: approve it → landlord gets the "Your listing is live" email
- [ ] Renter: favourite + request a tour → landlord email; landlord confirms → both get emails; `.ics` downloads
- [ ] Report a listing → appears in Admin → Reports
- [ ] CloudWatch: no new 5xx; DLQ empty; alarms in OK state
- [ ] Lighthouse (mobile) on Home and a listing: LCP < 2.5 s, Accessibility ≥ 95

## If anything fails

Roll back (see [runbook](runbook.md#roll-back-the-web-app)), open an incident note, fix forward on a `hotfix/*` branch.
