import http from "node:http";
import type { AddressInfo } from "node:net";

// A tiny S3-compatible server that records what it receives, so the storage
// code can be tested end to end over real HTTP without a cloud account.

export type RecordedRequest = {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

export async function startFakeS3() {
  const requests: RecordedRequest[] = [];
  let failWith: number | null = null;

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      requests.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) });
      res.statusCode = failWith ?? (req.method === "DELETE" ? 204 : 200);
      res.end(failWith ? "simulated storage failure" : "");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    endpoint: `http://127.0.0.1:${port}`,
    requests,
    puts: () => requests.filter((r) => r.method === "PUT"),
    deletes: () => requests.filter((r) => r.method === "DELETE"),
    /** Make every following request fail with this HTTP status (null to stop). */
    failWith(status: number | null) {
      failWith = status;
    },
    clear() {
      requests.length = 0;
      failWith = null;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Points the app's storage code at the fake server. */
export function useStorageEnv(endpoint: string) {
  process.env.STORAGE_ENDPOINT = endpoint;
  process.env.STORAGE_BUCKET = "test-bucket";
  process.env.STORAGE_ACCESS_KEY_ID = "TESTKEYID";
  process.env.STORAGE_SECRET_ACCESS_KEY = "testsecret";
  process.env.STORAGE_PUBLIC_URL = "https://images.example.test";
}

export function clearStorageEnv() {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("STORAGE_")) delete process.env[key];
  }
}

/** Smallest byte sequences each accepted image type is recognised by. */
export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
export const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
