#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -U ${POSTGRES_USER:-chronosops} -d ${POSTGRES_DB:-chronosops} > /dev/null 2>&1; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is ready!"

echo "Running Prisma migrations..."
cd /app/apps/api
pnpm prisma migrate deploy || pnpm prisma migrate dev --name init

echo "Generating Prisma client..."
pnpm prisma generate

echo "Starting API server..."
exec pnpm start:dev
