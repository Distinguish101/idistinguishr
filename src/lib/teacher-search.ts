import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUpcomingAvailability } from "@/lib/availability";

// Bookable requires both approval and completed Stripe onboarding — see
// data-model.md. Stripe onboarding isn't built yet (that's a later step),
// so nothing will actually show up in search until either a teacher goes
// through it for real, or stripeOnboardingComplete is flipped manually for
// testing (same manual-approval pattern the MVP already uses for
// approvalStatus per US-30).
export const BOOKABLE_WHERE = {
  approvalStatus: "APPROVED",
  stripeOnboardingComplete: true,
} satisfies Prisma.TeacherProfileWhereInput;

export type ResultsFilters = {
  instrument?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  formats?: ("ONLINE" | "IN_PERSON")[];
  availableThisWeek?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "rating" | "soonest";
  page?: number;
};

const PAGE_SIZE = 12;

function buildWhere(filters: ResultsFilters): Prisma.TeacherProfileWhereInput {
  const where: Prisma.TeacherProfileWhereInput = { ...BOOKABLE_WHERE };

  if (filters.instrument) where.instruments = { has: filters.instrument };

  const formats = new Set(filters.formats ?? []);
  let locationText: string | null = null;
  if (filters.location) {
    const loc = filters.location.trim();
    if (loc.toLowerCase() === "online") {
      formats.add("ONLINE");
    } else if (loc) {
      locationText = loc;
    }
  }
  if (formats.size > 0) where.formatsOffered = { hasSome: Array.from(formats) };
  if (locationText) where.locationText = { contains: locationText, mode: "insensitive" };

  if (filters.minPrice != null || filters.maxPrice != null) {
    where.hourlyRateMinorUnits = {
      ...(filters.minPrice != null ? { gte: Math.round(filters.minPrice * 100) } : {}),
      ...(filters.maxPrice != null ? { lte: Math.round(filters.maxPrice * 100) } : {}),
    };
  }
  if (filters.minRating != null) where.avgRating = { gte: filters.minRating };

  return where;
}

function buildOrderBy(sort?: ResultsFilters["sort"]): Prisma.TeacherProfileOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ hourlyRateMinorUnits: "asc" }];
    case "price_desc":
      return [{ hourlyRateMinorUnits: "desc" }];
    case "rating":
      return [{ avgRating: "desc" }, { reviewCount: "desc" }];
    default:
      // No real relevance engine — top-rated first is a reasonable default.
      return [{ avgRating: "desc" }, { reviewCount: "desc" }];
  }
}

const withTeacherName = { user: { select: { fullName: true as const } } };

export async function searchTeachers(filters: ResultsFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const where = buildWhere(filters);
  const needsAvailability = filters.sort === "soonest" || filters.availableThisWeek;

  if (!needsAvailability) {
    const [total, teachers] = await Promise.all([
      prisma.teacherProfile.count({ where }),
      prisma.teacherProfile.findMany({
        where,
        orderBy: buildOrderBy(filters.sort),
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: withTeacherName,
      }),
    ]);
    return { teachers, total, page, pageSize: PAGE_SIZE };
  }

  // Availability isn't a DB column, so sorting/filtering by it means
  // pulling a bounded candidate pool and computing in JS, then paginating
  // in memory. Fine at MVP scale — move to a precomputed "next available
  // date" column, recalculated when a teacher's availability changes, if
  // the teacher count ever makes this pool too small or too slow.
  const CANDIDATE_CAP = 100;
  const candidates = await prisma.teacherProfile.findMany({
    where,
    orderBy: buildOrderBy(filters.sort === "soonest" ? undefined : filters.sort),
    take: CANDIDATE_CAP,
    include: withTeacherName,
  });

  const withAvailability = await Promise.all(
    candidates.map(async (t) => {
      const windows = await getUpcomingAvailability(t.id, 7);
      return { teacher: t, earliestDate: windows[0]?.date ?? null, hasWindowThisWeek: windows.length > 0 };
    })
  );

  let filtered = withAvailability;
  if (filters.availableThisWeek) {
    filtered = filtered.filter((r) => r.hasWindowThisWeek);
  }
  if (filters.sort === "soonest") {
    filtered = filtered
      .filter((r) => r.earliestDate)
      .sort((a, b) => a.earliestDate!.localeCompare(b.earliestDate!));
  }

  const total = filtered.length;
  const teachers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => r.teacher);
  return { teachers, total, page, pageSize: PAGE_SIZE };
}

export async function getInstrumentOptions(): Promise<string[]> {
  const profiles = await prisma.teacherProfile.findMany({
    where: BOOKABLE_WHERE,
    select: { instruments: true },
  });
  const set = new Set<string>();
  profiles.forEach((p) => p.instruments.forEach((i) => set.add(i)));
  return Array.from(set).sort();
}

export async function getFeaturedTeachers(limit = 3) {
  return prisma.teacherProfile.findMany({
    where: BOOKABLE_WHERE,
    orderBy: [{ avgRating: "desc" }, { reviewCount: "desc" }],
    take: limit,
    include: withTeacherName,
  });
}
