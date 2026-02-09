#!/bin/bash
# Seed scenarios into the database
# Usage: ./scripts/seed-scenarios.sh

set -e

echo "🌱 Seeding scenarios..."

# Check if tsx is installed
if ! command -v tsx &> /dev/null; then
  echo "Installing tsx..."
  pnpm add -D tsx
fi

# Run the seed script
pnpm tsx prisma/seed-scenarios.ts

echo "✅ Scenario seeding complete!"
