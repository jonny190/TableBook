#!/bin/sh
set -e
# Pin Prisma CLI to the same minor as @prisma/client in node_modules.
# Without the pin npx fetches the latest (currently v7), which dropped the
# `url = env(...)` schema syntax that v5 used.
PRISMA_CLI="prisma@^5.22"
echo "[tablebook] running prisma migrate deploy ($PRISMA_CLI)..."
npx --yes $PRISMA_CLI migrate deploy --schema=/app/prisma/schema.prisma || {
  echo "[tablebook] migrate deploy failed — attempting db push as fallback"
  npx --yes $PRISMA_CLI db push --schema=/app/prisma/schema.prisma --accept-data-loss
}
if [ -f /app/prisma/seed.js ]; then
  echo "[tablebook] seeding (idempotent)..."
  node /app/prisma/seed.js || echo "[tablebook] seed failed (non-fatal — login may not work until you create a user)"
fi
exec "$@"
