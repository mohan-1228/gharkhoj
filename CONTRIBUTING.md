# Contributing to GharKhoj

Read [`CLAUDE.md`](CLAUDE.md) first: it is the source of truth for scope, stack and conventions. Setup: [docs/03-development/local-setup.md](docs/03-development/local-setup.md).

## Branching model (Git Flow)

```
main        ─●───────────────●────────────  production; every commit is deployable; tagged releases (v1.0.0)
              \             /
release/x.y    \      ●────●                 stabilisation, version bump, changelog
                \    /
develop     ─────●──●──●──●──●──●──────────  integration branch (CI must stay green)
                  \  /  \  /
feature/*          ●     ●                   one concern per branch, merged with --no-ff
hotfix/*    (from main → main + develop)
docs/*      documentation-only changes
```

| Branch  | From      | Merges into                    | Naming                                                     |
| ------- | --------- | ------------------------------ | ---------------------------------------------------------- |
| Feature | `develop` | `develop`                      | `feature/<short-topic>` e.g. `feature/saved-search-alerts` |
| Docs    | `develop` | `develop`                      | `docs/<topic>`                                             |
| Release | `develop` | `main` and back into `develop` | `release/1.1.0`                                            |
| Hotfix  | `main`    | `main` and `develop`           | `hotfix/<issue>`                                           |

Merges use `--no-ff` so each feature remains visible as a unit in history. In GitHub, protect `main` and `develop`: require PR reviews + passing CI, and disallow force-pushes.

## Commits — Conventional Commits (enforced by a Husky hook)

```
<type>(<scope>): <summary in imperative mood>

<body: what and why, wrapped at ~100 chars>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`, `style`, `revert`.
Examples: `feat(tours): add .ics export` · `fix(search): escape LIKE wildcards in keyword filter`.

The pre-commit hook runs ESLint + Prettier on staged files (lint-staged); the commit-msg hook validates the format.

## Pull requests

1. Keep PRs small, with one concern each. Fill in the [PR template](.github/pull_request_template.md).
2. Run `pnpm lint && pnpm typecheck && pnpm test` (and `pnpm test:integration` when DB/storage code changed).
3. Every new feature ships with: migration (if needed), Zod schema, service + tests, UI, and a Playwright path for critical flows.
4. CI must be green; at least one approving review (CODEOWNERS).
5. Squash or merge-commit per the reviewer's preference; feature branches merge into `develop` with `--no-ff`.

## Coding standards

- **TypeScript strict**, no `any` (lint error) unless a comment explains why. Prefer named exports and small modules.
- **Layering:** route handler (parse with Zod → call service → respond) → service (business rules, authorization) → repository/Prisma. Services take `actor: SessionUser | null` and never read cookies or requests.
- **Validation:** every external input goes through a Zod schema in `src/schemas/`, shared with the client form.
- **SQL:** Prisma for CRUD; PostGIS/full-text via `$queryRaw` tagged templates only. Never concatenate strings into SQL.
- **Errors:** throw `AppError` (`src/server/lib/errors.ts`); the HTTP layer maps it to `{ error: { code, message, details } }`.
- **Money** as integer NPR; **time** stored UTC, displayed in Asia/Kathmandu (`src/lib/time.ts`, `formatKathmandu`).
- **Media** is served only from `media/` via CloudFront; never expose S3 keys of originals or private documents.
- **Accessibility:** labels for every control, `aria-*` for toggles/live regions, keyboard alternatives to drag.
- **Ask before** adding a major dependency, making a breaking schema change, or changing auth/IAM.

## Definition of Done for a change

- [ ] Tests at the right level, all green locally and in CI
- [ ] Docs updated (API reference, user guide, ADR if a decision changed)
- [ ] No secrets; `.env.example` updated for new variables
- [ ] Accessible and mobile-friendly (check at 400 px wide)

## Releasing

See [docs/05-operations/release-checklist.md](docs/05-operations/release-checklist.md).

```bash
git checkout develop && git checkout -b release/1.1.0
# bump version in package.json, update CHANGELOG.md
git checkout main && git merge --no-ff release/1.1.0 && git tag -a v1.1.0 -m "v1.1.0"
git checkout develop && git merge --no-ff release/1.1.0
git push origin main develop --tags     # main → CI → Deploy
```
