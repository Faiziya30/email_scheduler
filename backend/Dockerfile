# Multi-stage production Dockerfile for Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies including devDependencies for build
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Compile TypeScript
RUN npm run build

# ── Production Runner Stage ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# Copy compiled JavaScript output
COPY --from=builder /app/dist ./dist

EXPOSE 5000

# Push Prisma schema migrations and run server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/server.js"]
