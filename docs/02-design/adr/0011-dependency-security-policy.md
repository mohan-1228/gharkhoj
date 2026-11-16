# ADR-0011: Dependency pinning and security patch policy

**Status:** Accepted · **Date:** 2026-11-15

## Decisions taken during the build

| Item             | Decision                                                                                              | Why                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Next.js / React  | `next@15.5.29`, `react@19.1.10`                                                                       | Patched for the December 2025 React Server Components RCE (CVE-2025-55182) affecting the scaffold's 15.5.4 / 19.1.0 |
| Transitive vulns | pnpm `overrides` for `postcss`, `sharp`, `deepmerge-ts`; upgraded `nodemailer` to v10 and `zod` to v4 | `pnpm audit --prod` clean                                                                                           |
| Tailwind         | pinned to `~4.1.x`                                                                                    | 4.3 pulls in an ESM-only `magic-string` that breaks the Next.js webpack font loader on Node 20                      |
| `cn` package     | Not adopted; kept `clsx` + `tailwind-merge` locally                                                   | shadcn CLI suggested a brand-new pre-1.0 package with a `bin`; avoided supply-chain risk                            |
| Node             | 22 LTS in Docker/CI (`.nvmrc`)                                                                        | The AWS SDK v3 drops Node 20 in 2027                                                                                |
| pnpm in Docker   | installed with npm instead of corepack                                                                | corepack signature-key rotation errors                                                                              |

## Policy

- `pnpm audit --prod --audit-level high` must pass in CI.
- Dependabot opens weekly grouped PRs; merge after CI is green.
- Ask before adding a new major dependency (CLAUDE.md §9).
