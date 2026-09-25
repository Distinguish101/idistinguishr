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

- Committed Parts 1-3 locally (`312005a`, branch `main`) after reverting a stray `allowScripts` block
  that `npm approve-scripts` had written into `package.json` — that's a local machine-specific npm
  security-gate artifact, not a real project change, so it was excluded from the commit. **Not pushed
  to `origin/main` yet** — pushing to the shared repo needs explicit go-ahead first.

### Part 4: cluster, cutover, and human-only steps — status

Per the brief, flagging these clearly rather than attempting to work around them:

- **Cluster provisioning**: not done. No cluster exists yet (EKS/GKE/DOKS or reuse an existing one —
  real billing implications, needs a decision).
- **DNS**: not done — no domain/A-record exists yet, and none should until the k8s deployment is
  verified. Vercel's existing domain/DNS has not been touched.
- **Docker Desktop / WSL2 setup on this machine**: enabled the required Windows features
  (`Microsoft-Windows-Subsystem-Linux`, `VirtualMachinePlatform`) but **a restart is still needed**
  before `docker build` can be verified locally.
- **Stripe webhook URL + Google OAuth callback updates**: not done — correctly deferred until after
  cutover, per the brief.
- Vercel deployment (`https://idistinguishr.vercel.app`) has not been touched, changed, or disconnected.

## 2026-09-23 (continued after restart)

- User restarted the machine to finish the WSL2/Docker Desktop setup. Docker's backend took ~30s to
  finish initializing after Docker Desktop launched (normal first-run behavior) before `docker info`
  succeeded — engine confirmed: Docker 29.8.0, `linux/x86_64` (WSL2 backend).
- Ran the actual `docker build .` (runtime image) verification the brief required: **succeeded**.
  Compiled, typechecked, and generated all 26 routes inside the container, same as the local `npm run
  build` run. Docker's linter flagged `SecretsUsedInArgOrEnv` for the `AUTH_SECRET`/`STRIPE_SECRET_KEY`
  build ARGs — expected and fine, since these are dummy placeholder values only (documented in the
  Dockerfile comments), never real secrets baked into the image.
- `docker build --target=builder` (the `:migrate` image): **succeeded**, fully reused the cached
  `deps`/`builder` layers from the runtime build (76.5s, almost entirely spent on export/unpack, not
  rebuilding).
- Verified the lean-runtime / full-CLI split actually works as designed:
  - Runtime image: `node_modules/.bin/prisma` **absent** (confirmed) — 495MB.
  - Migrate image: `npx prisma --version` **works**, full CLI present (confirmed) — 1.45GB (expected,
    since it retains all devDependencies).
- Ran the runtime image as a real container (placeholder secrets — no real `DATABASE_URL` was ever
  typed into this chat, per the brief's explicit instruction) and hit both health endpoints:
  - `GET /api/health` → `200 {"status":"ok"}` instantly, regardless of DB state (liveness, as designed).
  - `GET /api/health?ready=1` against a deliberately unreachable DB host → `503` with a clear Prisma
    connection error in the JSON body, not a crash (readiness, as designed).
  - Container logs showed a clean Next.js standalone-server startup (`✓ Ready in 323ms`).
  - Cleaned up: removed the test container and both local test images afterwards.
- **Part 1 is now fully verified** — code, `docker build` for both targets, and a running-container
  smoke test all pass. What's still outstanding for Part 1 is only a smoke test against the *real*
  external Postgres instance, which needs real `DATABASE_URL` credentials that shouldn't be pasted into
  this chat — that check happens naturally as part of the Part 4 "verify before cutover" step once a
  cluster exists, using the k8s Secret (copied directly from the Vercel dashboard, per the brief).

## 2026-09-25: cluster decision and provisioning (Part 4 begins)

- **Cluster decision**: user is cash-constrained right now, so chose **Oracle Cloud "Always Free"**
  (self-managed k3s on a free ARM VM) over a paid managed option (DigitalOcean DOKS was the paid
  alternative discussed, ~$36/mo minimum for 2 nodes + a load balancer). Tradeoffs discussed and
  accepted: no managed control plane (self-admin burden), single VM = no infra redundancy, no SLA,
  scarce ARM capacity in some regions, more manual CI/CD networking setup. Plan is to graduate to a
  paid managed cluster later once the app has revenue — the k8s manifests are portable either way.
  Corrected an earlier (stale) claim of 4 OCPU/24GB Always Free — Oracle quietly halved this in 2026;
  actual allowance is **2 OCPU / 12GB RAM total**, confirmed against Oracle's own docs. Home region:
  **UK South (London)**, chosen for latency given the UK-only user base.
- Oracle account created by the user (account creation, card entry, and login are user-only actions —
  not something this session does). Tenancy: `Distinguish`.
- **Provisioned the compute instance by driving the OCI Console via the Claude in Chrome browser
  extension** (user's choice over doing it manually), after installing/signing into that extension.
  Instance `idistinguishr-k8s`: shape `VM.Standard.A1.Flex` (Ampere, Always Free-eligible), resized to
  the full **2 OCPU / 12 GB memory** allowance (default was 1/6). Oracle Linux 9. New VCN
  (`idistinguishr-vcn`) and public subnet created alongside it (no pre-existing network in this fresh
  tenancy).
- **SSH keys**: the OCI console's dedicated "Add SSH keys" step never rendered in this session — after
  thorough investigation (the whole instance-creation form lives inside a `maui-preact` plugin iframe
  that's invisible to both the accessibility tree and a `document.body` DOM search, so it isn't a UI
  skip, it's a real rendering gap for this account/session). Workaround: generated an ed25519 keypair
  locally on this machine (`~/.ssh/idistinguishr_oci` / `.pub` — private key never leaves this machine,
  never pasted into chat or the browser) and injected the public key via a `#cloud-config` /
  `ssh_authorized_keys` block pasted into the "Initialization script" section instead. OCI's own
  "No SSH access" confirmation dialog at create time (which only checks its own metadata field) was
  correctly overridden, since cloud-init provides equivalent access through a different mechanism.
- **Instance created successfully** on the first attempt — no "out of host capacity" issue hit in
  London for the Ampere A1 shape.
- **Networking, in two steps** (assigning a public IP is not automatic even with a "public subnet"):
  1. Used the console's "Connect public subnet to internet" quick action to create the NSG
     (`ig-quick-action-NSG`) and confirm/attach the VCN's internet gateway + route table. Added ingress
     rules while there: **22/tcp (SSH), 80/tcp (HTTP), 443/tcp (HTTPS), 6443/tcp (k8s API — needed later
     for the GitHub Actions workflow to reach `kubectl`)**. Egress was already open to `0.0.0.0/0`.
  2. The instance's primary VNIC still had no public IP after that (`(Not Assigned)`) — quick-action
     wizards configure the network path but don't touch the VNIC. Assigned one manually: VNIC → IP
     administration → Edit private IP → **Ephemeral public IP**. Got `144.21.58.215`.
- **Verified SSH access end-to-end**: `ssh -i ~/.ssh/idistinguishr_oci opc@144.21.58.215` succeeds,
  confirms `idistinguishr-k8s`, Oracle Linux 9, `aarch64` kernel (`6.12.0-206...el9uek.aarch64`) — the
  cloud-init SSH key workaround is confirmed working end-to-end, and the box is reachable.
- **Note on OCI Console reliability this session**: hit a reproducible rendering bug several times where
  a specific control (the "Automatically assign public IPv4 address" toggle during instance creation,
  and later a VNIC row's "..." menu) would corrupt the whole page into a repeating grid of hundreds of
  toggle switches after being clicked, requiring a full page reload to recover. Worked around by
  reloading and either avoiding the broken control (public IP assigned after creation instead, as above)
  or retrying the same action once more deliberately after a fresh load. Not a sign of anything wrong
  with the account/instance — purely a client-side console glitch.
- **Not yet done**: installing k3s on the VM, `KUBE_CONFIG` GitHub Actions secret, DNS, Stripe
  webhook/Google OAuth callback updates, and the real-Postgres verification. Vercel deployment untouched.

### k3s installation

- Pushed the Part 4 provisioning commit (`5552955`) to `origin/main` (user confirmed).
- Oracle Linux 9.8 ships with SELinux `Enforcing` and `firewalld` active by default. Decisions made:
  - **Disabled `firewalld`** on the host. k3s/flannel are commonly documented as conflicting with
    firewalld's nftables rules on RHEL-family distros (breaks pod-to-pod/DNS traffic). The cloud NSG
    (22/80/443/6443 ingress, all else closed) is the real perimeter here, so this is safe, not a
    security regression.
  - Installed the **k3s-selinux** policy RPM before installing k3s, so it runs correctly under
    `Enforcing` rather than needing to disable SELinux. The `rpm.rancher.io` repo file Rancher's docs
    point to (`rancher-k3s-common.repo`) 404's now — installed the current release directly from the
    `k3s-io/k3s-selinux` GitHub releases instead (`v1.6.latest.1`, el9 noarch).
  - Ran the standard installer (`curl -sfL https://get.k3s.io | sudo sh -`) — no flags needed beyond
    the SELinux/firewalld prep above. **Succeeded on the first attempt**: node `idistinguishr-k8s` came
    up `Ready` as `control-plane` within ~30s (k3s v1.36.4+k3s1, containerd, all `kube-system` pods
    Running/Completed as expected, including k3s's bundled Traefik ingress controller and
    local-path-provisioner).
- **Fixed a real gotcha for remote access**: the default install generates the API server's TLS cert
  with only the private IP (`10.0.0.253`) and cluster-internal names in its SAN list — not the public
  IP. Left as-is, this would make `kubectl`/GitHub Actions fail TLS verification connecting from
  outside the VCN. Fixed by adding `tls-san: 144.21.58.215` to `/etc/rancher/k3s/config.yaml`, deleting
  the cached `dynamic-cert.json` to force regeneration, and restarting the service — confirmed the
  regenerated cert's SAN list now includes the public IP, and the node stayed `Ready` throughout.
- Verified external reachability: `curl https://144.21.58.215:6443/version` (unauthenticated) got a
  clean `401 Unauthorized` JSON response rather than a connection/TLS error — confirms the NSG's 6443
  rule and the new cert both work correctly from outside the VCN.
- Fetched `/etc/rancher/k3s/k3s.yaml`, patched its `server:` field from `127.0.0.1` to the public IP and
  renamed the `default` cluster/context/user entries to `idistinguishr-oci` for clarity, saved locally
  to `~/.kube/idistinguishr-oci.yaml` on this machine (same handling as the SSH private key — stays
  local, never pasted into chat). Verified `kubectl get nodes`/`get namespaces` work against the live
  cluster through it.
- **Noted for later, not yet acted on**: k3s ships with **Traefik** as its bundled ingress controller,
  but `k8s/ingress.yaml` (written in Part 2, before a cluster existed) assumes **ingress-nginx**
  (`ingressClassName: nginx`). Will need to either swap that manifest to Traefik's ingress class, or
  disable Traefik at k3s install time and install ingress-nginx instead, before Part 4's manifests can
  actually be applied. Also still need cert-manager installed for the `letsencrypt-prod` ClusterIssuer
  the ingress manifest references — neither exists on the cluster yet.
- **Not yet done**: `KUBE_CONFIG` GitHub Actions secret (needs the kubeconfig above, base64-encoded —
  will confirm with the user before writing anything to the repo's secrets), applying `k8s/` manifests
  to this real cluster, DNS, Stripe webhook/Google OAuth callback updates, and the real-Postgres
  verification.

### Ingress: switched to Traefik, installed cert-manager

- User chose Traefik (k3s's bundled ingress controller) over installing ingress-nginx separately.
  Rewrote `k8s/ingress.yaml`: `ingressClassName: traefik`, replaced nginx's `ssl-redirect`/
  `proxy-body-size` annotations with a Traefik `Middleware` (`redirectScheme` to https) — no body-size
  override needed since Traefik has no default limit (nginx's is 1MB, which is why that annotation
  existed originally). The Stripe webhook raw-body reasoning in the file's comments still holds; updated
  the wording to match Traefik. Validated both resources with `kubectl apply --dry-run=client` against
  the live cluster — confirms Traefik's CRDs (including `Middleware`) are already registered by k3s.
  Updated `docs/k8s-deploy.md`'s prerequisites and apply-order accordingly.
- Installed **cert-manager v1.21.2** on the cluster (`kubectl apply` of the upstream release manifest —
  not part of the app's own `k8s/` manifests, it's a one-time cluster add-on). All three deployments
  (`cert-manager`, `cert-manager-cainjector`, `cert-manager-webhook`) came up `Available` within ~10s.
- Added `k8s/cluster-issuer.yaml`: a `ClusterIssuer` named `letsencrypt-prod` (matching what
  `ingress.yaml` already references), ACME HTTP-01 validation via the Traefik ingress class, contact
  email `idistinguish@gmail.com` (user confirmed). Applied it — **registered successfully with Let's
  Encrypt's production ACME server**, `READY True` within 5 seconds. It won't actually issue a
  certificate until DNS points at the cluster and an `Ingress` requests one (HTTP-01 needs Let's
  Encrypt to reach `http://<domain>/.well-known/acme-challenge/...` on the cluster's public IP) — that
  happens naturally at cutover, per the brief's sequencing. Documented this as a new "step 0" (one-time
  cluster setup, distinct from the per-release apply order) in `docs/k8s-deploy.md`.
- **Not yet done**: `KUBE_CONFIG` GitHub Actions secret, applying the app's own `k8s/` manifests
  (namespace/secret/migration-job/deployment/service/ingress/hpa) to this real cluster, DNS, Stripe
  webhook/Google OAuth callback updates, and the real-Postgres verification.

### KUBE_CONFIG GitHub Actions secret

- `gh` CLI wasn't installed on this machine, so set this up via the GitHub web UI instead (user
  explicitly asked for it) — GitHub's own repository-secrets page, which encrypts at rest and never
  exposes the value in logs, is the intended place for this, so used Claude in Chrome (already
  logged in) to fill in and submit `Settings → Secrets and variables → Actions → New repository secret`.
- Retrieved `/etc/rancher/k3s/k3s.yaml` from the VM, patched the `server:` field from `127.0.0.1` to
  the public IP (`144.21.58.215`) and renamed the `default` cluster/context/user entries to
  `idistinguishr-oci`, saved locally as `~/.kube/idistinguishr-oci.yaml` (same local-only handling as
  the SSH private key — never pasted into chat). Base64-encoded it and pasted that into the secret's
  value field, named `KUBE_CONFIG` to match what `.github/workflows/deploy.yml` already expects.
- **Confirmed added**: GitHub's UI showed "Repository secret added." and the secret now appears in the
  repo's Actions secrets list. Deleted the local plaintext base64 temp file afterwards.
- The CI/CD pipeline (`.github/workflows/deploy.yml`) should now be able to run end-to-end on the next
  push to `main` — though the migration Job / Deployment it applies still target the `idistinguishr`
  namespace and Secret that don't exist on this cluster yet (see below).
- **Not yet done**: applying the app's own `k8s/` manifests (namespace/secret/migration-job/deployment/
  service/ingress/hpa) to this real cluster for the first time, DNS, Stripe webhook/Google OAuth
  callback updates, and the real-Postgres verification.

### First real deployment attempt — caught an architecture mismatch

- Applied `k8s/namespace.yaml` — created cleanly.
- The push of the `KUBE_CONFIG` commit triggered the CI/CD workflow end-to-end for the first time:
  `build-and-push` succeeded, and `deploy` got as far as reaching the cluster (kubeconfig works) before
  getting stuck applying `migration-job.yaml`, since the app's own Secret didn't exist yet.
- User filled in `k8s/secret.yaml` themselves from the Vercel dashboard (copied out from
  `secret.example.yaml`, edited directly in Notepad — never typed into this chat, per the brief).
  `ADMIN_EMAILS` was empty on Vercel; user chose to set a real value now rather than carry the empty
  string over. Applied the Secret (`kubectl apply`), confirmed all 11 expected keys present via
  `kubectl get secret -o jsonpath='{.data}'` (keys only, values never read or displayed), deleted the
  local file immediately after.
- **Found a real bug while investigating why the migration Job was stuck**: `kubectl describe pod`
  showed `ImagePullBackOff` — `"no match for platform in manifest: not found"`. The GitHub Actions
  runner (`ubuntu-latest`) builds `amd64`-only images by default, but the Oracle Cloud VM is `aarch64`
  (Ampere ARM) — the `:migrate` image GHCR had simply couldn't run there. This wasn't caught by Part 1's
  local Docker Desktop verification because that machine is `x86_64`, so the same-platform image pulled
  and ran fine there.
- **Fixed**: added `docker/setup-qemu-action@v3` and `platforms: linux/amd64,linux/arm64` to both
  `docker/build-push-action` steps in `.github/workflows/deploy.yml`. Built for both architectures
  deliberately, not just arm64 — a future move to a typical amd64 managed cluster (the DOKS path
  discussed earlier, if budget allows later) shouldn't require touching this workflow again. Deleted the
  stuck `idistinguishr-migrate` Job so it doesn't linger.
- **Not yet done**: waiting on the next CI run (multi-arch rebuild) to actually re-run the migration Job
  and roll out the Deployment successfully; then Service/Ingress, DNS, Stripe webhook/Google OAuth
  callback updates, and the real-Postgres verification.
