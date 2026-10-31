import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import type { TestProject } from "vitest/node";

// Starts the database the integration tests run against, once per run.
//
// Default: PGlite (Postgres compiled to WebAssembly) in this process, with the
// project's real migrations applied, exposed on a free local port so the normal
// Prisma client connects to it unchanged. No Docker or install needed.
//
// Alternative: set TEST_DATABASE_URL to a LOCAL Postgres that already has the
// migrations applied (for example one started with Docker). Anything that isn't
// localhost is refused: the tests truncate every table.

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

export default async function setup(project: TestProject) {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    const host = new URL(external).hostname;
    if (!LOCAL_HOSTS.includes(host)) {
      throw new Error(`Refusing to run integration tests against non-local database host "${host}".`);
    }
    project.provide("dbUrl", external);
    return;
  }

  const db = await PGlite.create();
  const migrationsDir = path.resolve(__dirname, "../../prisma/migrations");
  for (const name of readdirSync(migrationsDir).filter((n) => /^\d/.test(n)).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8"));
  }

  const port = await freePort();
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await server.start();

  // connection_limit=1: PGlite serves one connection at a time.
  project.provide(
    "dbUrl",
    `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?connection_limit=1&sslmode=disable&pgbouncer=true`
  );

  return async () => {
    await server.stop();
    await db.close();
  };
}
