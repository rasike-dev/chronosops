import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Load .env from the root of the monorepo (same logic as prisma.config.ts)
// When running from dist/, cwd is apps/api/, so:
// - rootEnv: ../../.env = chronosops/.env
// - localEnv: .env = apps/api/.env
function loadEnv() {
  const cwd = process.cwd();
  const rootEnv = resolve(cwd, '../../.env');  // Root .env (chronosops/.env)
  const localEnv = resolve(cwd, '.env');      // Local apps/api/.env

  // Prefer root .env, fallback to local if root doesn't exist
  let envPath: string;
  if (existsSync(rootEnv)) {
    envPath = rootEnv;
  } else if (existsSync(localEnv)) {
    envPath = localEnv;
  } else {
    envPath = rootEnv; // Default to root even if it doesn't exist
  }

  // Load the .env file
  config({ path: envPath });
  
  return { envPath, databaseUrl: process.env.DATABASE_URL };
}

// Load environment variables before PrismaClient is instantiated
const { envPath, databaseUrl } = loadEnv();

if (!databaseUrl) {
  console.error(`[PrismaService] ERROR: DATABASE_URL is not set.`);
  console.error(`[PrismaService] Tried loading from: ${envPath}`);
  console.error(`[PrismaService] Please ensure DATABASE_URL is defined in your .env file.`);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma 7 requires adapter for prisma-client generator
    // We've loaded DATABASE_URL above, but verify it's available
    if (!databaseUrl) {
      throw new Error(
        `DATABASE_URL is not set. Please ensure it's defined in your .env file.\n` +
        `Tried loading from: ${envPath}`
      );
    }
    
    // Ensure DATABASE_URL is set in process.env
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = databaseUrl;
    }
    
    // Create Prisma adapter with connectionString (Prisma 7 way)
    // PrismaPg accepts either a Pool instance or PoolConfig with connectionString
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    
    // Initialize PrismaClient with adapter (Prisma 7 way)
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
