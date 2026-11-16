// @vitest-environment node
// Integration tests for src/lib/today.ts (US-09, #15).
// Runs against the real database; each test file deletes its own users.

import "dotenv/config";
import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import { getSessionsWithDeadlines } from "@/lib/today";
import {
  createAssignment,
  createTestUser,
  deleteTestUsers,
  dueInDays,
} from "@/test/work-plan-fixtures";

const createdUserIds: string[] = [];

async function newUser(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  return userId;
}

function session(id: string, assignmentId: string, assignmentTitle: string) {
  return { id, assignmentId, assignmentTitle, status: "SCHEDULED" as const };
}

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("getSessionsWithDeadlines", () => {
  test("adds each assignment's points and due date to its sessions", async () => {
    const userId = await newUser();
    const project = await createAssignment(userId, {
      courseCode: "CS 5800",
      title: "Final project",
      dueAt: dueInDays(3),
      estimatedHours: 10,
    });
    await prisma.assignment.update({ where: { id: project.id }, data: { points: 100 } });
    const notes = await createAssignment(userId, {
      courseCode: "CS 5800",
      title: "Reading notes",
      dueAt: dueInDays(1),
      estimatedHours: 1,
    });

    const result = await getSessionsWithDeadlines(userId, [
      session("s1", project.id, "Final project"),
      session("s2", notes.id, "Reading notes"),
      session("s3", project.id, "Final project"),
    ]);

    expect(result).toEqual([
      { session: session("s1", project.id, "Final project"), points: 100, dueAt: dueInDays(3) },
      { session: session("s2", notes.id, "Reading notes"), points: null, dueAt: dueInDays(1) },
      { session: session("s3", project.id, "Final project"), points: 100, dueAt: dueInDays(3) },
    ]);
  });

  test("never reads another user's assignment", async () => {
    const userId = await newUser();
    const otherUserId = await newUser();
    const theirs = await createAssignment(otherUserId, {
      courseCode: "CS 6200",
      title: "Someone else's lab",
      dueAt: dueInDays(2),
      estimatedHours: 3,
    });

    const result = await getSessionsWithDeadlines(userId, [
      session("s1", theirs.id, "Someone else's lab"),
    ]);

    expect(result).toEqual([]);
  });

  test("returns nothing when there are no sessions", async () => {
    const userId = await newUser();
    expect(await getSessionsWithDeadlines(userId, [])).toEqual([]);
  });
});
