FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@10.26.0

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build contracts
RUN pnpm -C packages/contracts build

# Build web
WORKDIR /app/apps/web
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

RUN npm install -g pnpm@10.26.0

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/web/package.json ./apps/web/

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=base /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=base /app/apps/web/.next ./apps/web/.next
COPY --from=base /app/apps/web/public ./apps/web/public
COPY --from=base /app/apps/web/package.json ./apps/web/

WORKDIR /app/apps/web

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["pnpm", "start"]
