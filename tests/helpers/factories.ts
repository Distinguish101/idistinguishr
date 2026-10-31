import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { ApprovalStatus, BookingStatus, CancelledBy, LessonFormat, Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { utcMidnight } from "./dates";

// Builders for test data. Every call makes a unique user/email, so tests don't
// depend on each other even before the tables are cleared.

/** A password that satisfies the signup rules. */
export const PASSWORD = "Correct-horse-9";

export function hashPassword(password = PASSWORD) {
  return bcrypt.hash(password, 4); // low cost: fast tests, same algorithm
}

/** Empties every table. Refuses to run unless the database is on this machine. */
export async function resetDb() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`resetDb() refuses to run against non-local database host "${host}"`);
  }
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "users", "teacher_profiles" RESTART IDENTITY CASCADE`);
}

let counter = 0;

export async function createUser(
  o: Partial<{
    role: Role;
    email: string;
    fullName: string;
    password: string | null; // null = no password (a Google-only account)
    status: UserStatus;
  }> = {}
) {
  counter++;
  return prisma.user.create({
    data: {
      role: o.role ?? "STUDENT",
      fullName: o.fullName ?? `Test User ${counter}`,
      email: (o.email ?? `user${counter}-${randomUUID().slice(0, 8)}@example.test`).toLowerCase(),
      passwordHash: o.password === null ? null : await hashPassword(o.password ?? PASSWORD),
      status: o.status ?? "ACTIVE",
    },
  });
}

export function createStudent(o: Parameters<typeof createUser>[0] = {}) {
  return createUser({ ...o, role: "STUDENT" });
}

/** An instructor: a TEACHER user plus a profile that is bookable unless overridden. */
export async function createInstructor(
  o: {
    user?: Parameters<typeof createUser>[0];
    bio?: string;
    instruments?: string[];
    hourlyRateMinorUnits?: number;
    formatsOffered?: LessonFormat[];
    locationText?: string | null;
    credentials?: string;
    photoUrl?: string | null;
    approvalStatus?: ApprovalStatus;
    stripeOnboardingComplete?: boolean;
    avgRating?: number;
    reviewCount?: number;
  } = {}
) {
  const user = await createUser({ ...o.user, role: "TEACHER" });
  const profile = await prisma.teacherProfile.create({
    data: {
      userId: user.id,
      bio: o.bio ?? "Experienced teacher with a friendly, structured approach to lessons.",
      instruments: o.instruments ?? ["piano"],
      hourlyRateMinorUnits: o.hourlyRateMinorUnits ?? 4500,
      formatsOffered: o.formatsOffered ?? ["ONLINE"],
      locationText: o.locationText ?? null,
      credentials: o.credentials ?? "ABRSM Grade 8, ten years of teaching",
      photoUrl: o.photoUrl ?? null,
      approvalStatus: o.approvalStatus ?? "APPROVED",
      stripeOnboardingComplete: o.stripeOnboardingComplete ?? true,
      avgRating: o.avgRating ?? 0,
      reviewCount: o.reviewCount ?? 0,
    },
  });
  return { user, profile };
}

export function addRule(teacherId: string, dayOfWeek: number, startTime: string, endTime: string) {
  return prisma.availabilityRule.create({ data: { teacherId, dayOfWeek, startTime, endTime } });
}

export function addException(
  teacherId: string,
  o: { date: string; type: "BLOCKED" | "ADDED"; startTime?: string | null; endTime?: string | null }
) {
  return prisma.availabilityException.create({
    data: {
      teacherId,
      date: utcMidnight(o.date),
      type: o.type,
      startTime: o.startTime ?? null,
      endTime: o.endTime ?? null,
    },
  });
}

export function createBooking(o: {
  studentId: string;
  teacherId: string; // the TeacherProfile id
  date: string;
  startTime?: string;
  durationMinutes?: number;
  status?: BookingStatus;
  format?: LessonFormat;
  priceTotalMinorUnits?: number;
  cancelledBy?: CancelledBy;
  createdAt?: Date;
}) {
  return prisma.booking.create({
    data: {
      studentId: o.studentId,
      teacherId: o.teacherId,
      lessonDate: utcMidnight(o.date),
      startTime: o.startTime ?? "10:00",
      durationMinutes: o.durationMinutes ?? 60,
      format: o.format ?? "ONLINE",
      status: o.status ?? "CONFIRMED",
      priceTotalMinorUnits: o.priceTotalMinorUnits ?? 4500,
      ...(o.cancelledBy ? { cancelledBy: o.cancelledBy, cancelledAt: new Date() } : {}),
      ...(o.createdAt ? { createdAt: o.createdAt } : {}),
    },
  });
}
