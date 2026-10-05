# IDistinguishR

A two-sided marketplace connecting students with instrument teachers in the UK — search, book a time slot, pay, and manage lessons. Teachers set their own rates and availability and get paid out directly through Stripe Connect; the platform takes a cut automatically on every booking.

**Live**: [idistinguishr.com](https://idistinguishr.com) — self-hosted on a Kubernetes cluster I provisioned and run myself.

This started as a planning exercise (`docs/idistinguishr-*.md` — market research, data model, Stripe research, build order) and has since grown into a working application with its own production infrastructure, built and operated end-to-end by one person as an ongoing side project.

## What's actually running

- **Real marketplace payments** — Stripe Connect (Express accounts, destination charges with an application fee), not a toy checkout. Teachers onboard through Stripe's hosted flow; booking status only ever changes from a signature-verified webhook, never client-side.
- **Self-hosted Kubernetes** — k3s on a provisioned Oracle Cloud VM, not a PaaS. Traefik ingress, cert-manager issuing real Let's Encrypt certificates, a GitHub Actions pipeline that builds multi-arch Docker images, runs database migrations as a Kubernetes Job, and rolls out the Deployment on every push to `main`.
- **Distributed tracing** — OpenTelemetry auto-instrumentation plus manual spans on the two flows that actually matter (the booking soft-hold transaction and the Stripe webhook handler), exported to a self-hosted Jaeger instance running in the same cluster.
- **AI-assisted content moderation** — new teacher profiles get a first-pass automated review (Claude Haiku, structured output) right after Stripe onboarding completes, triaging obvious approvals from everything else so a human only has to look at the ones that need judgment. Fails closed: any error in the AI call defers to manual review rather than silently approving.
- **A real double-booking problem, solved properly** — booking a slot opens a short-lived "soft hold" inside a database transaction, with expired holds released automatically; see `prisma/schema.prisma` and the data model doc for the reasoning.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) · React 19 · TypeScript |
| Database | PostgreSQL (Neon) · Prisma ORM |
| Auth | Auth.js v5 (credentials; Google OAuth scaffolded, not fully wired — see `src/lib/auth.ts`) |
| Payments | Stripe Connect (Express, Accounts v2) |
| Email | Resend |
| AI | Anthropic API (Claude Haiku) for automated teacher-profile vetting |
| Tracing | OpenTelemetry → self-hosted Jaeger |
| Hosting | k3s (Kubernetes) on Oracle Cloud · Traefik · cert-manager |
| CI/CD | GitHub Actions → GHCR → `kubectl apply` |

See `docs/idistinguishr-stack-decision.md` for the original reasoning, and `docs/idistinguishr-k8s-migration-log.md` for the full, warts-and-all log of moving off Vercel onto self-hosted infrastructure — every bug found and fixed along the way, in the order it actually happened.

## How it's deployed

```
push to main
  → GitHub Actions builds linux/amd64+arm64 images (multi-stage Dockerfile:
    a lean runtime image with no Prisma CLI, and a separate :migrate image
    that keeps it for running migrations)
  → pushes to GHCR
  → runs prisma migrate deploy as a one-off Kubernetes Job
  → applies the full k8s/deployment.yaml (not just a tag bump, so manifest
    changes roll out automatically too)
```

The cluster itself: two app replicas behind a Traefik Ingress, TLS from cert-manager/Let's Encrypt, a self-hosted Jaeger (Badger storage, no Elasticsearch needed at this scale) receiving traces over OTLP. See `docs/k8s-deploy.md` for the full apply order and `docs/tracing.md` for what's instrumented and why.

## Project docs

| Doc | Covers |
|---|---|
| `docs/idistinguishr-k8s-migration-log.md` | Full running log of the Vercel → Kubernetes migration and everything since — the most honest account of the engineering work |
| `docs/idistinguishr-build-log.md` | Build log from the original application development phase |
| `docs/k8s-deploy.md` | Cluster setup, manifest apply order, cutover steps |
| `docs/tracing.md` | What's traced, why Jaeger/Badger over a heavier stack, how to view it |
| `docs/idistinguishr-data-model.md` | Schema rationale — what `prisma/schema.prisma` implements, including the double-booking/soft-hold design |
| `docs/idistinguishr-stripe-connect-research.md` | Payments/payout flow research |
| `docs/idistinguishr-stack-decision.md` | Why this stack |
| `docs/idistinguishr-db-hosting-decision.md` | Why Neon for Postgres |
| `docs/idistinguishr-user-stories.md` | Acceptance criteria per feature, US-01 to US-33 |
| `docs/booking-flow-spec.md` | Field-by-field spec for every screen |

## Local development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Database** — a free Postgres instance ([neon.tech](https://neon.tech) works well with Prisma):
   ```bash
   cp .env.example .env
   # fill in DATABASE_URL
   npx prisma migrate dev
   npm run db:seed   # seeds demo teachers/students — see prisma/seed.ts
   ```

3. **Auth** — generate a secret:
   ```bash
   npx auth secret
   ```

4. **Stripe** — create a [Stripe account](https://dashboard.stripe.com/register), enable Connect, add your **test-mode** keys to `.env`. Use `npm run stripe:listen` to forward webhooks to your local server.

5. **Run**
   ```bash
   npm run dev
   ```

Seeded demo accounts (synthetic test data, password committed in plaintext intentionally — see `prisma/seed.ts`) let you log in as a student or a teacher without creating your own account.

### Running it like production, locally

The same multi-stage `Dockerfile` used in CI builds locally too:

```bash
docker build -t idistinguishr .
docker build -t idistinguishr:migrate --target=builder .
```

## Structure

```
src/
  app/
    page.tsx, results/, teachers/[id]/, book/[teacherId]/   Browse & book
    checkout/, confirmation/[bookingId]/                     Payment & confirmation
    auth/, dashboard/                                        Student auth & dashboard
    teacher/profile/, teacher/availability/, teacher/dashboard/   Teacher-side
    admin/                                                    Manual teacher approval (US-30)
    api/
      bookings/, checkout/session/, teachers/, teacher/profile/
      stripe/connect/                                         Stripe Connect onboarding
      webhooks/stripe/                                         Signature-verified webhook handler
      admin/teachers/[id]/                                     Approve/reject
      health/                                                  Liveness + readiness probes
  lib/
    auth.ts            Auth.js config
    stripe.ts           Stripe client + fee calculation
    prisma.ts           Prisma client singleton
    teacher-search.ts   Search/filter query logic
    vet-teacher-profile.ts   AI first-pass review (Claude Haiku)
    admin.ts            Email-allowlist admin check
    tracer.ts            OpenTelemetry tracer
    email.ts             Resend transactional emails
  instrumentation.ts     OpenTelemetry bootstrap (Next's hook)
prisma/
  schema.prisma          Full data model
  seed.ts                 Demo teachers/students/bookings
k8s/                      Kubernetes manifests (namespace, deployment, ingress, Jaeger, etc.)
.github/workflows/deploy.yml   CI/CD pipeline
Dockerfile                Multi-stage: deps → builder → lean runtime (separate :migrate target)
```
