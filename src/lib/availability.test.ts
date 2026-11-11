// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import {
  addUnavailableDate,
  getAvailabilitySettings,
  getPlanningAvailability,
  removeUnavailableDate,
  saveWeeklyHours,
} from "@/lib/availability";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/planner/availability";

// Runs against the database in DATABASE_URL. Each test makes its own users
// and they're deleted afterwards (rows cascade).
const createdUserIds: string[] = [];

async function createUser() {
  const user = await prisma.user.create({
    data: { email: `availability-${crypto.randomUUID()}@test.local`, passwordHash: "x" },
  });
  createdUserIds.push(user.id);
  return user.id;
}

let userId: string;

beforeEach(async () => {
  userId = await createUser();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("weekly hours", () => {
  test("a new user gets the prefilled defaults, marked as not yet set", async () => {
    const settings = await getAvailabilitySettings(userId);
    expect(settings.weeklyHours).toEqual(DEFAULT_WEEKLY_HOURS);
    expect(settings.isSet).toBe(false);
    expect(settings.unavailableDates).toEqual([]);
  });

  test("saved hours are read back from the database", async () => {
    const hours = { ...DEFAULT_WEEKLY_HOURS, monday: 5.5, sunday: 0 };
    const result = await saveWeeklyHours(userId, hours);
    expect(result.ok).toBe(true);

    const settings = await getAvailabilitySettings(userId);
    expect(settings.weeklyHours).toEqual(hours);
    expect(settings.isSet).toBe(true);
  });

  test("saving again updates the same row", async () => {
    await saveWeeklyHours(userId, DEFAULT_WEEKLY_HOURS);
    await saveWeeklyHours(userId, { ...DEFAULT_WEEKLY_HOURS, friday: 6 });
    expect(await prisma.availability.count({ where: { userId } })).toBe(1);
    expect((await getAvailabilitySettings(userId)).weeklyHours.friday).toBe(6);
  });

  test("invalid hours are rejected with VALIDATION_ERROR and nothing is saved", async () => {
    const result = await saveWeeklyHours(userId, { ...DEFAULT_WEEKLY_HOURS, monday: 13 });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(await prisma.availability.count({ where: { userId } })).toBe(0);
  });
});

describe("unavailable dates", () => {
  test("a marked date is saved with its reason and listed in date order", async () => {
    await addUnavailableDate(userId, { date: "2026-11-25", reason: "Travel" });
    await addUnavailableDate(userId, { date: "2026-11-19" });

    const { unavailableDates } = await getAvailabilitySettings(userId);
    expect(unavailableDates.map(({ date, reason }) => ({ date, reason }))).toEqual([
      { date: "2026-11-19", reason: null },
      { date: "2026-11-25", reason: "Travel" },
    ]);
  });

  test("marking the same date twice is a CONFLICT", async () => {
    await addUnavailableDate(userId, { date: "2026-11-19" });
    const result = await addUnavailableDate(userId, { date: "2026-11-19" });
    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  test("an invalid date is a VALIDATION_ERROR", async () => {
    const result = await addUnavailableDate(userId, { date: "not-a-date" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  test("a user can remove their own date", async () => {
    const added = await addUnavailableDate(userId, { date: "2026-11-19" });
    if (!added.ok) throw new Error("setup failed");
    expect(await removeUnavailableDate(userId, added.value.id)).toBe(true);
    expect((await getAvailabilitySettings(userId)).unavailableDates).toEqual([]);
  });

  test("a user can't see or remove another user's dates", async () => {
    const otherUserId = await createUser();
    const added = await addUnavailableDate(otherUserId, { date: "2026-11-19" });
    if (!added.ok) throw new Error("setup failed");

    expect((await getAvailabilitySettings(userId)).unavailableDates).toEqual([]);
    expect(await removeUnavailableDate(userId, added.value.id)).toBe(false);
    expect((await getAvailabilitySettings(otherUserId)).unavailableDates).toHaveLength(1);
  });
});

describe("getPlanningAvailability", () => {
  test("is null until the user has saved availability, so no plan is generated", async () => {
    expect(await getPlanningAvailability(userId)).toBeNull();
  });

  test("returns the saved hours and unavailable dates once set", async () => {
    await saveWeeklyHours(userId, DEFAULT_WEEKLY_HOURS);
    await addUnavailableDate(userId, { date: "2026-11-21" });
    expect(await getPlanningAvailability(userId)).toEqual({
      weeklyHours: DEFAULT_WEEKLY_HOURS,
      unavailableDates: ["2026-11-21"],
    });
  });
});
