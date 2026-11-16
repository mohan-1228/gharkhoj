## What & why

<!-- One concern per PR. Link the issue/ticket. -->

## How it was tested

- [ ] `pnpm lint && pnpm typecheck && pnpm test`
- [ ] `pnpm test:integration` (if DB/storage touched)
- [ ] Playwright path added/updated for critical flows
- [ ] Manually verified on mobile width (≤ 400px)

## Checklist (CLAUDE.md §9)

- [ ] Zod schema validates every new input; shared with the form where applicable
- [ ] Business logic in `src/server/services`, route handler stays thin
- [ ] Migration reviewed (no destructive change without a plan)
- [ ] No secrets committed; new env vars added to `.env.example` and docs
- [ ] Docs updated (API reference / user guide / ADR) if behaviour changed

## Screenshots
