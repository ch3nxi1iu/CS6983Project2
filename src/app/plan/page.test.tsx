import "dotenv/config";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import AssignmentsSection from "@/components/AssignmentsSection";
import { DELETE, PATCH } from "@/app/api/assignments/[id]/route";

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

    // Only work still to do can be marked done.
    expect(today.getByRole("button", { name: "Mark done: Homework 3" })).toBeDefined();
    expect(dayThree.queryByRole("button", { name: /^Mark done/ })).toBeNull();
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

describe("adding an assignment on /plan", () => {
  test("the plan page has the Add an assignment form", async () => {
    const { default: PlanPage } = await import("@/app/plan/page");
    render(PlanPage());
    expect(screen.getByRole("heading", { name: "Add an assignment" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add assignment" })).toBeDefined();
  });
});

describe("your assignments on /plan (#20)", () => {
  /** Sends the list's fetch calls to the real /api/assignments/[id] handlers. */
  async function routeFetchToHandlers(input: string | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(String(input), "http://localhost:3000");
    const request = new Request(url, init);
    const match = /^\/api\/assignments\/([^/]+)$/.exec(url.pathname);
    const context = { params: Promise.resolve({ id: match?.[1] ?? "" }) };
    if (match && request.method === "PATCH") return PATCH(request, context);
    if (match && request.method === "DELETE") return DELETE(request, context);
    throw new Error(`Unexpected fetch: ${request.method} ${url.pathname}`);
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(routeFetchToHandlers));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("TextEncoder", SameRealmTextEncoder);
  });

  async function renderAssignments() {
    render(await AssignmentsSection());
  }

  test("the plan page has a Your assignments section", async () => {
    const { default: PlanPage } = await import("@/app/plan/page");
    render(PlanPage());
    expect(screen.getByRole("region", { name: "Your assignments" })).toBeDefined();
  });

  test("lists the user's own assignments, soonest due first, with hours done", async () => {
    const userId = await signIn();
    const later = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Final reflection",
      dueAt: dueInDays(9),
      estimatedHours: 3,
    });
    await createAssignment(userId, {
      courseCode: "DS 5110",
      title: "Quiz prep",
      dueAt: dueInDays(2),
      estimatedHours: 2,
    });
    await prisma.workSession.create({
      data: { userId, assignmentId: later.id, startAt: startOfDayInDays(0), hours: 1.5, status: "DONE" },
    });
    const otherId = await createTestUser();
    createdUserIds.push(otherId);
    await createAssignment(otherId, {
      courseCode: "CS 1000",
      title: "Not mine",
      dueAt: dueInDays(3),
      estimatedHours: 2,
    });

    await renderAssignments();

    const rows = within(screen.getByRole("list", { name: "Your assignments" })).getAllByRole(
      "listitem",
    );
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Quiz prep")).toBeDefined();
    expect(within(rows[0]).getByText("DS 5110")).toBeDefined();
    expect(within(rows[0]).getByText("0h of 2h done")).toBeDefined();
    expect(within(rows[1]).getByText("Final reflection")).toBeDefined();
    expect(within(rows[1]).getByText("1.5h of 3h done")).toBeDefined();
    expect(screen.queryByText("Not mine")).toBeNull();
  });

  test("shows how to add one when the user has no assignments", async () => {
    await signIn();
    await renderAssignments();
    expect(screen.getByText("No assignments yet. Add one above.")).toBeDefined();
  });

  test("editing the hours saves them and rebuilds the plan", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Final reflection",
      dueAt: dueInDays(9),
      estimatedHours: 3,
    });
    await renderAssignments();

    fireEvent.click(screen.getByRole("button", { name: "Edit: Final reflection" }));
    const form = screen.getByRole("form", { name: "Edit Final reflection" });
    fireEvent.change(within(form).getByLabelText("Estimated hours"), { target: { value: "5" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Saved Final reflection. The plan is rebuilt.",
      ),
    );
    const saved = await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(saved.estimatedHours).toBe(5);
    const scheduled = await prisma.workSession.findMany({
      where: { userId, assignmentId: assignment.id, status: "SCHEDULED" },
    });
    expect(scheduled.reduce((sum, s) => sum + s.hours, 0)).toBe(5);
  });

  test("deleting after confirming removes the assignment and its sessions", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Final reflection",
      dueAt: dueInDays(9),
      estimatedHours: 3,
    });
    await prisma.workSession.create({
      data: { userId, assignmentId: assignment.id, startAt: startOfDayInDays(1), hours: 3, status: "SCHEDULED" },
    });
    await renderAssignments();

    fireEvent.click(screen.getByRole("button", { name: "Delete: Final reflection" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Deleted Final reflection."),
    );
    expect(await prisma.assignment.findUnique({ where: { id: assignment.id } })).toBeNull();
    expect(await prisma.workSession.count({ where: { assignmentId: assignment.id } })).toBe(0);
  });
});
