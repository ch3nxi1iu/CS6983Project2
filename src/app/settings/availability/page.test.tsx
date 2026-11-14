// @vitest-environment node
import "dotenv/config";
import { renderToReadableStream } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { addUnavailableDate, saveWeeklyHours } from "@/lib/availability";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/planner/availability";
import AvailabilityPage from "@/app/settings/availability/page";

// Runs in the node environment: jsdom breaks jose's key encoding, so the signed
// session cookie can't be created there. The page is a Server Component, so it
// is rendered to HTML on the server, the same way Next.js renders it, and the
// Suspense content is awaited before checking the output.

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

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

/** Renders the page on the server, waits for Suspense, and returns text without React's comment markers. */
async function renderPage(): Promise<string> {
  const stream = await renderToReadableStream(<AvailabilityPage />);
  await stream.allReady;
  const html = await new Response(stream).text();
  return html.replace(/<!--.*?-->/g, "");
}

describe("/settings/availability", () => {
  test("shows the heading, breadcrumb and intro line from the mockup", async () => {
    const html = await renderPage();

    expect(html).toContain(">Your study hours</h1>");
    expect(html).toContain("Settings → Availability");
    expect(html).toContain(
      "You decide how many hours you can study each day. Loadline plans your work inside them.",
    );
  });

  test("shows the prefilled defaults with a note when the user has not saved hours yet", async () => {
    const html = await renderPage();

    expect(html).toContain('aria-label="Friday"');
    expect(html).toMatch(/prefilled defaults/i);
    expect(html).toContain("22h a week");
  });

  test("shows the hours and unavailable dates saved in the database", async () => {
    await saveWeeklyHours(userId, { ...DEFAULT_WEEKLY_HOURS, monday: 5.5 });
    await addUnavailableDate(userId, { date: "2026-11-25", reason: "Travel" });

    const html = await renderPage();

    expect(html).toContain("5.5h");
    expect(html).not.toMatch(/prefilled defaults/i);
    expect(html).toContain('aria-label="Unavailable dates"');
    expect(html).toContain("Travel");
  });
});
