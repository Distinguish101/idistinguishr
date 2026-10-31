import { afterAll, inject } from "vitest";

// Runs in every integration test file, before it imports the app code.
// The app's Prisma client reads DATABASE_URL when first imported, so it is set
// here, to the throwaway test database only.
process.env.DATABASE_URL = inject("dbUrl");
process.env.AUTH_SECRET = "integration-test-secret-not-real";
process.env.SITE_URL = "https://test.idistinguishr.example";

// No real external services in tests: anything that would call them is mocked
// per test file, and these make sure a missing mock can't send real traffic.
delete process.env.RESEND_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ADMIN_EMAILS;
for (const key of Object.keys(process.env)) {
  if (key.startsWith("STORAGE_")) delete process.env[key];
}

afterAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
});
