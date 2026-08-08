import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Demo data for local/staging use — populates the marketplace with
// bookable teachers so a fresh checkout of the repo (or a wiped dev DB)
// isn't an empty homepage. Safe to re-run: everything is keyed by email
// (users) or upserted by teacherId (profiles/availability), and re-running
// replaces rather than duplicates.
//
// The Stripe account IDs below are real test-mode Connect accounts that
// already completed onboarding via the hosted flow — a seed script can't
// drive that hosted UI itself (see docs/idistinguishr-build-log.md §19),
// so this only recreates the DB rows, referencing accounts that already
// exist in Stripe test mode. If you need fresh ones, a teacher's Payouts
// section on their profile page can re-run onboarding for any of these.
const prisma = new PrismaClient();

type TeacherSeed = {
  fullName: string;
  email: string;
  bio: string;
  instruments: string[];
  hourlyRateMinorUnits: number;
  formatsOffered: ("ONLINE" | "IN_PERSON")[];
  locationText: string | null;
  credentials: string;
  photoUrl: string;
  stripeAccountId: string;
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
};

// Square headshot crop, consistent size across all card/profile renders.
const PHOTO_PARAMS = "?w=800&h=800&fit=crop&crop=faces&auto=format&q=80";

const TEACHERS: TeacherSeed[] = [
  {
    fullName: "Maya Okonkwo",
    email: "maya.okonkwo.teach@example.com",
    bio: "Warm, patient piano teacher with 15 years of experience across all ages and levels. Former ABRSM examiner, now focused on helping students build genuine musicality alongside technique.",
    instruments: ["Piano"],
    hourlyRateMinorUnits: 3500,
    formatsOffered: ["ONLINE", "IN_PERSON"],
    locationText: "Clapham, London",
    credentials: "ABRSM Diploma (DipABRSM), former ABRSM piano examiner, 15 years teaching experience.",
    photoUrl: `https://plus.unsplash.com/premium_photo-1689551670902-19b441a6afde${PHOTO_PARAMS}`,
    stripeAccountId: "acct_1U2AufGnMY2Ey8Os",
    availability: [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "17:00" })),
  },
  {
    fullName: "Tomasz Nowak",
    email: "tomasz.nowak.teach@example.com",
    bio: "Gigging guitarist and songwriter teaching acoustic and electric guitar for over a decade. I focus on getting you playing real songs fast, then filling in theory as you need it.",
    instruments: ["Guitar"],
    hourlyRateMinorUnits: 3000,
    formatsOffered: ["ONLINE"],
    locationText: null,
    credentials: "10+ years gigging and session work, BA Popular Music Performance.",
    photoUrl: `https://images.unsplash.com/photo-1705645930353-0e335311ef20${PHOTO_PARAMS}`,
    stripeAccountId: "acct_1U2Ay8GnMYAiEkST",
    availability: [1, 2, 3, 4].map((d) => ({ dayOfWeek: d, startTime: "17:00", endTime: "21:00" })),
  },
  {
    fullName: "Priya Shah",
    email: "priya.shah.teach@example.com",
    bio: "Classically trained violinist offering rigorous, exam-focused lessons for serious students, from grade 1 through diploma level. Also happy to work on orchestral audition prep.",
    instruments: ["Violin"],
    hourlyRateMinorUnits: 4500,
    formatsOffered: ["IN_PERSON"],
    locationText: "Chorlton, Manchester",
    credentials: "Royal Northern College of Music graduate, former member of a regional youth orchestra, 8 years teaching.",
    photoUrl: `https://images.unsplash.com/photo-1544005313-94ddf0286df2${PHOTO_PARAMS}`,
    stripeAccountId: "acct_1U2B2KGnMYZOe0Vn",
    availability: [
      { dayOfWeek: 0, startTime: "10:00", endTime: "16:00" },
      { dayOfWeek: 3, startTime: "17:00", endTime: "19:00" },
      { dayOfWeek: 6, startTime: "10:00", endTime: "16:00" },
    ],
  },
  {
    fullName: "Ben Whitfield",
    email: "ben.whitfield.teach@example.com",
    bio: "West End performer turned singing teacher, covering pop, musical theatre and classical technique. I help students find confidence in their voice as much as the technical side.",
    instruments: ["Voice"],
    hourlyRateMinorUnits: 4000,
    formatsOffered: ["ONLINE", "IN_PERSON"],
    locationText: "Clifton, Bristol",
    credentials: "West End performer (7 years), trained at a leading UK drama school.",
    photoUrl: `https://images.unsplash.com/photo-1651684215020-f7a5b6610f23${PHOTO_PARAMS}`,
    stripeAccountId: "acct_1U2B7rGnMYJAcBIK",
    availability: [1, 2, 4].map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "17:00" })),
  },
  {
    fullName: "Kofi Mensah",
    email: "kofi.mensah.teach@example.com",
    bio: "Session drummer teaching kids and adults alike, from first-time beginners to players prepping for their first band. Relaxed lessons built around the music you actually want to play.",
    instruments: ["Drums"],
    hourlyRateMinorUnits: 2800,
    formatsOffered: ["ONLINE", "IN_PERSON"],
    locationText: "Digbeth, Birmingham",
    credentials: "Session drummer for 9 years, taught drum workshops at local youth music programmes.",
    photoUrl: `https://plus.unsplash.com/premium_photo-1689747698547-271d2d553cee${PHOTO_PARAMS}`,
    stripeAccountId: "acct_1U2BA6GnMYbQjlpA",
    availability: [
      { dayOfWeek: 2, startTime: "18:00", endTime: "20:00" },
      { dayOfWeek: 4, startTime: "18:00", endTime: "20:00" },
      { dayOfWeek: 6, startTime: "10:00", endTime: "16:00" },
    ],
  },
];

const STUDENTS = [
  { fullName: "Alex Turner", email: "alex.turner.demo@example.com" },
  { fullName: "Sophie Bennett", email: "sophie.bennett.demo@example.com" },
  { fullName: "Jamie Osei", email: "jamie.osei.demo@example.com" },
];

// [teacher email, student email, rating, comment, format, durationMinutes, daysAgo]
const PAST_REVIEWED_LESSONS: [string, string, number, string, "ONLINE" | "IN_PERSON", number, number][] = [
  [
    "maya.okonkwo.teach@example.com",
    "alex.turner.demo@example.com",
    5,
    "Maya is brilliant — patient, encouraging, and genuinely fun lessons. My daughter looks forward to every week.",
    "ONLINE",
    60,
    21,
  ],
  [
    "maya.okonkwo.teach@example.com",
    "sophie.bennett.demo@example.com",
    4,
    "Really solid teaching, adjusted the pace well for me as a complete beginner.",
    "IN_PERSON",
    60,
    10,
  ],
  [
    "tomasz.nowak.teach@example.com",
    "jamie.osei.demo@example.com",
    4,
    "Great at picking songs I actually wanted to learn. Casual vibe, no pressure.",
    "ONLINE",
    60,
    14,
  ],
  [
    "priya.shah.teach@example.com",
    "alex.turner.demo@example.com",
    5,
    "Exactly the rigorous, exam-focused teaching I was looking for. Passed my grade 5 with distinction.",
    "IN_PERSON",
    60,
    18,
  ],
  [
    "ben.whitfield.teach@example.com",
    "sophie.bennett.demo@example.com",
    5,
    "Ben helped me find confidence in my voice I didn't know I had. Highly recommend.",
    "ONLINE",
    45,
    7,
  ],
];

const PLATFORM_FEE_PERCENT = 10;

async function main() {
  const passwordHash = await bcrypt.hash("DemoPass123!", 12);

  const teacherIdByEmail = new Map<string, string>();

  for (const t of TEACHERS) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: { fullName: t.fullName },
      create: {
        role: "TEACHER",
        fullName: t.fullName,
        email: t.email,
        passwordHash,
        status: "ACTIVE",
      },
    });

    const profile = await prisma.teacherProfile.upsert({
      where: { userId: user.id },
      update: {
        bio: t.bio,
        instruments: t.instruments,
        hourlyRateMinorUnits: t.hourlyRateMinorUnits,
        formatsOffered: t.formatsOffered,
        locationText: t.locationText,
        credentials: t.credentials,
        photoUrl: t.photoUrl,
        approvalStatus: "APPROVED",
        stripeAccountId: t.stripeAccountId,
        stripeOnboardingComplete: true,
      },
      create: {
        userId: user.id,
        bio: t.bio,
        instruments: t.instruments,
        hourlyRateMinorUnits: t.hourlyRateMinorUnits,
        formatsOffered: t.formatsOffered,
        locationText: t.locationText,
        credentials: t.credentials,
        photoUrl: t.photoUrl,
        approvalStatus: "APPROVED",
        stripeAccountId: t.stripeAccountId,
        stripeOnboardingComplete: true,
      },
    });

    teacherIdByEmail.set(t.email, profile.id);

    await prisma.availabilityRule.deleteMany({ where: { teacherId: profile.id } });
    await prisma.availabilityRule.createMany({
      data: t.availability.map((a) => ({ teacherId: profile.id, ...a })),
    });

    console.log(`Teacher ready: ${t.fullName} (${profile.id})`);
  }

  const studentIdByEmail = new Map<string, string>();
  for (const s of STUDENTS) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { fullName: s.fullName },
      create: {
        role: "STUDENT",
        fullName: s.fullName,
        email: s.email,
        passwordHash,
        status: "ACTIVE",
      },
    });
    studentIdByEmail.set(s.email, user.id);
  }

  // Past completed lessons + reviews, so ratings aren't all "0.0 (0)".
  // Cleared and rebuilt each run rather than upserted — there's no
  // natural unique key for a demo booking, and this is cheap at this scale.
  const teacherIds = Array.from(teacherIdByEmail.values());
  const studentIds = Array.from(studentIdByEmail.values());
  await prisma.review.deleteMany({ where: { teacherId: { in: teacherIds } } });
  await prisma.payment.deleteMany({ where: { booking: { teacherId: { in: teacherIds } } } });
  await prisma.booking.deleteMany({
    where: { teacherId: { in: teacherIds }, studentId: { in: studentIds } },
  });

  for (const [teacherEmail, studentEmail, rating, comment, format, duration, daysAgo] of PAST_REVIEWED_LESSONS) {
    const teacherId = teacherIdByEmail.get(teacherEmail)!;
    const studentId = studentIdByEmail.get(studentEmail)!;
    const teacher = TEACHERS.find((t) => t.email === teacherEmail)!;
    const priceTotalMinorUnits = Math.round((teacher.hourlyRateMinorUnits * duration) / 60);
    const platformFeeMinorUnits = Math.round((priceTotalMinorUnits * PLATFORM_FEE_PERCENT) / 100);

    const lessonDate = new Date();
    lessonDate.setUTCDate(lessonDate.getUTCDate() - daysAgo);
    const lessonDateUtc = new Date(
      Date.UTC(lessonDate.getUTCFullYear(), lessonDate.getUTCMonth(), lessonDate.getUTCDate())
    );

    const booking = await prisma.booking.create({
      data: {
        studentId,
        teacherId,
        lessonDate: lessonDateUtc,
        startTime: "14:00",
        durationMinutes: duration,
        format,
        status: "COMPLETED",
        priceTotalMinorUnits,
      },
    });

    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amountMinorUnits: priceTotalMinorUnits,
        currency: "GBP",
        stripePaymentIntentId: `pi_seed_${booking.id.slice(0, 8)}`,
        platformFeeMinorUnits,
        teacherPayoutMinorUnits: priceTotalMinorUnits - platformFeeMinorUnits,
        status: "SUCCEEDED",
      },
    });

    await prisma.review.create({
      data: { bookingId: booking.id, studentId, teacherId, rating, comment },
    });
  }

  for (const teacherId of teacherIds) {
    const agg = await prisma.review.aggregate({
      where: { teacherId },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.teacherProfile.update({
      where: { id: teacherId },
      data: { avgRating: agg._avg.rating ?? 0, reviewCount: agg._count },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
