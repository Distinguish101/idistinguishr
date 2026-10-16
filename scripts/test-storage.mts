// Checks the photo storage code against a fake S3 server on this machine, and the
// image-type check. Run: npm run test:storage
import http from "node:http";

// Fake S3-compatible server: records every request it receives.
const seen: { method: string; url: string; headers: http.IncomingHttpHeaders; body: Buffer }[] = [];
const server = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    seen.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) });
    res.statusCode = req.method === "DELETE" ? 204 : 200;
    res.end();
  });
});
await new Promise<void>((r) => server.listen(4599, "127.0.0.1", r));

process.env.STORAGE_ENDPOINT = "http://127.0.0.1:4599";
process.env.STORAGE_BUCKET = "test-bucket";
process.env.STORAGE_ACCESS_KEY_ID = "TESTKEYID";
process.env.STORAGE_SECRET_ACCESS_KEY = "testsecret";
process.env.STORAGE_PUBLIC_URL = "https://images.example.test/";

const root = "../src/lib/";
const { putObject, deletePhotoByUrl, keyFromPublicUrl, storageEnabled, userPhotoPrefix, storageConfig } = await import(root + "storage.ts");
const { sniffPhotoType } = await import(root + "image-type.ts");

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => { if (!ok) failures++; console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };

check("storage reports enabled when configured", storageEnabled() === true);
const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
const url = await putObject("photos/user-1/abc.jpg", bytes, "image/jpeg");
check("returns the public URL (trailing slash trimmed)", url === "https://images.example.test/photos/user-1/abc.jpg", url);
const put = seen.find((s) => s.method === "PUT")!;
check("PUT goes to /bucket/key path", put.url === "/test-bucket/photos/user-1/abc.jpg", put.url);
check("request is AWS-signed", String(put.headers.authorization).startsWith("AWS4-HMAC-SHA256 Credential=TESTKEYID/"), String(put.headers.authorization).slice(0, 60));
check("sends content type", put.headers["content-type"] === "image/jpeg");
check("sends long cache header", String(put.headers["cache-control"]).includes("immutable"));
check("sends exact bytes", Buffer.compare(put.body, Buffer.from(bytes)) === 0, put.body.length + " bytes");

check("keyFromPublicUrl accepts our photo URL", keyFromPublicUrl("https://images.example.test/photos/user-1/abc.jpg") === "photos/user-1/abc.jpg");
check("keyFromPublicUrl rejects other hosts", keyFromPublicUrl("https://evil.test/photos/user-1/abc.jpg") === null);
check("keyFromPublicUrl rejects non-photo paths", keyFromPublicUrl("https://images.example.test/other/x.jpg") === null);
check("keyFromPublicUrl handles null", keyFromPublicUrl(null) === null);

await deletePhotoByUrl("https://images.example.test/photos/user-1/abc.jpg");
const del = seen.find((s) => s.method === "DELETE");
check("delete sends a signed DELETE for the right key", !!del && del.url === "/test-bucket/photos/user-1/abc.jpg" && String(del.headers.authorization).startsWith("AWS4-HMAC-SHA256"));
const before = seen.length;
await deletePhotoByUrl("https://somewhere-else.test/photos/user-1/abc.jpg");
check("delete ignores URLs that aren't ours (no request made)", seen.length === before);

const cfg = storageConfig();
check("user photo prefix is per user", userPhotoPrefix(cfg, "u9") === "https://images.example.test/photos/u9/");

// Image type sniffing
check("sniff: JPEG", sniffPhotoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe1]))?.mime === "image/jpeg");
check("sniff: PNG", sniffPhotoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.mime === "image/png");
check("sniff: WebP", sniffPhotoType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))?.mime === "image/webp");
check("sniff: SVG text is rejected", sniffPhotoType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>")) === null);
check("sniff: HTML is rejected", sniffPhotoType(new TextEncoder().encode("<html><script>alert(1)</script>")) === null);
check("sniff: GIF is rejected", sniffPhotoType(new TextEncoder().encode("GIF89a....")) === null);
check("sniff: empty is rejected", sniffPhotoType(new Uint8Array([])) === null);
check("sniff: RIFF that isn't WebP (e.g. WAV) is rejected", sniffPhotoType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45])) === null);

// Not configured -> disabled
for (const k of ["STORAGE_ENDPOINT"]) delete process.env[k];
check("storage reports disabled when a setting is missing", storageEnabled() === false);
let threw = false;
try { await putObject("photos/x/y.jpg", bytes, "image/jpeg"); } catch { threw = true; }
check("putObject refuses when not configured", threw);

server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
