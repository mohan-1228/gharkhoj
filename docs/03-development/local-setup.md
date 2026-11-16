# Local Development Setup

## Requirements

- macOS / Linux / WSL2
- **Node.js 22** (`nvm use`; Node 20.19+ also works) and **pnpm 9** (`npm i -g pnpm@9`)
- **Docker Desktop**
- (optional) `psql` for poking at the database

## First run (≈ 5 minutes)

```bash
git clone <repo> gharkhoj && cd gharkhoj
cp .env.example .env.local                 # then set SESSION_SECRET and INTERNAL_API_SECRET:
#   openssl rand -base64 48   /   openssl rand -hex 32
ln -s .env.local .env                      # Prisma CLI reads .env
pnpm setup                                 # install → docker compose up → migrate → bucket → seed
pnpm dev                                   # http://localhost:3000
```

`pnpm setup` runs: `pnpm install && docker compose up -d && pnpm db:migrate && pnpm storage:setup && pnpm db:seed`.

## Local services

| Service              | URL                                                       | Credentials                                                 |
| -------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| App                  | http://localhost:3000                                     | Sign in at `/login`; pick a demo account (dev mode)         |
| PostgreSQL + PostGIS | `localhost:5433`                                          | `gharkhoj` / `gharkhoj`, DBs `gharkhoj` and `gharkhoj_test` |
| MinIO (S3)           | API http://localhost:9000 · Console http://localhost:9001 | `minioadmin` / `minioadmin`                                 |
| Mailpit (emails)     | http://localhost:8025                                     | — every email the app sends lands here                      |
| Prisma Studio        | `pnpm db:studio`                                          | —                                                           |

### Demo accounts (seeded, dev sign-in only)

| Account                                      | Role                              |
| -------------------------------------------- | --------------------------------- |
| Admin User · admin@gharkhoj.local            | admin                             |
| Sita Shrestha · sita.landlord@gharkhoj.local | landlord (verified, ~35 listings) |
| Ram Gurung · ram.landlord@gharkhoj.local     | landlord (unverified)             |
| Anisha Karki · anisha.renter@gharkhoj.local  | renter                            |

You can also type any email at `/login` to create a new renter or landlord.

## Everyday commands

```bash
pnpm dev                     # Next.js dev server
pnpm lint && pnpm typecheck && pnpm test     # required before every PR (CLAUDE.md §9)
pnpm test:integration        # services against real PostGIS + MinIO
pnpm test:e2e                # Playwright against a production build on :3100
pnpm db:migrate:new --name add_something    # create a migration (review the SQL!)
pnpm db:migrate              # apply migrations
pnpm db:seed                 # re-seed demo data (replaces demo listings)
pnpm --dir infra test        # infrastructure assertions
pnpm --dir infra cdk synth   # render CloudFormation (no deploy)
docker compose down          # stop services (add -v to wipe data)
```

## Environment variables

All variables are documented in [`.env.example`](../../.env.example) and validated at startup by `src/server/lib/env.ts`; the app refuses to boot with a clear message if something is missing. Important switches:

| Variable           | Local                                  | Production         |
| ------------------ | -------------------------------------- | ------------------ |
| `AUTH_MODE`        | `dev`                                  | `cognito`          |
| `IMAGE_PROCESSING` | `inline` (sharp in the web process)    | `lambda`           |
| `MODERATION`       | `off`                                  | `rekognition`      |
| `MAIL_TRANSPORT`   | `smtp` (Mailpit)                       | `ses`              |
| `MEDIA_BASE_URL`   | `http://localhost:9000/gharkhoj-media` | the CloudFront URL |

## Troubleshooting

| Symptom                                      | Fix                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `Invalid environment configuration` on start | Copy `.env.example` → `.env.local` and fill in the secrets                          |
| Images don't show                            | `pnpm storage:setup` (bucket + public-read on `media/`), and check MinIO is running |
| Port 5433 in use                             | Change the host port in `docker-compose.yml` and in `DATABASE_URL`                  |
| `prisma migrate dev` wants to reset the DB   | Use `pnpm db:migrate:new` + `pnpm db:migrate` (we review SQL by hand; see ADR-0005) |
| Emails not arriving                          | Open Mailpit at :8025; `MAIL_TRANSPORT=smtp`                                        |
| `next build` fails with dev auth             | Production builds refuse `AUTH_MODE=dev` unless `ALLOW_DEV_AUTH=true` (E2E only)    |
