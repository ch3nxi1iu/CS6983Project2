// Work-plan data functions for US-07 (#13).
// regeneratePlanForUser replaces SCHEDULED sessions with a fresh plan in one
// transaction. getWorkPlanForUser reads the current week without writing.
// updateEstimatedHours lets users edit hours per assignment.

import { prisma } from "@/lib/db";
import { getPlanningAvailability } from "@/lib/availability";
import { generateWorkPlan } from "@/lib/planner/work-plan";
import type { AtRiskItem, PlannedSession, WorkPlanResult } from "@/lib/planner/work-plan";
import { addDays, dateKeyToDate, toDateKey } from "@/lib/planner/availability";
import type { Result } from "@/lib/planner/availability";

export type RegeneratePlanOk = {
  ok: true;
  sessions: (PlannedSession & { id: string })[];
  atRisk: AtRiskItem[];
};

export type RegeneratePlanFail = {
  ok: false;
  reason: "availability_not_set";
  message: string;
};

export type RegeneratePlanResult = RegeneratePlanOk | RegeneratePlanFail;

export type PlanSessionStatus = "SCHEDULED" | "DONE" | "MISSED";

export type PlanSessionView = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  courseCode: string;
  date: string; // YYYY-MM-DD
  hours: number;
  status: PlanSessionStatus;
};

export type AtRiskView = AtRiskItem & { assignmentTitle: string; courseCode: string };

export type CurrentPlanResult =
  | { ok: true; sessions: PlanSessionView[]; atRisk: AtRiskView[] }
  | RegeneratePlanFail;

/** Unsubmitted assignments of a user, with what the planner and the views need. */
async function loadOpenAssignments(userId: string) {
  return prisma.assignment.findMany({
    where: { course: { userId }, submitted: false },
    select: {
      id: true,
      title: true,
      dueAt: true,
      estimatedHours: true,
      submitted: true,
      kind: true,
      course: { select: { code: true } },
    },
  });
}

type OpenAssignment = Awaited<ReturnType<typeof loadOpenAssignments>>[number];

/**
 * Runs the planner on the user's saved data without writing anything. Both
 * regeneratePlanForUser and getWorkPlanForUser use it, so they see the same inputs.
 */
async function planFromDatabase(
  userId: string,
  now: Date,
): Promise<
  | { ok: true; plan: WorkPlanResult; assignments: OpenAssignment[] }
  | RegeneratePlanFail
> {
  const availability = await getPlanningAvailability(userId);
  if (!availability) {
    return {
      ok: false,
      reason: "availability_not_set",
      message: "Set your study hours first.",
    };
  }

  const assignments = await loadOpenAssignments(userId);
  const plan = generateWorkPlan({
    assignments: assignments.map((a) => ({
      id: a.id,
      dueAt: a.dueAt,
      estimatedHours: a.estimatedHours,
      submitted: a.submitted,
      kind: a.kind,
    })),
    availability,
    now,
  });
  return { ok: true, plan, assignments };
}

/**
 * Recalculates the work plan for a user, replacing all SCHEDULED sessions
 * with fresh ones from generateWorkPlan. DONE and MISSED sessions are kept.
 *
 * Returns `{ ok: false, reason: "availability_not_set" }` when the user has
 * not yet saved their study hours.
 */
export async function regeneratePlanForUser(
  userId: string,
  now: Date,
): Promise<RegeneratePlanResult> {
  const computed = await planFromDatabase(userId, now);
  if (!computed.ok) return computed;

  // Replace SCHEDULED sessions in a single transaction.
  const created = await prisma.$transaction(async (tx) => {
    await tx.workSession.deleteMany({ where: { userId, status: "SCHEDULED" } });
    if (computed.plan.sessions.length === 0) return [];
    return tx.workSession.createManyAndReturn({
      data: computed.plan.sessions.map((s) => ({
        userId,
        assignmentId: s.assignmentId,
        startAt: dateKeyToDate(s.date), // midnight UTC of that day
        hours: s.hours,
        status: "SCHEDULED" as const,
      })),
    });
  });

  return {
    ok: true,
    sessions: created.map((row) => ({
      id: row.id,
      assignmentId: row.assignmentId,
      date: toDateKey(row.startAt),
      hours: row.hours,
    })),
    atRisk: computed.plan.atRisk,
  };
}

/**
 * The user's plan for the 7 days starting today: SCHEDULED, DONE and MISSED
 * sessions, plus at-risk items. Read-only; nothing is written.
 *
 * At-risk items are not stored, so they are recalculated with the same planner
 * as regeneratePlanForUser. They match the saved plan as long as the
 * assignments and study hours have not changed since it was rebuilt.
 */
export async function getWorkPlanForUser(userId: string, now: Date): Promise<CurrentPlanResult> {
  const computed = await planFromDatabase(userId, now);
  if (!computed.ok) return computed;

  const todayKey = toDateKey(now);
  const rows = await prisma.workSession.findMany({
    where: {
      userId,
      startAt: { gte: dateKeyToDate(todayKey), lt: dateKeyToDate(addDays(todayKey, 7)) },
    },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      assignmentId: true,
      startAt: true,
      hours: true,
      status: true,
      assignment: { select: { title: true, course: { select: { code: true } } } },
    },
  });

  const byAssignmentId = new Map(computed.assignments.map((a) => [a.id, a]));
  return {
    ok: true,
    sessions: rows.map((row) => ({
      id: row.id,
      assignmentId: row.assignmentId,
      assignmentTitle: row.assignment.title,
      courseCode: row.assignment.course.code,
      date: toDateKey(row.startAt),
      hours: row.hours,
      status: row.status,
    })),
    atRisk: computed.plan.atRisk.flatMap((item) => {
      const assignment = byAssignmentId.get(item.assignmentId);
      if (!assignment) return [];
      return [
        {
          ...item,
          assignmentTitle: assignment.title,
          courseCode: assignment.course.code,
        },
      ];
    }),
  };
}

/**
 * Updates the estimated hours for a single assignment.
 * Returns NOT_FOUND if the assignment doesn't exist or belongs to another user.
 * Returns VALIDATION_ERROR if `hours` is not a positive finite number.
 */
export async function updateEstimatedHours(
  userId: string,
  assignmentId: string,
  hours: number,
): Promise<Result<{ id: string; estimatedHours: number }>> {
  if (!Number.isFinite(hours) || hours <= 0) {
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Estimated hours must be a positive number." },
    };
  }

  // Verify ownership: the assignment's course must belong to this user.
  const existing = await prisma.assignment.findFirst({
    where: { id: assignmentId, course: { userId } },
    select: { id: true },
  });

  if (!existing) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Assignment not found." },
    };
  }

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { estimatedHours: hours },
    select: { id: true, estimatedHours: true },
  });

  return { ok: true, value: updated };
}
