// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import {
  createAssignmentForUser,
  deleteAssignmentForUser,
  listAssignmentsForUser,
  parseAssignmentChanges,
  parseNewAssignment,
  updateAssignmentForUser,
} from "@/lib/assignments";
import { createAssignment, createTestUser, dueInDays } from "@/test/work-plan-fixtures";

// Adding, listing, editing and deleting your own assignments (US-14, #20), so
// a real account isn't empty until Canvas sync exists.

const createdUserIds: string[] = [];

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

async function newUser(): Promise<string> {
  const id = await createTestUser();
  createdUserIds.push(id);
  return id;
}

const valid = {
  courseCode: " CS 6983 ",
  title: " Final reflection ",
  dueDate: "2026-11-20",
  estimatedHours: 2.5,
  kind: "HOMEWORK",
};

describe("parseNewAssignment", () => {
  test("trims the text fields and keeps the rest", () => {
    const result = parseNewAssignment(valid);
    expect(result).toEqual({
      ok: true,
      value: {
        courseCode: "CS 6983",
        title: "Final reflection",
        dueDate: "2026-11-20",
        estimatedHours: 2.5,
        kind: "HOMEWORK",
      },
    });
  });

  test("uses OTHER when no kind is given", () => {
    const { kind, ...withoutKind } = valid;
    void kind;
    const result = parseNewAssignment(withoutKind);
    expect(result.ok && result.value.kind).toBe("OTHER");
  });

  test.each([
    ["a body that isn't an object", null],
    ["an empty course", { ...valid, courseCode: "  " }],
    ["a course longer than 20 characters", { ...valid, courseCode: "C".repeat(21) }],
    ["an empty title", { ...valid, title: "" }],
    ["a title longer than 120 characters", { ...valid, title: "T".repeat(121) }],
    ["a due date that isn't YYYY-MM-DD", { ...valid, dueDate: "11/20/2026" }],
    ["a due date that doesn't exist", { ...valid, dueDate: "2026-02-30" }],
    ["zero hours", { ...valid, estimatedHours: 0 }],
    ["more than 100 hours", { ...valid, estimatedHours: 101 }],
    ["hours sent as text", { ...valid, estimatedHours: "3" }],
    ["an unknown kind", { ...valid, kind: "QUIZ" }],
  ])("rejects %s with VALIDATION_ERROR", (_label, input) => {
    const result = parseNewAssignment(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("createAssignmentForUser", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `add-assignment-${crypto.randomUUID()}@test.local`, passwordHash: "x" },
    });
    createdUserIds.push(user.id);
    userId = user.id;
  });

  test("saves the assignment, due at the end of that day, under a new course", async () => {
    const result = await createAssignmentForUser(userId, valid);

    if (!result.ok) throw new Error(result.error.message);
    const row = await prisma.assignment.findUniqueOrThrow({
      where: { id: result.value.id },
      include: { course: true },
    });
    expect(row.course.userId).toBe(userId);
    expect(row.course.code).toBe("CS 6983");
    expect(row.title).toBe("Final reflection");
    expect(row.dueAt.toISOString()).toBe("2026-11-20T23:59:00.000Z");
    expect(row.estimatedHours).toBe(2.5);
    expect(row.kind).toBe("HOMEWORK");
    expect(row.submitted).toBe(false);
  });

  test("adds to the user's existing course with the same code", async () => {
    await createAssignmentForUser(userId, valid);
    await createAssignmentForUser(userId, { ...valid, title: "Second" });

    expect(await prisma.course.count({ where: { userId } })).toBe(1);
    expect(await prisma.assignment.count({ where: { course: { userId } } })).toBe(2);
  });

  test("saves nothing when the input is invalid", async () => {
    const result = await createAssignmentForUser(userId, { ...valid, title: "" });

    expect(result.ok).toBe(false);
    expect(await prisma.course.count({ where: { userId } })).toBe(0);
  });
});

describe("parseAssignmentChanges", () => {
  test("keeps only the fields that were sent, trimmed", () => {
    expect(parseAssignmentChanges({ title: " New title " })).toEqual({
      ok: true,
      value: { title: "New title" },
    });
    expect(parseAssignmentChanges({ estimatedHours: 4 })).toEqual({
      ok: true,
      value: { estimatedHours: 4 },
    });
  });

  test("takes title, due date and hours together, and ignores course and kind", () => {
    const result = parseAssignmentChanges({
      title: "Essay",
      dueDate: "2026-12-01",
      estimatedHours: 2.5,
      courseCode: "CS 1",
      kind: "EXAM",
    });
    expect(result).toEqual({
      ok: true,
      value: { title: "Essay", dueDate: "2026-12-01", estimatedHours: 2.5 },
    });
  });

  test.each([
    ["a body that isn't an object", "title"],
    ["no body", undefined],
    ["an empty object", {}],
    ["only fields that can't be edited", { courseCode: "CS 1", kind: "EXAM" }],
    ["an empty title", { title: "  " }],
    ["a title longer than 120 characters", { title: "T".repeat(121) }],
    ["a title that isn't text", { title: null }],
    ["a due date that isn't YYYY-MM-DD", { dueDate: "12/01/2026" }],
    ["a due date that doesn't exist", { dueDate: "2026-02-30" }],
    ["zero hours", { estimatedHours: 0 }],
    ["more than 100 hours", { estimatedHours: 101 }],
    ["hours sent as text", { estimatedHours: "3" }],
  ])("rejects %s with VALIDATION_ERROR", (_label, input) => {
    const result = parseAssignmentChanges(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  test("uses the same messages as adding an assignment", () => {
    const added = parseNewAssignment({ ...valid, estimatedHours: 0 });
    const changed = parseAssignmentChanges({ estimatedHours: 0 });
    expect(!added.ok && !changed.ok && changed.error.message).toBe(
      !added.ok && added.error.message,
    );
  });
});

describe("updateAssignmentForUser", () => {
  test("saves only the given fields, with the due date at the end of that day", async () => {
    const userId = await newUser();
    const row = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Essay",
      dueAt: dueInDays(5),
      estimatedHours: 3,
    });

    const result = await updateAssignmentForUser(userId, row.id, {
      title: " Final essay ",
      dueDate: "2026-12-04",
    });

    expect(result).toEqual({
      ok: true,
      value: { id: row.id, title: "Final essay", dueAt: new Date("2026-12-04T23:59:00Z") },
    });
    const saved = await prisma.assignment.findUniqueOrThrow({ where: { id: row.id } });
    expect(saved.title).toBe("Final essay");
    expect(saved.dueAt.toISOString()).toBe("2026-12-04T23:59:00.000Z");
    expect(saved.estimatedHours).toBe(3);
  });

  test("returns NOT_FOUND and changes nothing for another user's assignment", async () => {
    const userId = await newUser();
    const otherId = await newUser();
    const theirs = await createAssignment(otherId, {
      courseCode: "CS 1000",
      title: "Theirs",
      dueAt: dueInDays(5),
      estimatedHours: 3,
    });

    const result = await updateAssignmentForUser(userId, theirs.id, { title: "Mine now" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    const saved = await prisma.assignment.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(saved.title).toBe("Theirs");
  });

  test("returns NOT_FOUND for an assignment that doesn't exist", async () => {
    const userId = await newUser();
    const result = await updateAssignmentForUser(userId, "no-such-assignment", { estimatedHours: 2 });
    expect(!result.ok && result.error.code).toBe("NOT_FOUND");
  });

  test("saves nothing when a field is invalid", async () => {
    const userId = await newUser();
    const row = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Essay",
      dueAt: dueInDays(5),
      estimatedHours: 3,
    });

    const result = await updateAssignmentForUser(userId, row.id, {
      title: "Renamed",
      estimatedHours: 101,
    });

    expect(!result.ok && result.error.code).toBe("VALIDATION_ERROR");
    const saved = await prisma.assignment.findUniqueOrThrow({ where: { id: row.id } });
    expect(saved.title).toBe("Essay");
    expect(saved.estimatedHours).toBe(3);
  });
});

describe("deleteAssignmentForUser", () => {
  test("deletes the assignment and all of its work sessions", async () => {
    const userId = await newUser();
    const row = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Essay",
      dueAt: dueInDays(5),
      estimatedHours: 3,
    });
    await prisma.workSession.createMany({
      data: [
        { userId, assignmentId: row.id, startAt: dueInDays(1), hours: 1, status: "SCHEDULED" },
        { userId, assignmentId: row.id, startAt: dueInDays(0), hours: 1, status: "DONE" },
      ],
    });

    expect(await deleteAssignmentForUser(userId, row.id)).toBe(true);

    expect(await prisma.assignment.findUnique({ where: { id: row.id } })).toBeNull();
    expect(await prisma.workSession.count({ where: { assignmentId: row.id } })).toBe(0);
  });

  test("returns false and keeps another user's assignment", async () => {
    const userId = await newUser();
    const otherId = await newUser();
    const theirs = await createAssignment(otherId, {
      courseCode: "CS 1000",
      title: "Theirs",
      dueAt: dueInDays(5),
      estimatedHours: 3,
    });

    expect(await deleteAssignmentForUser(userId, theirs.id)).toBe(false);
    expect(await prisma.assignment.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });

  test("returns false for an assignment that doesn't exist", async () => {
    const userId = await newUser();
    expect(await deleteAssignmentForUser(userId, "no-such-assignment")).toBe(false);
  });
});

describe("listAssignmentsForUser", () => {
  test("lists the user's unsubmitted assignments soonest due first, with hours done", async () => {
    const userId = await newUser();
    const later = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Later",
      dueAt: dueInDays(9),
      estimatedHours: 4,
    });
    const sooner = await createAssignment(userId, {
      courseCode: "DS 5110",
      title: "Sooner",
      dueAt: dueInDays(2),
      estimatedHours: 3,
    });
    const submitted = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Handed in",
      dueAt: dueInDays(1),
      estimatedHours: 1,
    });
    await prisma.assignment.update({ where: { id: submitted.id }, data: { submitted: true } });
    await prisma.workSession.createMany({
      data: [
        { userId, assignmentId: later.id, startAt: dueInDays(0), hours: 1.5, status: "DONE" },
        { userId, assignmentId: later.id, startAt: dueInDays(1), hours: 1, status: "DONE" },
        { userId, assignmentId: later.id, startAt: dueInDays(2), hours: 1, status: "SCHEDULED" },
        { userId, assignmentId: later.id, startAt: dueInDays(0), hours: 1, status: "MISSED" },
      ],
    });
    const otherId = await newUser();
    await createAssignment(otherId, {
      courseCode: "CS 1000",
      title: "Not mine",
      dueAt: dueInDays(3),
      estimatedHours: 2,
    });

    const list = await listAssignmentsForUser(userId);

    expect(list).toEqual([
      {
        id: sooner.id,
        title: "Sooner",
        courseCode: "DS 5110",
        dueAt: sooner.dueAt,
        estimatedHours: 3,
        doneHours: 0,
      },
      {
        id: later.id,
        title: "Later",
        courseCode: "CS 6983",
        dueAt: later.dueAt,
        estimatedHours: 4,
        doneHours: 2.5,
      },
    ]);
  });

  test("returns an empty list for a user with no assignments", async () => {
    const userId = await newUser();
    expect(await listAssignmentsForUser(userId)).toEqual([]);
  });
});
