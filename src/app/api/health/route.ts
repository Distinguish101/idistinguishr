import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/health          -> liveness: process is up, no dependency checks
//                              (a DB blip must not cause k8s to restart the pod)
// GET /api/health?ready=1  -> deep check: also confirms Postgres is reachable.
//                              For people and external monitors. Do NOT use it
//                              as a Kubernetes probe: it wakes a serverless
//                              database (e.g. Neon) on every call and keeps it
//                              awake, burning the free compute allowance.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("ready") !== "1") {
    return NextResponse.json({ status: "ok" });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error instanceof Error ? error.message : String(error) },
      { status: 503 }
    );
  }
}
