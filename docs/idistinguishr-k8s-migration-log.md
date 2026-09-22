# Kubernetes migration log

Running log of the Vercel → Kubernetes migration, then OpenTelemetry/Jaeger tracing, per the brief in
`idistinguishr-k8s-brief.md`. Updated after every step so progress and decisions are traceable.

Sequencing: Part 1–4 (containerize, manifests, CI/CD, cutover) must be fully verified stable before
Part 5 (Jaeger + OTel) starts. Vercel deployment (`https://idistinguishr.vercel.app`) stays untouched
throughout.

## 2026-09-22

- Environment setup: Git for Windows was not installed on this machine; installed via
  `winget install --id Git.Git -e --source winget` (user confirmed).
- Cloned `https://github.com/Distinguish101/idistinguishr.git` (branch `main`) to
  `C:\Users\P4Fus\OneDrive\Desktop\idistinguishr`.
- Checked for a prior containerization attempt (per brief instructions) — found none. No `Dockerfile`,
  `.dockerignore`, `k8s/`, or `src/app/api/health/route.ts` in the repo. `next.config.js` does not yet
  set `output: "standalone"`. Starting Part 1 from scratch.
- Confirmed `.env.example` env var list matches the brief's Part 2 secret key list exactly: `DATABASE_URL`,
  `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `ANTHROPIC_API_KEY`, `SITE_URL`.
- Toolchain gaps found and closed (user confirmed each install):
  - Node.js was missing → installed Node LTS (v24.19.0) via `winget install --id OpenJS.NodeJS.LTS`.
  - Docker was missing → installed Docker Desktop via `winget install --id Docker.DockerDesktop`.
  - Docker Desktop needs WSL2, which wasn't installed → enabled the `Microsoft-Windows-Subsystem-Linux`
    and `VirtualMachinePlatform` Windows optional features (required admin elevation; confirmed both
    now show `State: Enabled`).
  - **Outstanding, needs the user**: a Windows restart is required to finish the WSL2/Docker setup. Until
    that happens, `docker build` verification (required by the brief before moving past Part 1) can't run.
    Proceeding with writing the Dockerfile, health route, and `next.config.js` changes now; will verify
    the actual `docker build` after the restart.

### Part 1: containerize the app

- `next.config.js`: added `output: "standalone"`.
- Added `src/app/api/health/route.ts`: `GET /api/health` (liveness, always 200) and
  `GET /api/health?ready=1` (readiness, runs `prisma.$queryRaw\`SELECT 1\``, 503 on failure).
- Added multi-stage `Dockerfile` (deps/builder/runner) and `.dockerignore` per the brief's spec.
- **Found a gotcha beyond what the brief flagged**: `src/lib/stripe.ts:7` does
  `new Stripe(process.env.STRIPE_SECRET_KEY!)` unconditionally at module scope (unlike
  `src/lib/email.ts` and `src/lib/vet-teacher-profile.ts`, which guard Resend/Anthropic construction
  behind `if (process.env.X)`). This throws during `next build`'s page-data-collection step exactly
  like the known `AUTH_SECRET` issue, for the same reason (`/api/checkout/session` imports it at module
  load). Added `STRIPE_SECRET_KEY` as a fourth build-time dummy `ARG` in the Dockerfile alongside
  `DATABASE_URL`, `AUTH_SECRET`, `SITE_URL` — same reasoning: dummy value only, real one injected at
  runtime via the k8s Secret, never baked into the image.
- Verified locally (Node/npm were also missing — installed Node LTS v24.19.0 first, user confirmed):
  - `npm ci` — required approving pending install scripts for `@prisma/client`, `@prisma/engines`,
    `esbuild`, `prisma`, `sharp`, `unrs-resolver` via `npm approve-scripts` (npm's script-allowlist
    security gate blocked them by default), then `npm rebuild` to actually run them.
  - `npx prisma generate` — succeeded, no binary-fetch network issues in this environment.
  - `npm run build` (with the four dummy env vars set) — **succeeded**: compiled, typechecked clean,
    generated all 26 static/dynamic routes including `/api/health`, and `.next/standalone/server.js`
    was produced as expected. No TypeScript errors, so no `prisma generate`-cascade `any`-type issue
    in `src/app/admin/page.tsx` (the brief's warned-about failure mode) — not applicable here.
- **Not yet done**: `docker build` itself (blocked on the pending restart for WSL2/Docker Desktop — see
  above). Will run it, plus a container smoke test against a real `DATABASE_URL`, once Docker is up.

### Part 2: Kubernetes manifests

- Added `k8s/namespace.yaml`, `k8s/secret.example.yaml` (template, real values never committed — added
  `k8s/secret.yaml` to `.gitignore` so the workflow described in the template file is actually true),
  `k8s/migration-job.yaml`, `k8s/deployment.yaml`, `k8s/service.yaml`, `k8s/ingress.yaml`, `k8s/hpa.yaml`.
- Used `ghcr.io/distinguish101/idistinguishr` as the placeholder registry path throughout, matching the
  GHCR choice in Part 3 — every manifest and the deploy doc note to swap this if a different registry
  is used.
- `ingress.yaml` assumes ingress-nginx + cert-manager with a `ClusterIssuer` named `letsencrypt-prod`
  (placeholder — adjust once the real cluster's ingress controller is known); documented the Stripe
  webhook raw-body-must-not-be-rewritten concern directly in the manifest's comments.
- Wrote `docs/k8s-deploy.md`: prerequisites, build/push both images, apply order, verification-before-DNS
  steps, cutover steps (DNS, Stripe webhook URL + signing secret, Google OAuth callback), and the
  per-release update sequence.

### Part 3: CI/CD

- Added `.github/workflows/deploy.yml`: on push to `main`, builds+pushes both images to GHCR using the
  built-in `GITHUB_TOKEN`, re-runs the migration Job, then rolls the Deployment via `kubectl set image`.
  Tags each release with the short git SHA (never `latest` for the rollout target, though `latest` is
  also pushed for convenience).
- **Caught a real bug before it shipped**: `github.repository` preserves the repo's actual case
  (`Distinguish101/idistinguishr`), but Docker/GHCR image refs must be lowercase — pushing
  `ghcr.io/Distinguish101/idistinguishr:...` would be rejected. Added a step that lowercases it
  (`${GITHUB_REPOSITORY,,}`) and threads that through as a job output instead of using
  `github.repository` directly. The `k8s/` manifests were already written lowercase
  (`ghcr.io/distinguish101/idistinguishr`), so they line up with what CI actually pushes.
- **Outstanding, needs the user**: the workflow requires a `KUBE_CONFIG` repository secret (kubeconfig
  or cloud-specific auth, base64-encoded) for a service account scoped to the `idistinguishr` namespace.
  This can't be set up until a cluster exists (Part 4) — the workflow will fail at the "Configure
  kubeconfig" step until then. Flagging clearly rather than working around it.
