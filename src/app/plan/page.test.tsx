import "dotenv/config";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import {
  NO_STUDY_HOURS,
  createAssignment,
  createTestUser,
  deleteTestUsers,
  dueInDays,
  setStudyHours,
  startOfDayInDays,
} from "@/test/work-plan-fixtures";

const cookieJar = new Map<string, { value: string; [key: string]: unknown }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string, options?: unknown) => {
      cookieJar.set(name, { value, ...(typeof options === "object" ? options : {}) });
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

// The Rebuild button calls the Next.js router; nothing in these tests navigates.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  redirect: vi.fn(),
}));

// Test-environment shim: jsdom's TextEncoder returns bytes that jose rejects as an HS256
// key (they come from another realm). Copying them into this realm fixes it. The app code
// is unchanged, and the sessions are still real signed JWTs.
class SameRealmTextEncoder {
  encode(text: string): Uint8Array {
    return Uint8Array.from(Buffer.from(text, "utf8"));
  }
}
vi.stubGlobal("TextEncoder", SameRealmTextEncoder);

import WorkPlanSection from "@/components/WorkPlanSection";

const createdUserIds: string[] = [];

async function signIn(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  await createSession(userId);
  return userId;
}

/**
 * Renders what /plan shows. The page wraps WorkPlanSection in <Suspense>, but
 * React's client renderer cannot render an async Server Component, so the test
 * awaits the section and renders its output directly.
 */
async function renderPlan() {
  render(await WorkPlanSection());
}

beforeEach(() => {
  cookieJar.clear();
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("/plan page content", () => {
  test("tells the user to set study hours, with a link to availability settings, when hours are not set", async () => {
    await signIn();
    await renderPlan();

    const link = screen.getByRole("link", { name: /set your study hours/i });
    expect(link.getAttribute("href")).toBe("/settings/availability");
    expect(screen.queryByRole("button", { name: "Rebuild plan" })).toBeNull();
  });

  test("shows a seven-day grid with each session's title, course code, hours and status as text", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Homework 3",
      dueAt: dueInDays(10),
      estimatedHours: 2,
    });
    await prisma.workSession.createMany({
      data: [
        { userId, assignmentId: assignment.id, startAt: startOfDayInDays(0), hours: 2, status: "SCHEDULED" },
        { userId, assignmentId: assignment.id, startAt: startOfDayInDays(2), hours: 1, status: "MISSED" },
      ],
    });

    await renderPlan();

    expect(screen.getByRole("button", { name: "Rebuild plan" })).toBeDefined();
    const dayLists = screen.getAllByRole("list", { name: /^Sessions on / });
    expect(dayLists).toHaveLength(7);

    const today = within(dayLists[0]);
    expect(today.getByText("Homework 3")).toBeDefined();
    expect(today.getByText("CS 6120")).toBeDefined();
    expect(today.getByText("2h")).toBeDefined();
    expect(today.getByText("Scheduled")).toBeDefined();

    const dayThree = within(dayLists[2]);
    expect(dayThree.getByText("Missed")).toBeDefined();
    expect(dayThree.getByText("1h")).toBeDefined();
  });

  test("lists assignments that cannot fit under At risk, with the hours short", async () => {
    const userId = await signIn();
    await setStudyHours(userId, NO_STUDY_HOURS);
    await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Project 1",
      dueAt: dueInDays(10),
      estimatedHours: 5,
    });

    await renderPlan();

    const atRisk = screen.getByRole("region", { name: "At risk" });
    expect(within(atRisk).getByText("Project 1")).toBeDefined();
    expect(within(atRisk).getByText("CS 6120")).toBeDefined();
    expect(within(atRisk).getByText("5h short")).toBeDefined();
  });
});
