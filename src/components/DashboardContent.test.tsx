import "dotenv/config";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { regeneratePlanForUser } from "@/lib/work-plan";
import {
  createAssignment,
  createTestUser,
  deleteTestUsers,
  dueInDays,
  setStudyHours,
  startOfDayInDays,
} from "@/test/work-plan-fixtures";

// Stands in for the request's cookie store so requireUser() runs for real.
const cookieJar = new Map<string, { value: string }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string) => {
      cookieJar.set(name, { value });
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  redirect: vi.fn(),
}));

// Same shim as the /plan test: jsdom's TextEncoder gives bytes jose rejects as
// an HS256 key. Sessions are still real signed JWTs.
class SameRealmTextEncoder {
  encode(text: string): Uint8Array {
    return Uint8Array.from(Buffer.from(text, "utf8"));
  }
}
vi.stubGlobal("TextEncoder", SameRealmTextEncoder);

import DashboardContent from "@/components/DashboardContent";

const createdUserIds: string[] = [];

async function signIn(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  await createSession(userId);
  return userId;
}

/** DashboardContent is an async Server Component; render what it returns. */
async function renderDashboard() {
  render(await DashboardContent());
}

/**
 * An assignment with a work session today. The session is saved directly, so
 * the test decides what's on today's plan instead of the planner.
 */
async function planToday(
  userId: string,
  input: {
    title: string;
    points: number | null;
    dueInDays: number;
    hours?: number;
    status?: "SCHEDULED" | "DONE";
  },
) {
  const assignment = await createAssignment(userId, {
    courseCode: "CS 5800",
    title: input.title,
    dueAt: dueInDays(input.dueInDays),
    estimatedHours: 10,
  });
  await prisma.assignment.update({
    where: { id: assignment.id },
    data: { points: input.points },
  });
  await prisma.workSession.create({
    data: {
      userId,
      assignmentId: assignment.id,
      startAt: startOfDayInDays(0),
      hours: input.hours ?? 1,
      status: input.status ?? "SCHEDULED",
    },
  });
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

describe("dashboard content", () => {
  test("shows the overloaded-week forecast for the next 4 weeks", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    await createAssignment(userId, {
      courseCode: "CS 5800",
      title: "Huge project",
      dueAt: dueInDays(1),
      estimatedHours: 80,
    });

    await renderDashboard();

    const forecast = screen.getByRole("region", { name: "Forecast" });
    expect(within(forecast).getAllByRole("button", { name: /^Week of/ })).toHaveLength(4);
    expect(within(forecast).getAllByText("Overloaded week").length).toBeGreaterThan(0);
  });

  test("lists today's work sessions with a link to the full plan", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    await createAssignment(userId, {
      courseCode: "CS 5800",
      title: "Problem set 4",
      dueAt: dueInDays(1),
      estimatedHours: 2,
    });
    await regeneratePlanForUser(userId, new Date());

    await renderDashboard();

    const today = screen.getByRole("region", { name: "Today" });
    const list = within(today).getByRole("list", { name: "Today's sessions" });
    expect(within(list).getByText("Problem set 4")).toBeDefined();
    expect(within(list).getByText(/CS 5800/)).toBeDefined();
    expect(within(list).getAllByRole("button", { name: "Mark done: Problem set 4" }).length).toBeGreaterThan(0);
    expect(
      within(today).getByRole("link", { name: "See the full plan" }).getAttribute("href"),
    ).toBe("/plan");
  });

  test("shows today's top 3 sessions, most important first, each with a reason", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    await planToday(userId, { title: "Reading notes", points: null, dueInDays: 1, hours: 0.5 });
    await planToday(userId, { title: "Essay draft", points: 40, dueInDays: 0, hours: 2 });
    await planToday(userId, { title: "Final project", points: 100, dueInDays: 3, hours: 1.5 });
    await planToday(userId, { title: "Lab report", points: null, dueInDays: 4 });
    await planToday(userId, { title: "Already done", points: 500, dueInDays: 1, status: "DONE" });

    await renderDashboard();

    const today = screen.getByRole("region", { name: "Today" });
    const items = within(within(today).getByRole("list", { name: "Today's sessions" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(3);

    expect(within(items[0]).getByText("Final project")).toBeDefined();
    expect(within(items[0]).getByText("CS 5800")).toBeDefined();
    expect(within(items[0]).getByText("1.5h")).toBeDefined();
    expect(within(items[0]).getByText("Worth 100 points, due in 3 days")).toBeDefined();
    expect(within(items[0]).getByRole("button", { name: "Mark done: Final project" })).toBeDefined();

    expect(within(items[1]).getByText("Essay draft")).toBeDefined();
    expect(within(items[1]).getByText("2h")).toBeDefined();
    expect(within(items[1]).getByText("Worth 40 points, due today")).toBeDefined();
    expect(within(items[1]).getByRole("button", { name: "Mark done: Essay draft" })).toBeDefined();

    expect(within(items[2]).getByText("Reading notes")).toBeDefined();
    expect(within(items[2]).getByText("0.5h")).toBeDefined();
    expect(within(items[2]).getByText("Due tomorrow")).toBeDefined();
    expect(within(items[2]).getByRole("button", { name: "Mark done: Reading notes" })).toBeDefined();

    // The 4th scheduled session waits on the full plan; done work isn't listed.
    expect(within(today).queryByText("Lab report")).toBeNull();
    expect(within(today).queryByText("Already done")).toBeNull();
  });

  test("links to the full plan for today's sessions after the top 3", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    await planToday(userId, { title: "Final project", points: 100, dueInDays: 3 });
    await planToday(userId, { title: "Essay draft", points: 40, dueInDays: 0 });
    await planToday(userId, { title: "Quiz prep", points: 20, dueInDays: 2 });
    await planToday(userId, { title: "Lab report", points: 10, dueInDays: 4 });
    await planToday(userId, { title: "Reading notes", points: null, dueInDays: 1 });

    await renderDashboard();

    const today = screen.getByRole("region", { name: "Today" });
    expect(
      within(today).getByRole("link", { name: "2 more sessions on the plan" }).getAttribute("href"),
    ).toBe("/plan");
    expect(
      within(today).getByRole("link", { name: "See the full plan" }).getAttribute("href"),
    ).toBe("/plan");
  });

  test("doesn't show a 'more' link when 3 or fewer sessions are left today", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    await planToday(userId, { title: "Final project", points: 100, dueInDays: 3 });
    await planToday(userId, { title: "Essay draft", points: 40, dueInDays: 0 });
    await planToday(userId, { title: "Quiz prep", points: 20, dueInDays: 2 });
    await planToday(userId, { title: "Lab report", points: 10, dueInDays: 4, status: "DONE" });

    await renderDashboard();

    const today = screen.getByRole("region", { name: "Today" });
    expect(within(today).getAllByRole("listitem")).toHaveLength(3);
    expect(within(today).queryByRole("link", { name: /more sessions? on the plan/ })).toBeNull();
  });

  test("says all done for today when every session today is done", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    await planToday(userId, { title: "Final project", points: 100, dueInDays: 3, status: "DONE" });
    await planToday(userId, { title: "Essay draft", points: 40, dueInDays: 0, status: "DONE" });

    await renderDashboard();

    const today = screen.getByRole("region", { name: "Today" });
    const status = within(today).getByRole("status");
    expect(within(status).getByText("All done for today.")).toBeDefined();
    expect(within(status).getByText("You finished 2 sessions today.")).toBeDefined();
    expect(within(today).queryByRole("list", { name: "Today's sessions" })).toBeNull();
    expect(within(today).queryByText(/Nothing planned for today/)).toBeNull();
    expect(
      within(today).getByRole("link", { name: "See the full plan" }).getAttribute("href"),
    ).toBe("/plan");
  });

  test("says nothing is planned when the only sessions are on other days", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    const assignment = await createAssignment(userId, {
      courseCode: "CS 5800",
      title: "Final project",
      dueAt: dueInDays(5),
      estimatedHours: 4,
    });
    await prisma.workSession.create({
      data: { userId, assignmentId: assignment.id, startAt: startOfDayInDays(1), hours: 2 },
    });

    await renderDashboard();

    const today = screen.getByRole("region", { name: "Today" });
    expect(within(today).getByText("Nothing planned for today.")).toBeDefined();
    expect(within(today).queryByText("Final project")).toBeNull();
    expect(within(today).queryByText("All done for today.")).toBeNull();
  });

  test("says when nothing is planned today", async () => {
    const userId = await signIn();
    await setStudyHours(userId);

    await renderDashboard();

    const today = screen.getByRole("region", { name: "Today" });
    expect(within(today).getByText(/Nothing planned for today/)).toBeDefined();
  });

  test("asks for study hours before there is a plan", async () => {
    await signIn();

    await renderDashboard();

    const today = screen.getByRole("region", { name: "Today" });
    expect(
      within(today).getByRole("link", { name: "Set your study hours" }).getAttribute("href"),
    ).toBe("/settings/availability");
  });

  test("links to the study hours and API key settings", async () => {
    const userId = await signIn();
    await setStudyHours(userId);

    await renderDashboard();

    const settings = screen.getByRole("region", { name: "Settings" });
    expect(within(settings).getByRole("link", { name: "Study hours" }).getAttribute("href")).toBe(
      "/settings/availability",
    );
    expect(within(settings).getByRole("link", { name: "API keys" }).getAttribute("href")).toBe(
      "/settings/api",
    );
  });
});
