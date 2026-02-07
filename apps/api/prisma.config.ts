import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { defineConfig, env } from 'prisma/config'

// Load .env from the root of the monorepo (same logic as PrismaService)
// When running from apps/api/, cwd is apps/api/, so:
// - rootEnv: ../../.env = chronosops/.env
// - localEnv: .env = apps/api/.env
const cwd = process.cwd()
const rootEnv = resolve(cwd, '../../.env')  // Root .env (chronosops/.env)
const localEnv = resolve(cwd, '.env')        // Local apps/api/.env

// Prefer root .env, fallback to local if root doesn't exist
let envPath: string
if (existsSync(rootEnv)) {
  envPath = rootEnv
} else if (existsSync(localEnv)) {
  envPath = localEnv
} else {
  envPath = rootEnv // Default to root even if it doesn't exist
}

// Load the .env file
config({ path: envPath })

// For prisma generate, DATABASE_URL is not required (only needed for migrations/connections)
// Use a dummy URL if not set
const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/chronosops'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
})