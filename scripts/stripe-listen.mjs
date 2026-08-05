import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Forwards both classic and v2 thin events to the one route that handles
// both (src/app/api/webhooks/stripe/route.ts) — needed locally because
// stripeOnboardingComplete and booking confirmation only ever flip via
// this webhook, never client-side. Reads STRIPE_SECRET_KEY straight out
// of .env and passes it via --api-key so this runs non-interactively,
// with no `stripe login` browser flow required.
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const env = readFileSync(envPath, "utf8");
const match = env.match(/^STRIPE_SECRET_KEY="?([^"\n]+)"?/m);
if (!match) {
  console.error("STRIPE_SECRET_KEY not found in .env");
  process.exit(1);
}

const child = spawn(
  "stripe",
  [
    "listen",
    "--api-key", match[1],
    "--events", "checkout.session.completed,account.updated",
    "--thin-events", "v2.core.account.updated,v2.core.account[configuration.recipient].capability_status_updated",
    "--forward-to", "localhost:3000/api/webhooks/stripe",
    "--forward-thin-to", "localhost:3000/api/webhooks/stripe",
  ],
  { stdio: "inherit", shell: true }
);

child.on("exit", (code) => process.exit(code ?? 0));
