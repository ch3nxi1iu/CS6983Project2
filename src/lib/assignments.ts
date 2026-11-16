// Adding, listing, editing and deleting your own assignments (US-14, #20).
// Until Canvas sync exists this is the only way a real account gets work to
// plan. Every query filters by userId.
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

/** What an edit may change; only the fields that were sent. The course stays. */
export type AssignmentChanges = {
  title?: string;
  /** The due date, YYYY-MM-DD, due at 23:59 UTC like a new assignment. */
  dueDate?: string;
  estimatedHours?: number;
};

/** The id plus the fields an edit saved. */
export type UpdatedAssignment = {
  id: string;
  title?: string;
  dueAt?: Date;
  estimatedHours?: number;
};

/** One row of the user's assignment list, with the hours of DONE sessions. */
export type AssignmentListItem = {
  id: string;
  title: string;
  courseCode: string;
  dueAt: Date;
  estimatedHours: number;
  doneHours: number;
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

// Field checks shared by adding (POST) and editing (PATCH) an assignment.

function parseTitle(value: unknown): Result<string> {
  const title = trimmed(value);
  if (title.length === 0 || title.length > MAX_TITLE) {
    return invalid(`Give the assignment a title of 1 to ${MAX_TITLE} characters.`);
  }
  return { ok: true, value: title };
}

function parseDueDate(value: unknown): Result<string> {
  const dueDate = trimmed(value);
  // A date like 2026-02-30 parses to another day, so it must round-trip.
  if (!DATE_KEY.test(dueDate) || toDateKey(new Date(`${dueDate}T00:00:00Z`)) !== dueDate) {
    return invalid("Pick a real due date.");
  }
  return { ok: true, value: dueDate };
}

function parseEstimatedHours(value: unknown): Result<number> {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_HOURS) {
    return invalid(`Give the hours as more than 0 and at most ${MAX_HOURS}.`);
  }
  return { ok: true, value };
}

/** A due date (YYYY-MM-DD) as the moment it is due: 23:59 UTC that day. */
function dueDateToDueAt(dueDate: string): Date {
  // 23:59 UTC keeps the same calendar date in US time zones.
  return new Date(`${dueDate}T23:59:00Z`);
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
  const title = parseTitle(body.title);
  if (!title.ok) return title;
  const dueDate = parseDueDate(body.dueDate);
  if (!dueDate.ok) return dueDate;
  const estimatedHours = parseEstimatedHours(body.estimatedHours);
  if (!estimatedHours.ok) return estimatedHours;
  const kind = body.kind === undefined ? "OTHER" : body.kind;
  if (!KINDS.includes(kind as AssignmentKind)) {
    return invalid("Pick a kind: homework, project, exam, reading or other.");
  }

  return {
    ok: true,
    value: {
      courseCode,
      title: title.value,
      dueDate: dueDate.value,
      estimatedHours: estimatedHours.value,
      kind: kind as AssignmentKind,
    },
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
      dueAt: dueDateToDueAt(dueDate),
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

/**
 * Checks an edit from a request body. Any of title, dueDate and estimatedHours
 * may be sent, with the same rules as a new assignment; at least one is needed.
 * Other fields (course, kind) are ignored.
 */
export function parseAssignmentChanges(input: unknown): Result<AssignmentChanges> {
  if (typeof input !== "object" || input === null) {
    return invalid("Send the changes as a JSON object.");
  }
  const body = input as Record<string, unknown>;
  const changes: AssignmentChanges = {};

  if ("title" in body) {
    const title = parseTitle(body.title);
    if (!title.ok) return title;
    changes.title = title.value;
  }
  if ("dueDate" in body) {
    const dueDate = parseDueDate(body.dueDate);
    if (!dueDate.ok) return dueDate;
    changes.dueDate = dueDate.value;
  }
  if ("estimatedHours" in body) {
    const estimatedHours = parseEstimatedHours(body.estimatedHours);
    if (!estimatedHours.ok) return estimatedHours;
    changes.estimatedHours = estimatedHours.value;
  }

  if (Object.keys(changes).length === 0) {
    return invalid("Send a new title, dueDate or estimatedHours.");
  }
  return { ok: true, value: changes };
}

const NOT_FOUND = { ok: false, error: { code: "NOT_FOUND", message: "Assignment not found." } } as const;

/**
 * Saves an edit to one of the user's assignments. Returns NOT_FOUND when the
 * assignment doesn't exist or belongs to another user. The caller rebuilds the
 * plan afterwards.
 */
export async function updateAssignmentForUser(
  userId: string,
  assignmentId: string,
  input: unknown,
): Promise<Result<UpdatedAssignment>> {
  const parsed = parseAssignmentChanges(input);
  if (!parsed.ok) return parsed;
  const { title, dueDate, estimatedHours } = parsed.value;

  const existing = await prisma.assignment.findFirst({
    where: { id: assignmentId, course: { userId } },
    select: { id: true },
  });
  if (!existing) return NOT_FOUND;

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      title,
      dueAt: dueDate === undefined ? undefined : dueDateToDueAt(dueDate),
      estimatedHours,
    },
    // Return only what was changed, so a PATCH of { estimatedHours } still
    // answers { id, estimatedHours } as it did before (#13).
    select: {
      id: true,
      title: title !== undefined,
      dueAt: dueDate !== undefined,
      estimatedHours: estimatedHours !== undefined,
    },
  });
  return { ok: true, value: updated };
}

/**
 * Deletes one of the user's assignments; its work sessions go with it (the
 * database cascades). Returns false when it doesn't exist or belongs to
 * another user. The caller rebuilds the plan afterwards.
 */
export async function deleteAssignmentForUser(
  userId: string,
  assignmentId: string,
): Promise<boolean> {
  const { count } = await prisma.assignment.deleteMany({
    where: { id: assignmentId, course: { userId } },
  });
  return count > 0;
}

/** The user's unsubmitted assignments, soonest due first, with hours done so far. */
export async function listAssignmentsForUser(userId: string): Promise<AssignmentListItem[]> {
  const rows = await prisma.assignment.findMany({
    where: { course: { userId }, submitted: false },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      dueAt: true,
      estimatedHours: true,
      course: { select: { code: true } },
      workSessions: { where: { status: "DONE" }, select: { hours: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    courseCode: row.course.code,
    dueAt: row.dueAt,
    estimatedHours: row.estimatedHours,
    doneHours: row.workSessions.reduce((sum, session) => sum + session.hours, 0),
  }));
}
