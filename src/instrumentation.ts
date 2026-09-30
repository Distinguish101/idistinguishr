import { registerOTel } from "@vercel/otel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

// Next.js's sanctioned instrumentation hook — register() runs once on
// server start (App Router, Node.js runtime only; skipped for the Edge
// runtime and during `next build`). Exports to Jaeger's OTLP HTTP receiver.
//
// OTEL_EXPORTER_OTLP_ENDPOINT must be set per environment (the k8s
// Deployment points it at Jaeger's in-cluster Service — see
// k8s/deployment.yaml and k8s/jaeger.yaml); OTLPTraceExporter falls back to
// http://localhost:4318 if it's unset, which is what local dev against a
// standalone `docker run jaegertracing/all-in-one` container wants anyway.
//
// deployment.environment distinguishes which environment a trace came from
// so Vercel and k8s traces don't mix in the Jaeger UI during the parallel-
// running period before cutover.
export function register() {
  registerOTel({
    serviceName: "idistinguishr",
    attributes: {
      "deployment.environment": process.env.OTEL_DEPLOYMENT_ENVIRONMENT ?? "development",
    },
    traceExporter: new OTLPTraceExporter(),
  });
}
