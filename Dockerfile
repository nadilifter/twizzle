FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

# Cache the pnpm store across builds so unchanged packages aren't re-downloaded
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Install Prisma CLI once in deps so the runner can copy it instead of re-downloading
RUN npm install -g prisma@6

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate

ARG NEXT_PUBLIC_ADYEN_CLIENT_KEY
ARG NEXT_PUBLIC_ADYEN_ENVIRONMENT
ENV NEXT_PUBLIC_ADYEN_CLIENT_KEY=$NEXT_PUBLIC_ADYEN_CLIENT_KEY
ENV NEXT_PUBLIC_ADYEN_ENVIRONMENT=$NEXT_PUBLIC_ADYEN_ENVIRONMENT
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1

# Cache .next/cache across builds for incremental compilation
RUN --mount=type=cache,id=nextjs-cache,target=/app/.next/cache \
    pnpm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Copy Prisma CLI from deps instead of re-installing (~16s saved)
COPY --from=deps /usr/local/lib/node_modules/prisma /usr/local/lib/node_modules/prisma
COPY --from=deps /usr/local/bin/prisma /usr/local/bin/prisma

RUN mkdir .next && chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
