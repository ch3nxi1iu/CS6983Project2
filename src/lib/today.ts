// Data for today's top priorities on the dashboard (US-09, #15). The ranking
// itself is pure and lives in src/lib/planner/priorities.ts.

import { prisma } from "@/lib/db";
import type { PriorityCandidate, PrioritySession } from "@/lib/planner/priorities";

/**
 * Adds each session's assignment points and due date, so the sessions can be
 * ranked. Only the user's own assignments are read; a session whose assignment
 * isn't theirs (or no longer exists) is left out.
 */
export async function getSessionsWithDeadlines<T extends PrioritySession & { assignmentId: string }>(
  userId: string,
  sessions: readonly T[],
): Promise<PriorityCandidate<T>[]> {
  if (sessions.length === 0) return [];

  const assignmentIds = [...new Set(sessions.map((session) => session.assignmentId))];
  const rows = await prisma.assignment.findMany({
    where: { id: { in: assignmentIds }, course: { userId } },
    select: { id: true, points: true, dueAt: true },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  return sessions.flatMap((session) => {
    const assignment = byId.get(session.assignmentId);
    if (!assignment) return [];
    return [{ session, points: assignment.points, dueAt: assignment.dueAt }];
  });
}
