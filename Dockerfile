# Multi-stage Dockerfile for Switchboard Image Overlay Service
# Sharp + Pango text rendering + custom fonts

FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat fontconfig fribidi

# --- Install ALL dependencies (devDeps needed for next build) ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Production runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy fonts (critical for image processing + text overlays)
COPY --from=builder --chown=nextjs:nodejs /app/fonts ./fonts

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
