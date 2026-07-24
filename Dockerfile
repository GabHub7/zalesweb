# Zales — multi-stage Dockerfile tuned for small free-tier containers
# (256MB RAM class, e.g. Back4app Containers free tier).
# Uses Next.js "standalone" output so the runtime image only ships the
# files actually needed to run the server, not the full node_modules tree.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL isn't needed at build time (no static DB calls during build),
# but Next.js still evaluates env access, so provide a harmless placeholder.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Standalone build already contains a minimal node_modules + server.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 8080
CMD ["node", "server.js"]
