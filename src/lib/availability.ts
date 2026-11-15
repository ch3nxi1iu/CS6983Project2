import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  DEFAULT_WEEKLY_HOURS,
  WEEKDAYS,
  dateKeyToDate,
  parseUnavailableDateInput,
  parseWeeklyHours,
  toDateKey,
  type Result,
  type WeeklyHours,
} from "@/lib/planner/availability";

// Reads and writes a user's availability (US-06, #12). Every query filters by
// userId so one user can never read or change another user's rows.
//
// The forecast (#11) reads availability fresh on every request. The work plan
// (#13) is stored, so the availability routes rebuild it after each change
// here (#45). That's done in the routes, not here, because work-plan.ts
// already imports this file.

export type UnavailableDateItem = { id: string; date: string; reason: string | null };

export type AvailabilitySettings = {
  weeklyHours: WeeklyHours;
  /** False until the user saves hours; the UI shows the prefilled defaults. */
  isSet: boolean;
  unavailableDates: UnavailableDateItem[];
};

function toWeeklyHours(row: Record<(typeof WEEKDAYS)[number], number>): WeeklyHours {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, row[day]])) as WeeklyHours;
}

async function listUnavailableDates(userId: string): Promise<UnavailableDateItem[]> {
  const rows = await prisma.unavailableDate.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });
  return rows.map((row) => ({ id: row.id, date: toDateKey(row.date), reason: row.reason }));
}

export async function getAvailabilitySettings(userId: string): Promise<AvailabilitySettings> {
  const [row, unavailableDates] = await Promise.all([
    prisma.availability.findUnique({ where: { userId } }),
    listUnavailableDates(userId),
  ]);
  return {
    weeklyHours: row ? toWeeklyHours(row) : { ...DEFAULT_WEEKLY_HOURS },
    isSet: row !== null,
    unavailableDates,
  };
}

export async function saveWeeklyHours(
  userId: string,
  input: unknown,
): Promise<Result<WeeklyHours>> {
  const parsed = parseWeeklyHours(input);
  if (!parsed.ok) return parsed;
  const row = await prisma.availability.upsert({
    where: { userId },
    create: { userId, ...parsed.value },
    update: parsed.value,
  });
  return { ok: true, value: toWeeklyHours(row) };
}

export async function addUnavailableDate(
  userId: string,
  input: unknown,
): Promise<Result<UnavailableDateItem>> {
  const parsed = parseUnavailableDateInput(input);
  if (!parsed.ok) return parsed;
  try {
    const row = await prisma.unavailableDate.create({
      data: { userId, date: dateKeyToDate(parsed.value.date), reason: parsed.value.reason },
    });
    return { ok: true, value: { id: row.id, date: toDateKey(row.date), reason: row.reason } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: { code: "CONFLICT", message: "That date is already marked unavailable." },
      };
    }
    throw error;
  }
}

/** Returns false when the date doesn't exist or belongs to someone else. */
export async function removeUnavailableDate(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.unavailableDate.deleteMany({ where: { id, userId } });
  return count > 0;
}

/**
 * Availability for the planner (#13). Null until the user has saved their
 * hours: a plan is only generated once availability is set.
 */
export async function getPlanningAvailability(
  userId: string,
): Promise<{ weeklyHours: WeeklyHours; unavailableDates: string[] } | null> {
  const settings = await getAvailabilitySettings(userId);
  if (!settings.isSet) return null;
  return {
    weeklyHours: settings.weeklyHours,
    unavailableDates: settings.unavailableDates.map((item) => item.date),
  };
}
