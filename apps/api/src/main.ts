import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";
import { loadAuthConfig } from "./config/auth.config";

// Load .env before anything else (especially before PrismaClient is imported)
const cwd = process.cwd();
const rootEnv = resolve(cwd, "../../.env");  // Root .env (chronosops/.env)
const localEnv = resolve(cwd, ".env");      // Local apps/api/.env

let envPath: string;
if (existsSync(rootEnv)) {
  envPath = rootEnv;
} else if (existsSync(localEnv)) {
  envPath = localEnv;
} else {
  envPath = rootEnv;
}

config({ path: envPath });

if (!process.env.DATABASE_URL) {
  console.error(`[main.ts] ERROR: DATABASE_URL is not set after loading .env from: ${envPath}`);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  
  // Load and log auth config (temporary verification)
  const auth = loadAuthConfig();
  // eslint-disable-next-line no-console
  console.log('[Auth Config]', { required: auth.required, issuerUrl: auth.issuerUrl, audience: auth.audience, jwksUri: auth.jwksUri });
  
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`ChronosOps API listening on http://localhost:${port}`);
}
bootstrap();
