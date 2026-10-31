import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async () => (await import("../helpers/auth-mock")).authModule);

import { GET, PUT } from "@/app/api/teacher/profile/route";
import { prisma } from "@/lib/prisma";
import { signInAs, signOut } from "../helpers/auth-mock";
import { clearStorageEnv, startFakeS3, useStorageEnv } from "../helpers/fake-s3";
import { createInstructor, createStudent, createUser, resetDb } from "../helpers/factories";
import { jsonRequest, rawRequest, readJson } from "../helpers/http";

const valid = {
  bio: "Classically trained pianist with ten years of teaching experience.",
  instruments: ["Piano"],
  hourlyRate: 45,
  formatsOffered: ["ONLINE"],
  locationText: null,
  credentials: "ABRSM Grade 8 and a music degree",
};

let user: Awaited<ReturnType<typeof createUser>>;
const put = (body: unknown) => PUT(jsonRequest("/api/teacher/profile", "PUT", body));
const saved = () => prisma.teacherProfile.findUniqueOrThrow({ where: { userId: user.id } });

let s3: Awaited<ReturnType<typeof startFakeS3>>;
beforeAll(async () => {
  s3 = await startFakeS3();
});
afterAll(async () => {
  clearStorageEnv();
  await s3.close();
});

beforeEach(async () => {
  await resetDb();
  clearStorageEnv();
  s3.clear();
  user = await createUser({ role: "TEACHER" });
  signInAs({ id: user.id, role: "TEACHER" });
});

describe("GET /api/teacher/profile", () => {
  it("returns null before a profile exists, then the profile", async () => {
    expect(await readJson(await GET())).toEqual({ profile: null });
    await put(valid);
    expect((await readJson(await GET())).profile).toMatchObject({ userId: user.id, bio: valid.bio });
  });

  it("401 for students and signed-out visitors", async () => {
    const student = await createStudent();
    signInAs({ id: student.id, role: "STUDENT" });
    expect((await GET()).status).toBe(401);
    signOut();
    expect((await GET()).status).toBe(401);
  });
});

describe("PUT /api/teacher/profile: saving", () => {
  it("creates a profile that starts pending approval and not payout-ready", async () => {
    const res = await put(valid);
    expect(res.status).toBe(200);
    const p = await saved();
    expect(p).toMatchObject({
      bio: valid.bio,
      credentials: valid.credentials,
      formatsOffered: ["ONLINE"],
      locationText: null,
      approvalStatus: "PENDING",
      stripeOnboardingComplete: false,
      reviewCount: 0,
    });
  });

  it("stores the rate in pence, rounding sensibly", async () => {
    for (const [pounds, pence] of [[45, 4500], [45.5, 4550], [12.35, 1235], [0.01, 1], [500, 50000]]) {
      await put({ ...valid, hourlyRate: pounds });
      expect((await saved()).hourlyRateMinorUnits, `£${pounds}`).toBe(pence);
    }
  });

  it("stores instruments in one canonical form, de-duplicated", async () => {
    await put({ ...valid, instruments: ["  Piano ", "PIANO", "Electric   Guitar", "piano"] });
    expect((await saved()).instruments).toEqual(["piano", "electric guitar"]);
  });

  it("trims the text fields", async () => {
    await put({ ...valid, bio: `   ${valid.bio}   `, credentials: `  ${valid.credentials}  ` });
    const p = await saved();
    expect(p.bio).toBe(valid.bio);
    expect(p.credentials).toBe(valid.credentials);
  });

  it("updates an existing profile rather than creating a second", async () => {
    await put(valid);
    await put({ ...valid, bio: "A completely rewritten biography for the profile." });
    expect(await prisma.teacherProfile.count()).toBe(1);
    expect((await saved()).bio).toMatch(/rewritten/);
  });

  it("editing never changes approval, payout status, rating or the account", async () => {
    const t = await createInstructor({ approvalStatus: "APPROVED", stripeOnboardingComplete: true, avgRating: 4.5, reviewCount: 8 });
    signInAs({ id: t.user.id, role: "TEACHER" });
    await put({ ...valid, approvalStatus: "REJECTED", stripeOnboardingComplete: false, avgRating: 1, userId: "someone-else" });
    const p = await prisma.teacherProfile.findUniqueOrThrow({ where: { id: t.profile.id } });
    expect(p).toMatchObject({ approvalStatus: "APPROVED", stripeOnboardingComplete: true, reviewCount: 8, userId: t.user.id });
    expect(Number(p.avgRating)).toBe(4.5);
  });

  it("only ever edits the signed-in instructor's own profile", async () => {
    const t = await createInstructor({ bio: "The other instructor's untouched biography text." });
    await put(valid);
    expect((await prisma.teacherProfile.findUniqueOrThrow({ where: { id: t.profile.id } })).bio).toMatch(/untouched/);
  });

  it("allows in-person lessons with a location, and both formats", async () => {
    const res = await put({ ...valid, formatsOffered: ["ONLINE", "IN_PERSON"], locationText: "  Leeds city centre " });
    expect(res.status).toBe(200);
    expect(await saved()).toMatchObject({ formatsOffered: ["ONLINE", "IN_PERSON"], locationText: "Leeds city centre" });
  });
});

describe("PUT /api/teacher/profile: validation", () => {
  const expectRejected = async (patch: Record<string, unknown>, message?: RegExp) => {
    const res = await put({ ...valid, ...patch });
    expect(res.status).toBe(400);
    if (message) expect((await readJson(res)).error).toMatch(message);
    expect(await prisma.teacherProfile.count()).toBe(0);
  };

  it("bio: at least 20 characters (after trimming), at most 2000", async () => {
    await expectRejected({ bio: "Too short." }, /at least 20/);
    await expectRejected({ bio: `   ${"x".repeat(19)}   ` }, /at least 20/);
    await expectRejected({ bio: "x".repeat(2001) });
  });

  it("instruments: between 1 and 10, none blank", async () => {
    await expectRejected({ instruments: [] }, /at least one instrument/);
    await expectRejected({ instruments: ["   "] });
    await expectRejected({ instruments: Array.from({ length: 11 }, (_, i) => `instrument ${i}`) });
    expect((await put({ ...valid, instruments: Array.from({ length: 10 }, (_, i) => `instrument ${i}`) })).status).toBe(200);
  });

  it("hourly rate: above 0 and at most £500, as a number", async () => {
    await expectRejected({ hourlyRate: 0 });
    await expectRejected({ hourlyRate: -5 });
    await expectRejected({ hourlyRate: 500.01 });
    await expectRejected({ hourlyRate: "45" });
    await expectRejected({ hourlyRate: undefined });
  });

  it("formats: at least one, from the known set", async () => {
    await expectRejected({ formatsOffered: [] }, /at least one format/);
    await expectRejected({ formatsOffered: ["TELEPATHY"] });
  });

  it("in-person lessons need a location", async () => {
    await expectRejected({ formatsOffered: ["IN_PERSON"], locationText: null }, /location/);
    await expectRejected({ formatsOffered: ["ONLINE", "IN_PERSON"], locationText: "   " }, /location/);
  });

  it("credentials: at least 10 characters, at most 2000", async () => {
    await expectRejected({ credentials: "Too short" }, /credentials/);
    await expectRejected({ credentials: "x".repeat(2001) });
  });

  it("location: at most 200 characters", async () => {
    await expectRejected({ locationText: "x".repeat(201) });
  });

  it("photo link: must be a URL", async () => {
    await expectRejected({ photoUrl: "not a url" }, /valid URL/);
  });

  it("rejects a body that is not JSON", async () => {
    expect((await PUT(rawRequest("/x", "PUT", "{nope", {}))).status).toBe(400);
  });

  it("401 for students and signed-out visitors, saving nothing", async () => {
    const student = await createStudent();
    signInAs({ id: student.id, role: "STUDENT" });
    expect((await put(valid)).status).toBe(401);
    signOut();
    expect((await put(valid)).status).toBe(401);
    expect(await prisma.teacherProfile.count()).toBe(0);
  });
});

describe("PUT /api/teacher/profile: photos", () => {
  const OURS = (userId: string, name = "abc.jpg") => `https://images.example.test/photos/${userId}/${name}`;

  it("without storage configured, any web address is accepted as a photo link", async () => {
    expect((await put({ ...valid, photoUrl: "https://anywhere.test/me.jpg" })).status).toBe(200);
    expect((await saved()).photoUrl).toBe("https://anywhere.test/me.jpg");
  });

  describe("with storage configured", () => {
    beforeEach(() => useStorageEnv(s3.endpoint));

    it("accepts a photo this instructor uploaded", async () => {
      expect((await put({ ...valid, photoUrl: OURS(user.id) })).status).toBe(200);
      expect((await saved()).photoUrl).toBe(OURS(user.id));
    });

    it("refuses an arbitrary web address, and someone else's upload", async () => {
      for (const photoUrl of ["https://anywhere.test/me.jpg", OURS("another-user-id")]) {
        const res = await put({ ...valid, photoUrl });
        expect(res.status).toBe(400);
        expect((await readJson(res)).error).toMatch(/Upload button/);
      }
      expect(await prisma.teacherProfile.count()).toBe(0);
    });

    it("keeps working when the profile already has an older pasted link", async () => {
      await prisma.teacherProfile.create({
        data: { userId: user.id, bio: valid.bio, instruments: ["piano"], hourlyRateMinorUnits: 4500, formatsOffered: ["ONLINE"], credentials: valid.credentials, photoUrl: "https://old.test/me.jpg" },
      });
      expect((await put({ ...valid, photoUrl: "https://old.test/me.jpg" })).status).toBe(200);
      expect(s3.requests).toHaveLength(0);
    });

    it("saving without a photo field leaves no photo", async () => {
      expect((await put(valid)).status).toBe(200);
      expect((await saved()).photoUrl).toBeNull();
    });

    it("deletes the old uploaded file when the photo is replaced", async () => {
      await put({ ...valid, photoUrl: OURS(user.id, "old.jpg") });
      await put({ ...valid, photoUrl: OURS(user.id, "new.jpg") });
      expect(s3.deletes().map((r) => r.url)).toEqual([`/test-bucket/photos/${user.id}/old.jpg`]);
      expect((await saved()).photoUrl).toBe(OURS(user.id, "new.jpg"));
    });

    it("deletes the uploaded file when the photo is removed", async () => {
      await put({ ...valid, photoUrl: OURS(user.id, "old.jpg") });
      await put({ ...valid, photoUrl: null });
      expect(s3.deletes()).toHaveLength(1);
      expect((await saved()).photoUrl).toBeNull();
    });

    it("does not delete when the photo is unchanged", async () => {
      await put({ ...valid, photoUrl: OURS(user.id) });
      await put({ ...valid, bio: "A different biography for this instructor's page.", photoUrl: OURS(user.id) });
      expect(s3.deletes()).toHaveLength(0);
    });

    it("still saves the profile if deleting the old file fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      await put({ ...valid, photoUrl: OURS(user.id, "old.jpg") });
      s3.failWith(500);
      const res = await put({ ...valid, photoUrl: OURS(user.id, "new.jpg") });
      expect(res.status).toBe(200);
      expect((await saved()).photoUrl).toBe(OURS(user.id, "new.jpg"));
    });
  });
});
