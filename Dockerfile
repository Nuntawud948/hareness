# ── Stage 1: Build Frontend (React + Vite) ──
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build Backend (TypeScript + Fastify) ──
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend

COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci

COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production Runner ──
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install OpenSSL for Prisma engine on Alpine
RUN apk add --no-cache openssl ca-certificates

# Copy backend production dependencies & built code
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=backend-builder /app/backend/node_modules/.prisma ./node_modules/.prisma

# Copy compiled frontend static assets for Fastify to serve
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 8080

CMD ["node", "dist/presentation/server.js"]
