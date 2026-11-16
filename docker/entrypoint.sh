#!/bin/sh
# Container entrypoint: assemble DATABASE_URL from the RDS secret fields injected by
# ECS (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD), apply migrations, start the server.
set -eu

if [ -z "${DATABASE_URL:-}" ] && [ -n "${DB_HOST:-}" ]; then
  DATABASE_URL="$(node -e '
    const e = process.env, enc = encodeURIComponent;
    process.stdout.write(`postgresql://${enc(e.DB_USER)}:${enc(e.DB_PASSWORD)}@${e.DB_HOST}:${e.DB_PORT || 5432}/${e.DB_NAME || "gharkhoj"}?schema=public&sslmode=${e.DB_SSLMODE || "require"}&connection_limit=${e.DB_POOL_SIZE || 10}`);
  ')"
  export DATABASE_URL
fi

# Prisma takes a Postgres advisory lock, so concurrent tasks starting together are safe.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo '{"msg":"applying database migrations"}'
  prisma migrate deploy --schema ./prisma/schema.prisma
fi

exec "$@"
