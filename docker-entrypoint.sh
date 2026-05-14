#!/bin/sh
set -e
echo "[tablebook] running prisma migrate deploy..."
npx --yes prisma migrate deploy --schema=/app/prisma/schema.prisma || {
  echo "[tablebook] migrate deploy failed — attempting db push as fallback"
  npx --yes prisma db push --schema=/app/prisma/schema.prisma --accept-data-loss
}
if [ -f /app/prisma/seed.js ]; then
  echo "[tablebook] seeding (idempotent)..."
  node /app/prisma/seed.js || echo "[tablebook] seed failed (non-fatal — login may not work until you create a user)"
fi
exec "$@"
