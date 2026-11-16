# syntax=docker/dockerfile:1.7
# ───────────────────────────────────────────────────────────────────────────
# GharKhoj web — production image (Next.js standalone on Node 22, Alpine).
# Built for linux/arm64 (Graviton Fargate) in CI; works on amd64 too.
# ───────────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat openssl && npm install -g pnpm@9.15.9 --no-audit --no-fund
WORKDIR /app

# 1) Dependencies (cached unless the lockfile changes)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY infra/package.json infra/package.json
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter gharkhoj

# 2) Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder values ONLY so env validation passes while Next collects page data.
# Real values are injected at runtime by ECS (env + Secrets Manager). Nothing here is secret.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    SESSION_SECRET=build-time-placeholder-not-used-at-runtime-000000 \
    INTERNAL_API_SECRET=build-time-placeholder-not-used-at-runtime-000000 \
    MEDIA_BASE_URL=https://build.invalid \
    AUTH_MODE=cognito \
    COGNITO_USER_POOL_ID=build \
    COGNITO_CLIENT_ID=build \
    COGNITO_DOMAIN=https://build.invalid
ARG APP_VERSION=dev
RUN pnpm prisma generate && pnpm build

# 3) Runtime
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini \
 && npm install -g prisma@6.19.3 --omit=dev --no-audit --no-fund \
 && addgroup -S app -g 1001 && adduser -S app -u 1001 -G app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder --chown=app:app /app/prisma/migrations ./prisma/migrations
COPY --chown=app:app docker/entrypoint.sh ./entrypoint.sh

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--", "./entrypoint.sh"]
CMD ["node", "server.js"]
