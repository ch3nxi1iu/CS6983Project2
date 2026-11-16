// Today's top priorities for US-09 (#15). Pure: the caller passes in today's
// date key and the time zone, so nothing here reads the clock or the database.
//
// Ranking: more points first (no points counts as 0), then the sooner due
// date, then the title, then the session id so the order is always the same.

import { dateKeyToDate } from "@/lib/planner/availability";
import { toLocalDateKey } from "@/lib/planner/forecast";

/** How many sessions the dashboard shows as today's top priorities. */
export const TOP_PRIORITY_COUNT = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The parts of a work session that ranking needs. */
export type PrioritySession = {
  id: string;
  assignmentTitle: string;
  status: "SCHEDULED" | "DONE" | "MISSED";
};

/** A session with its assignment's points and due date. */
export type PriorityCandidate<T extends PrioritySession> = {
  session: T;
  points: number | null;
  dueAt: Date;
};

export type RankedPriority<T extends PrioritySession> = {
  session: T;
  /** One line that says why it matters, e.g. "Worth 100 points, due in 3 days". */
  reason: string;
};

/**
 * Whole days from today to the day the work is due, counted in `timeZone`.
 * 0 means due today; a negative number means the due date has passed.
 */
export function getDaysUntilDue(dueAt: Date, todayKey: string, timeZone: string): number {
  const dueKey = toLocalDateKey(dueAt, timeZone);
  const diff = dateKeyToDate(dueKey).getTime() - dateKeyToDate(todayKey).getTime();
  return Math.round(diff / MS_PER_DAY);
}

function formatPoints(points: number): string {
  const value = String(Number(points.toFixed(2)));
  return points === 1 ? `${value} point` : `${value} points`;
}

function describeDue(daysUntilDue: number): string {
  if (daysUntilDue === 0) return "due today";
  if (daysUntilDue === 1) return "due tomorrow";
  if (daysUntilDue > 1) return `due in ${daysUntilDue} days`;
  if (daysUntilDue === -1) return "was due yesterday";
  return `was due ${-daysUntilDue} days ago`;
}

/** "Worth 40 points, due today", or "Due tomorrow" when there are no points. */
export function getPriorityReason(points: number | null, daysUntilDue: number): string {
  const due = describeDue(daysUntilDue);
  if (points === null || points <= 0) {
    return due.charAt(0).toUpperCase() + due.slice(1);
  }
  return `Worth ${formatPoints(points)}, ${due}`;
}

function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Today's sessions that are still SCHEDULED, most important first, each with a
 * one-line reason. DONE and MISSED sessions are left out. Returns every
 * scheduled session; the caller shows the first TOP_PRIORITY_COUNT.
 */
export function rankTodaysSessions<T extends PrioritySession>(
  candidates: readonly PriorityCandidate<T>[],
  todayKey: string,
  timeZone: string,
): RankedPriority<T>[] {
  return candidates
    .filter((candidate) => candidate.session.status === "SCHEDULED")
    .map((candidate) => ({
      ...candidate,
      daysUntilDue: getDaysUntilDue(candidate.dueAt, todayKey, timeZone),
    }))
    .sort(
      (a, b) =>
        (b.points ?? 0) - (a.points ?? 0) ||
        a.daysUntilDue - b.daysUntilDue ||
        a.session.assignmentTitle.localeCompare(b.session.assignmentTitle, "en") ||
        compareIds(a.session.id, b.session.id),
    )
    .map((item) => ({
      session: item.session,
      reason: getPriorityReason(item.points, item.daysUntilDue),
    }));
}
