// Adding your own assignments (US-14, #20). Until Canvas sync exists this is
// the only way a real account gets work to plan. Every query filters by userId.
import { prisma } from "@/lib/db";
import type { AssignmentKind } from "@/lib/planner/work-plan";
import { toDateKey, type Result } from "@/lib/planner/availability";

const KINDS: readonly AssignmentKind[] = ["HOMEWORK", "PROJECT", "EXAM", "READING", "OTHER"];
const MAX_COURSE_CODE = 20;
const MAX_TITLE = 120;
const MAX_HOURS = 100;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export type NewAssignment = {
  courseCode: string;
  title: string;
  /** The due date, YYYY-MM-DD. The assignment is due at 23:59 UTC that day. */
  dueDate: string;
  estimatedHours: number;
  kind: AssignmentKind;
};

export type AddedAssignment = {
  id: string;
  title: string;
  courseCode: string;
  dueAt: Date;
  estimatedHours: number;
  kind: AssignmentKind;
};

function invalid(message: string): Result<never> {
  return { ok: false, error: { code: "VALIDATION_ERROR", message } };
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Checks a new assignment from a request body; the body is never trusted. */
export function parseNewAssignment(input: unknown): Result<NewAssignment> {
  if (typeof input !== "object" || input === null) {
    return invalid("Send the assignment as a JSON object.");
  }
  const body = input as Record<string, unknown>;

  const courseCode = trimmed(body.courseCode);
  if (courseCode.length === 0 || courseCode.length > MAX_COURSE_CODE) {
    return invalid(`Give the course a code of 1 to ${MAX_COURSE_CODE} characters, like CS 6983.`);
  }
  const title = trimmed(body.title);
  if (title.length === 0 || title.length > MAX_TITLE) {
    return invalid(`Give the assignment a title of 1 to ${MAX_TITLE} characters.`);
  }
  const dueDate = trimmed(body.dueDate);
  // A date like 2026-02-30 parses to another day, so it must round-trip.
  if (!DATE_KEY.test(dueDate) || toDateKey(new Date(`${dueDate}T00:00:00Z`)) !== dueDate) {
    return invalid("Pick a real due date.");
  }
  const { estimatedHours } = body;
  if (
    typeof estimatedHours !== "number" ||
    !Number.isFinite(estimatedHours) ||
    estimatedHours <= 0 ||
    estimatedHours > MAX_HOURS
  ) {
    return invalid(`Give the hours as more than 0 and at most ${MAX_HOURS}.`);
  }
  const kind = body.kind === undefined ? "OTHER" : body.kind;
  if (!KINDS.includes(kind as AssignmentKind)) {
    return invalid("Pick a kind: homework, project, exam, reading or other.");
  }

  return {
    ok: true,
    value: { courseCode, title, dueDate, estimatedHours, kind: kind as AssignmentKind },
  };
}

/**
 * Saves a new assignment for the user, in their course with that code (made if
 * it doesn't exist yet). The caller rebuilds the plan afterwards.
 */
export async function createAssignmentForUser(
  userId: string,
  input: unknown,
): Promise<Result<AddedAssignment>> {
  const parsed = parseNewAssignment(input);
  if (!parsed.ok) return parsed;
  const { courseCode, title, dueDate, estimatedHours, kind } = parsed.value;

  const course = await prisma.course.upsert({
    where: { userId_code: { userId, code: courseCode } },
    create: { userId, code: courseCode, name: courseCode },
    update: {},
  });
  const row = await prisma.assignment.create({
    data: {
      courseId: course.id,
      title,
      // 23:59 UTC keeps the same calendar date in US time zones.
      dueAt: new Date(`${dueDate}T23:59:00Z`),
      estimatedHours,
      kind,
    },
  });
  return {
    ok: true,
    value: {
      id: row.id,
      title: row.title,
      courseCode: course.code,
      dueAt: row.dueAt,
      estimatedHours: row.estimatedHours,
      kind: row.kind,
    },
  };
}
