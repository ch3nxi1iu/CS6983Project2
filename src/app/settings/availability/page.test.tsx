import "dotenv/config";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { addUnavailableDate, saveWeeklyHours } from "@/lib/availability";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/planner/availability";
import AvailabilityPage from "@/app/settings/availability/page";

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

const createdUserIds: string[] = [];
let userId: string;

beforeEach(async () => {
  cookieJar.clear();
  const user = await prisma.user.create({
    data: { email: `avail-page-${crypto.randomUUID()}@test.local`, passwordHash: "x" },
  });
  createdUserIds.push(user.id);
  userId = user.id;
  await createSession(userId);
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("/settings/availability", () => {
  test("shows the heading, breadcrumb and intro line from the mockup", async () => {
    render(<AvailabilityPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Your study hours" })).toBeDefined();
    expect(screen.getByText("Settings → Availability")).toBeDefined();
    expect(
      screen.getByText(
        "You decide how many hours you can study each day. Loadline plans your work inside them.",
      ),
    ).toBeDefined();
  });

  test("shows the prefilled defaults with a note when the user has not saved hours yet", async () => {
    render(<AvailabilityPage />);

    const friday = await screen.findByRole("group", { name: "Friday" });
    expect(within(friday).getByText("2h")).toBeDefined();
    expect(screen.getByText(/prefilled defaults/i)).toBeDefined();
  });

  test("shows the hours and unavailable dates saved in the database", async () => {
    await saveWeeklyHours(userId, { ...DEFAULT_WEEKLY_HOURS, monday: 5.5 });
    await addUnavailableDate(userId, { date: "2026-11-25", reason: "Travel" });

    render(<AvailabilityPage />);

    const monday = await screen.findByRole("group", { name: "Monday" });
    expect(within(monday).getByText("5.5h")).toBeDefined();
    expect(screen.queryByText(/prefilled defaults/i)).toBeNull();

    const list = screen.getByRole("list", { name: "Unavailable dates" });
    expect(within(list).getByText(/Travel/)).toBeDefined();
  });
});
