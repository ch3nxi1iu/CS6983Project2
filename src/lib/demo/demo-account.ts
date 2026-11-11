import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { dateKeyToDate } from "@/lib/planner/availability";
import { buildDemoData } from "@/lib/demo/seed-data";

// Demo accounts for US-04 (#10). Each visitor gets their own account, marked
// isDemo, so demo data is isolated from real users and from other visitors.
// Demo accounts have no usable password; they're only reached through
// "Try the demo".
// TODO(#7): sign the visitor in to the new account once auth exists.

/** Not a valid password hash, so nobody can log in to a demo account with a password. */
const NO_PASSWORD = "!demo-account";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function seed(tx: Tx, userId: string, now: Date) {
  const data = buildDemoData(now);
  await tx.availability.create({ data: { userId, ...data.weeklyHours } });
  await tx.unavailableDate.createMany({
    data: data.unavailableDates.map((item) => ({
      userId,
      date: dateKeyToDate(item.date),
      reason: item.reason,
    })),
  });
  for (const course of data.courses) {
    await tx.course.create({
      data: {
        userId,
        code: course.code,
        name: course.name,
        assignments: { create: course.assignments },
      },
    });
  }
}

/** Creates a new demo user with the seed data and returns its id. */
export async function createDemoAccount(now: Date): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `demo-${randomUUID()}@demo.invalid`,
        name: "Demo student",
        passwordHash: NO_PASSWORD,
        isDemo: true,
      },
    });
    await seed(tx, user.id, now);
    return user.id;
  });
}

/**
 * Puts a demo account back to the seed data. Returns false, and changes
 * nothing, if the user doesn't exist or isn't a demo account.
 */
export async function resetDemoAccount(userId: string, now: Date): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { isDemo: true } });
    if (!user?.isDemo) return false;

    // Work sessions and assignments cascade from courses.
    await tx.workSession.deleteMany({ where: { userId } });
    await tx.course.deleteMany({ where: { userId } });
    await tx.unavailableDate.deleteMany({ where: { userId } });
    await tx.availability.deleteMany({ where: { userId } });
    await seed(tx, userId, now);
    return true;
  });
}
