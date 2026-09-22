# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps: install exactly what package-lock.json pins, nothing more
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder: full node_modules (deps + devDeps via npm ci above), generate the
# Prisma client, then `next build`.
#
# `next build` imports the NextAuth config (src/lib/auth.ts), which throws if
# AUTH_SECRET is unset, and src/lib/stripe.ts constructs `new Stripe(...)` at
# module scope unconditionally (unlike Resend/Anthropic, which are guarded
# behind an `if (process.env.X)` check) — so STRIPE_SECRET_KEY is needed too.
# All build-time env vars here are dummy values only; nothing at build time
# actually talks to a real database or Stripe. Real values are injected at
# runtime via a k8s Secret and are never baked into the image.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ARG AUTH_SECRET="build-time-placeholder-secret-do-not-use-in-runtime"
ARG SITE_URL="http://localhost:3000"
ARG STRIPE_SECRET_KEY="sk_test_build_time_placeholder"
ENV DATABASE_URL=$DATABASE_URL \
    AUTH_SECRET=$AUTH_SECRET \
    SITE_URL=$SITE_URL \
    STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY \
    NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# runner: minimal runtime image. Non-root user. Only the standalone bundle,
# static assets, and the Prisma *client* output — deliberately excludes the
# `prisma` CLI package to keep this image lean. That means this image cannot
# run `prisma migrate deploy` itself; the `migrate` build target (this same
# Dockerfile, --target=builder) is used for that instead, since it still has
# the full `prisma` CLI in node_modules.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
