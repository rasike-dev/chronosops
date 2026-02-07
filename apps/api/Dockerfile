FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@10.26.0

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build contracts
RUN pnpm -C packages/contracts build

# Build API
RUN pnpm -C apps/api build

# Production stage
FROM node:20-alpine AS production

RUN npm install -g pnpm@10.26.0

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=base /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "dist/main.js"]
