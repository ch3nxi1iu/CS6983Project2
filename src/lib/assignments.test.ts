// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import { createAssignmentForUser, parseNewAssignment } from "@/lib/assignments";

// Adding your own assignment (US-14, #20), so a real account isn't empty
// until Canvas sync exists.

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
  const createdUserIds: string[] = [];
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `add-assignment-${crypto.randomUUID()}@test.local`, passwordHash: "x" },
    });
    createdUserIds.push(user.id);
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
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
