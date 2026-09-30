# Distributed tracing (OpenTelemetry + Jaeger)

Added after the Kubernetes migration was verified stable (Part 5 of the migration brief — see
`docs/idistinguishr-k8s-migration-log.md`), deliberately kept as a separate milestone so a tracing bug
was never a variable while debugging the migration itself.

## What's instrumented

- **Automatic instrumentation** via [`@vercel/otel`](https://www.npmjs.com/package/@vercel/otel):
  incoming HTTP requests, outgoing `fetch` calls, and Next.js's own server-side rendering spans, with no
  manual code needed for those.
- **Manual spans** around the two highest-value paths — the ones most worth understanding step-by-step
  when something's slow or fails:
  - `booking.soft_hold_transaction` in `POST /api/bookings` (`src/app/api/bookings/route.ts`) — the
    soft-hold create, including how many expired holds got released in the same transaction and the
    resulting booking ID.
  - `stripe_webhook.handle` wrapping the whole webhook handler in
    `src/app/api/webhooks/stripe/route.ts`, with a nested `stripe_webhook.confirm_booking` span around
    the booking-confirm + payment-record transaction specifically. Attributes include the Stripe event
    type/ID and (thin vs. classic) event kind, since this endpoint handles both.
  - Both record exceptions and set an error status on failure (`span.recordException` +
    `SpanStatusCode.ERROR`), so failed transactions are visually distinct from slow-but-successful ones
    in the Jaeger UI.
- **Resource attributes**: `service.name: idistinguishr` and `deployment.environment` (set to `k8s` in
  the cluster via an env var — see `k8s/deployment.yaml` — and left as `development` locally), so traces
  from different environments don't mix in the Jaeger UI.

`src/instrumentation.ts` is the registration point — Next.js's sanctioned hook for this, runs once on
server start (Node.js runtime only, not Edge).

## Testing locally

Point the app at a standalone Jaeger container before touching the cluster:

```bash
docker run -d --name jaeger \
  -p 16686:16686 -p 4317:4317 -p 4318:4318 \
  jaegertracing/all-in-one:1.62.0

npm run dev
```

`OTLPTraceExporter` defaults to `http://localhost:4318` when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset, so
no extra env var is needed for local dev. Open http://localhost:16686, click through the app (sign in,
search, book a lesson), and confirm traces for `idistinguishr` show up with the `booking.*` spans
attached to the `/api/bookings` request.

## Deployed on the cluster

`k8s/jaeger.yaml` runs Jaeger as another Deployment in the same cluster — all-in-one mode, **Badger**
storage (an embedded on-disk store, backed by a small `PersistentVolumeClaim` so traces survive pod
restarts), not a separate Elasticsearch/Cassandra-backed deployment, which would be disproportionate
infrastructure for this app's scale.

```bash
kubectl apply -f k8s/jaeger.yaml
kubectl rollout status deployment/jaeger -n idistinguishr
```

The app's `k8s/deployment.yaml` points `OTEL_EXPORTER_OTLP_ENDPOINT` at Jaeger's in-cluster Service
(`http://jaeger.idistinguishr.svc.cluster.local:4318`) and sets `OTEL_DEPLOYMENT_ENVIRONMENT=k8s`.

Jaeger's UI (port 16686) is deliberately **not** exposed through the Ingress — view it with:

```bash
kubectl port-forward svc/jaeger -n idistinguishr 16686:16686
```

then open http://localhost:16686.

## Why Badger, not Elasticsearch/Cassandra

Jaeger's default recommended production backends (Elasticsearch, Cassandra) are built for high-volume,
multi-team tracing at a scale this app doesn't operate at. Badger is an embedded key/value store baked
directly into the `jaegertracing/all-in-one` image — one Deployment, one small PVC, no separate database
cluster to run and maintain. The tradeoff is Badger doesn't scale horizontally and isn't meant for
long-term high-volume retention, which is a fine trade for this app's scale and is easy to revisit later
if trace volume ever justifies it.
