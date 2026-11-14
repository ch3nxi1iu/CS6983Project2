// Data for the public API routes (US-12, #18). Every query filters by userId so
// one user can never read or change another user's rows. The planner and
// forecast are reused from work-plan.ts and forecast.ts, not reimplemented.
import { prisma } from "@/lib/db";
import { getWorkPlanForUser, type PlanSessionView } from "@/lib/work-plan";
import type { AssignmentKind } from "@/lib/planner/work-plan";
import { toDateKey } from "@/lib/planner/availability";
import type { Result } from "@/lib/planner/availability";

export type OpenTaskView = {
  id: string;
  title: string;
  courseCode: string;
  dueAt: Date;
  estimatedHours: number;
  kind: AssignmentKind;
};

/** The user's unsubmitted assignments, soonest due first. */
export async function getOpenTasksForUser(userId: string): Promise<OpenTaskView[]> {
  const rows = await prisma.assignment.findMany({
    where: { course: { userId }, submitted: false },
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      title: true,
      dueAt: true,
      estimatedHours: true,
      kind: true,
      course: { select: { code: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    courseCode: row.course.code,
    dueAt: row.dueAt,
    estimatedHours: row.estimatedHours,
    kind: row.kind,
  }));
}

/**
 * The sessions scheduled for today (UTC calendar day), from the stored plan.
 * Fails with AVAILABILITY_NOT_SET until the user has saved study hours, the
 * same as /api/plan.
 */
export async function getTodaySessionsForUser(
  userId: string,
  now: Date,
): Promise<Result<{ date: string; sessions: PlanSessionView[] }>> {
  const plan = await getWorkPlanForUser(userId, now);
  if (!plan.ok) {
    return { ok: false, error: { code: "AVAILABILITY_NOT_SET", message: plan.message } };
  }
  const date = toDateKey(now);
  return { ok: true, value: { date, sessions: plan.sessions.filter((s) => s.date === date) } };
}

/**
 * Marks one of the user's work sessions DONE. Returns null when the session does
 * not exist or belongs to another user. Re-planning is left to #14.
 */
export async function completeWorkSessionForUser(
  userId: string,
  sessionId: string,
): Promise<PlanSessionView | null> {
  const { count } = await prisma.workSession.updateMany({
    where: { id: sessionId, userId },
    data: { status: "DONE" },
  });
  if (count === 0) return null;

  const row = await prisma.workSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      assignmentId: true,
      startAt: true,
      hours: true,
      status: true,
      assignment: { select: { title: true, course: { select: { code: true } } } },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    assignmentId: row.assignmentId,
    assignmentTitle: row.assignment.title,
    courseCode: row.assignment.course.code,
    date: toDateKey(row.startAt),
    hours: row.hours,
    status: row.status,
  };
}
