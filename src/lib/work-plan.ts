// Work-plan data functions for US-07 (#13).
// regeneratePlanForUser replaces SCHEDULED sessions with a fresh plan in one
// transaction. updateEstimatedHours lets users edit hours per assignment.

import { prisma } from "@/lib/db";
import { getPlanningAvailability } from "@/lib/availability";
import { generateWorkPlan } from "@/lib/planner/work-plan";
import { dateKeyToDate, toDateKey } from "@/lib/planner/availability";
import type { AtRiskItem, PlannedSession } from "@/lib/planner/work-plan";
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
  const availability = await getPlanningAvailability(userId);
  if (!availability) {
    return {
      ok: false,
      reason: "availability_not_set",
      message: "Set your study hours first.",
    };
  }

  const assignments = await prisma.assignment.findMany({
    where: { course: { userId }, submitted: false },
    select: { id: true, dueAt: true, estimatedHours: true, submitted: true, kind: true },
  });

  const { sessions: planned, atRisk } = generateWorkPlan({
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

  // Replace SCHEDULED sessions in a single transaction.
  const created = await prisma.$transaction(async (tx) => {
    await tx.workSession.deleteMany({ where: { userId, status: "SCHEDULED" } });
    if (planned.length === 0) return [];
    return tx.workSession.createManyAndReturn({
      data: planned.map((s) => ({
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
    atRisk,
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
