# Deploying idistinguishr to Kubernetes

This walks through taking the containerized app (see `Dockerfile`) and the manifests in `k8s/` from
zero to a running deployment, and what changes for each subsequent release.

The Vercel deployment (`https://idistinguishr.vercel.app`) stays live throughout this process — it is
not touched or disconnected until the k8s deployment is fully verified. See
`docs/idistinguishr-k8s-migration-log.md` for the running log of this migration.

## Prerequisites

- A Kubernetes cluster you have `kubectl` access to (currently: a self-managed k3s cluster on a single
  Oracle Cloud Always Free VM — see the migration log for provisioning details). k3s ships with Traefik
  as its built-in ingress controller, which `k8s/ingress.yaml` assumes; if the cluster runs something
  else (ingress-nginx, ALB, GKE ingress), adjust that manifest's `ingressClassName` and its
  Traefik-specific `Middleware`/annotation accordingly.
- `cert-manager` installed in the cluster, with a `ClusterIssuer` named `letsencrypt-prod` (adjust
  `k8s/ingress.yaml` if a different issuer name is used).
- `metrics-server` installed, if you want to use `k8s/hpa.yaml` (optional).
- Docker, and push access to a container registry. This doc assumes GitHub Container Registry (GHCR) at
  `ghcr.io/distinguish101/idistinguishr`, matching Part 3's CI/CD setup — swap the registry path in every
  manifest and command below if you use something else.
- The external Postgres instance's connection string (`DATABASE_URL`) — this migration does not create
  or move the database. It must be reachable from inside the cluster (check network/firewall rules on
  the Postgres side if it's an on-prem or VPC-restricted instance).

## First-time setup

### 0. Install cert-manager (once per cluster, not per release)

cert-manager isn't part of the app's own manifests — it's a cluster-level add-on, installed once:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl wait --for=condition=Available deployment --all -n cert-manager --timeout=120s

kubectl apply -f k8s/cluster-issuer.yaml
kubectl get clusterissuer letsencrypt-prod
```

The `ClusterIssuer` registers an ACME account with Let's Encrypt immediately (should show `READY True`
within a few seconds), but won't actually issue a certificate until DNS points at the cluster and an
`Ingress` requests one — see the cutover steps below.

### 1. Build and push both images

The runtime image (lean, no `prisma` CLI) and the migrate image (same Dockerfile, `builder` target, still
has the full `prisma` CLI — the runtime image can't run migrations itself, see Dockerfile comments):

```bash
docker build -t ghcr.io/distinguish101/idistinguishr:<tag> .
docker build --target=builder -t ghcr.io/distinguish101/idistinguishr:migrate .

docker push ghcr.io/distinguish101/idistinguishr:<tag>
docker push ghcr.io/distinguish101/idistinguishr:migrate
```

Use a real tag (a git SHA, e.g. `git rev-parse --short HEAD`) — never `latest` — so a rollback can target
a specific known-good image. The GitHub Actions workflow (Part 3) does this automatically on every push
to `main`.

### 2. Apply in order: namespace → secret → migration job → deployment/service/ingress/hpa

```bash
kubectl apply -f k8s/namespace.yaml

# Secret: copy k8s/secret.example.yaml to k8s/secret.yaml (gitignored), fill in
# real values copied directly from the Vercel dashboard, then:
kubectl apply -f k8s/secret.yaml
rm k8s/secret.yaml   # never leave real values sitting on disk

# Update k8s/migration-job.yaml and k8s/deployment.yaml with the real image tag
# from step 1 first, then:
kubectl apply -f k8s/migration-job.yaml
kubectl wait --for=condition=complete job/idistinguishr-migrate -n idistinguishr --timeout=120s

kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Edit k8s/ingress.yaml first: replace REPLACE_WITH_DOMAIN with the real domain,
# and the ClusterIssuer/ingressClassName if the cluster doesn't use Traefik + cert-manager.
kubectl apply -f k8s/ingress.yaml

# optional
kubectl apply -f k8s/hpa.yaml
```

### 3. Verify before pointing DNS at it

Confirm the Deployment is healthy and both probes are passing:

```bash
kubectl get pods -n idistinguishr
kubectl describe deployment idistinguishr -n idistinguishr
```

Then, before any DNS record points at the cluster's ingress IP, hit the new deployment directly (e.g. via
`kubectl port-forward svc/idistinguishr -n idistinguishr 3000:80`, or the ingress IP with a `Host` header
override) and confirm: auth (sign in/sign up), the booking soft-hold flow (the trickiest logic in the
codebase — see `prisma/schema.prisma` and `src/app/api/bookings/route.ts`), Stripe checkout + webhook
delivery, and confirmation emails all work exactly as they do on the current Vercel deployment.

### 4. Cutover (do this deliberately, not accidentally)

Once verified:

1. Point a DNS A/CNAME record at the cluster ingress's stable IP.
2. Update the Stripe webhook endpoint URL in the Stripe dashboard to
   `https://<new-domain>/api/webhooks/stripe`, and make sure `STRIPE_WEBHOOK_SECRET` in the k8s Secret
   matches that new endpoint's signing secret. This is the one integration that fails silently if
   missed — bookings complete client-side but never get server-confirmed.
3. If Google OAuth is wired up, add `https://<new-domain>/api/auth/callback/google` as an authorized
   redirect URI in Google Cloud Console.
4. Only after all of the above is confirmed working end-to-end: update/remove the Vercel deployment, if
   desired. Nothing about it should change before this point.

## What changes for a new release

1. Rebuild both images with a new tag — a git SHA, not `latest`:
   ```bash
   TAG=$(git rev-parse --short HEAD)
   docker build -t ghcr.io/distinguish101/idistinguishr:$TAG .
   docker build --target=builder -t ghcr.io/distinguish101/idistinguishr:migrate .
   docker push ghcr.io/distinguish101/idistinguishr:$TAG
   docker push ghcr.io/distinguish101/idistinguishr:migrate
   ```
2. Re-run the migration job (Jobs don't self-clean — delete and reapply):
   ```bash
   kubectl delete job idistinguishr-migrate -n idistinguishr --ignore-not-found
   kubectl apply -f k8s/migration-job.yaml
   kubectl wait --for=condition=complete job/idistinguishr-migrate -n idistinguishr --timeout=120s
   ```
3. Roll the Deployment to the new tag:
   ```bash
   kubectl set image deployment/idistinguishr idistinguishr=ghcr.io/distinguish101/idistinguishr:$TAG -n idistinguishr
   kubectl rollout status deployment/idistinguishr -n idistinguishr
   ```

The Deployment's `RollingUpdate` strategy (`maxUnavailable: 0`) means capacity never drops during this
rollout — the old pods keep serving until new ones pass their readiness probe.

See Part 3 of the migration brief / `.github/workflows/` for the automated version of this sequence.
