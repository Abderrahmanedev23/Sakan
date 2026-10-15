#!/bin/sh
# Applies pending migrations, optionally loads the demo data into an empty database, then starts the API.
set -e

echo "Applying database migrations..."
attempt=1
until node_modules/.bin/prisma migrate deploy; do
  if [ "$attempt" -ge 20 ]; then
    echo "Database still unreachable after $attempt attempts, giving up." >&2
    exit 1
  fi
  echo "Database not ready yet, retrying in 3s ($attempt/20)..."
  attempt=$((attempt + 1))
  sleep 3
done

if [ "$SEED_DEMO_DATA" = "true" ]; then
  # The seed refuses NODE_ENV=production and does nothing when the database already has users.
  echo "Loading demo data (skipped if the database already has data)..."
  NODE_ENV=development node dist/scripts/seed.js
fi

exec "$@"
