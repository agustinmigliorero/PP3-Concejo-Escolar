# ── Etapa 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
RUN npm run build

# ── Etapa 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Solo las dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev

# Artefactos del build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

EXPOSE 3001
CMD ["npx", "next", "start", "-p", "3001", "-H", "0.0.0.0"]
