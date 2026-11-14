// Shared database helpers for the work-plan route and page tests (US-07, #13).
// Each test file creates its own users and deletes them in afterAll. Deleting
// a user cascades to their courses, assignments and work sessions.
import { prisma } from "@/lib/db";
import { addDays, toDateKey, type WeeklyHours } from "@/lib/planner/availability";

export const STUDY_4H_EVERY_DAY: WeeklyHours = {
  monday: 4,
  tuesday: 4,
  wednesday: 4,
  thursday: 4,
  friday: 4,
  saturday: 4,
  sunday: 4,
};

export const NO_STUDY_HOURS: WeeklyHours = {
  monday: 0,
  tuesday: 0,
  wednesday: 0,
  thursday: 0,
  friday: 0,
  saturday: 0,
  sunday: 0,
};

/** 23:59 UTC on the day `days` after today. */
export function dueInDays(days: number): Date {
  return new Date(`${addDays(toDateKey(new Date()), days)}T23:59:00Z`);
}

/** Midnight UTC on the day `days` after today, the way sessions are stored. */
export function startOfDayInDays(days: number): Date {
  return new Date(`${addDays(toDateKey(new Date()), days)}T00:00:00Z`);
}

export async function createTestUser(): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `work-plan-${crypto.randomUUID()}@test.local`, passwordHash: "dummy-hash" },
  });
  return user.id;
}

export async function setStudyHours(
  userId: string,
  weeklyHours: WeeklyHours = STUDY_4H_EVERY_DAY,
): Promise<void> {
  await prisma.availability.create({ data: { userId, ...weeklyHours } });
}

export async function createAssignment(
  userId: string,
  input: { courseCode: string; title: string; dueAt: Date; estimatedHours: number },
) {
  const course = await prisma.course.upsert({
    where: { userId_code: { userId, code: input.courseCode } },
    create: { userId, code: input.courseCode, name: input.courseCode },
    update: {},
  });
  return prisma.assignment.create({
    data: {
      courseId: course.id,
      title: input.title,
      dueAt: input.dueAt,
      estimatedHours: input.estimatedHours,
    },
  });
}

export async function deleteTestUsers(userIds: string[]): Promise<void> {
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}
