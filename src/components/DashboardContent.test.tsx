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
  test("shows the crunch-week forecast for the next 4 weeks", async () => {
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
    expect(within(forecast).getAllByText("Crunch week").length).toBeGreaterThan(0);
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
    expect(
      within(today).getByRole("link", { name: "See the full plan" }).getAttribute("href"),
    ).toBe("/plan");
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
