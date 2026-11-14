// Pure work-plan generator for US-07 (#13): no database, no Date.now().
// Schedules work sessions backwards from each due date, respecting daily
// available hours. Earlier deadlines are scheduled first (placed closest
// to their due date in the backward fill).

import {
  addDays,
  getAvailableHoursForDate,
  toDateKey,
  type WeeklyHours,
} from "@/lib/planner/availability";

export type AssignmentKind = "HOMEWORK" | "PROJECT" | "EXAM" | "READING" | "OTHER";

/** Default estimated hours by assignment kind (AC 1). Used when no estimate is set. */
export const DEFAULT_HOURS_BY_KIND: Record<AssignmentKind, number> = {
  HOMEWORK: 4,
  PROJECT: 10,
  EXAM: 6,
  READING: 2,
  OTHER: 3,
};

export type PlannerAssignment = {
  id: string;
  dueAt: Date;
  /** Hours the user estimated. Null, zero or negative falls back to the kind default. */
  estimatedHours: number | null;
  submitted: boolean;
  kind: AssignmentKind;
};

export type PlannerAvailability = {
  weeklyHours: WeeklyHours;
  unavailableDates: readonly string[];
};

export type WorkPlanOptions = {
  /** Maximum hours in a single session. Default 2. Must be greater than 0. */
  maxSessionHours?: number;
  /** Days before due date to finish work. Default 1. */
  bufferDays?: number;
  /** Hours used when an assignment has no usable estimate. Default DEFAULT_HOURS_BY_KIND. */
  defaultHoursByKind?: Record<AssignmentKind, number>;
};

export type PlannedSession = {
  assignmentId: string;
  date: string; // YYYY-MM-DD
  hours: number;
};

export type AtRiskItem = {
  assignmentId: string;
  hoursShort: number;
};

export type WorkPlanResult = {
  sessions: PlannedSession[];
  atRisk: AtRiskItem[];
};

/** Hour amounts below this are floating-point noise, not work left to do. */
const HOURS_EPSILON = 1e-9;

function resolveHours(
  assignment: PlannerAssignment,
  defaultHoursByKind: Record<AssignmentKind, number>,
): number {
  const { estimatedHours } = assignment;
  if (estimatedHours !== null && Number.isFinite(estimatedHours) && estimatedHours > 0) {
    return estimatedHours;
  }
  return defaultHoursByKind[assignment.kind];
}

/**
 * Generate a work plan from assignments and availability.
 *
 * Algorithm:
 * 1. Filter: only unsubmitted assignments due after today (calendar day of `now`).
 * 2. Sort by ascending due date (earliest deadline first).
 * 3. For each assignment, build a list of days between today and
 *    (dueAt − bufferDays), sorted descending (backward from due date).
 * 4. Fill the assignment's hours into those days, respecting each day's
 *    remaining capacity and maxSessionHours.
 * 5. If hours remain after all days are exhausted, report an atRisk item.
 *
 * "Earliest deadline first" means that when two assignments compete for the
 * same days, the one with the earlier deadline is placed closer to its due
 * date (later in calendar order), so the later-deadline assignment gets
 * pushed to earlier days.
 */
export function generateWorkPlan({
  assignments,
  availability,
  now,
  options = {},
}: {
  assignments: readonly PlannerAssignment[];
  availability: PlannerAvailability;
  now: Date;
  options?: WorkPlanOptions;
}): WorkPlanResult {
  const maxSessionHours = options.maxSessionHours ?? 2;
  const bufferDays = options.bufferDays ?? 1;
  const defaultHoursByKind = options.defaultHoursByKind ?? DEFAULT_HOURS_BY_KIND;

  // A session of zero or negative length would loop forever below.
  if (!(maxSessionHours > 0)) {
    throw new RangeError("maxSessionHours must be greater than 0.");
  }

  const todayKey = toDateKey(now);

  // Filter and sort by ascending due date.
  const eligible = assignments
    .filter((a) => !a.submitted && toDateKey(a.dueAt) > todayKey)
    .slice()
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  // Track remaining capacity per day (key: YYYY-MM-DD → remaining hours).
  const dayRemaining = new Map<string, number>();

  function getRemaining(dateKey: string): number {
    const known = dayRemaining.get(dateKey);
    if (known !== undefined) return known;
    const capacity = getAvailableHoursForDate(
      availability.weeklyHours,
      availability.unavailableDates,
      dateKey,
    );
    dayRemaining.set(dateKey, capacity);
    return capacity;
  }

  function consume(dateKey: string, hours: number) {
    dayRemaining.set(dateKey, getRemaining(dateKey) - hours);
  }

  const sessions: PlannedSession[] = [];
  const atRisk: AtRiskItem[] = [];

  for (const assignment of eligible) {
    const deadlineKey = toDateKey(assignment.dueAt);
    // Schedule up to (deadline − bufferDays), exclusive of due date itself.
    const lastSchedulableKey = addDays(deadlineKey, -bufferDays);

    // Build candidate days from lastSchedulable back to today, descending.
    const candidateDays: string[] = [];
    let cursor = lastSchedulableKey;
    while (cursor >= todayKey) {
      candidateDays.push(cursor);
      cursor = addDays(cursor, -1);
    }
    // candidateDays is now descending (closest to due date first).

    let hoursLeft = resolveHours(assignment, defaultHoursByKind);

    for (const day of candidateDays) {
      if (hoursLeft <= HOURS_EPSILON) break;
      const available = getRemaining(day);
      if (available <= HOURS_EPSILON) continue;

      // Split into sessions no longer than maxSessionHours.
      const toSchedule = Math.min(hoursLeft, available);
      let scheduled = 0;
      while (toSchedule - scheduled > HOURS_EPSILON) {
        const sessionHours = Math.min(maxSessionHours, toSchedule - scheduled);
        sessions.push({ assignmentId: assignment.id, date: day, hours: sessionHours });
        scheduled += sessionHours;
      }
      consume(day, toSchedule);
      hoursLeft -= toSchedule;
    }

    if (hoursLeft > HOURS_EPSILON) {
      atRisk.push({ assignmentId: assignment.id, hoursShort: hoursLeft });
    }
  }

  return { sessions, atRisk };
}
