import "dotenv/config";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { createTestUser, deleteTestUsers } from "@/test/work-plan-fixtures";

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

let pathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

class SameRealmTextEncoder {
  encode(text: string): Uint8Array {
    return Uint8Array.from(Buffer.from(text, "utf8"));
  }
}
vi.stubGlobal("TextEncoder", SameRealmTextEncoder);

import AppHeader from "@/components/AppHeader";

const createdUserIds: string[] = [];

/** AppHeader is an async Server Component; render what it returns. */
async function renderHeader() {
  const output = await AppHeader();
  if (output) render(output);
  return output;
}

beforeEach(() => {
  cookieJar.clear();
  pathname = "/dashboard";
});

afterEach(cleanup);

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("AppHeader", () => {
  test("renders nothing for a signed-out visitor", async () => {
    expect(await renderHeader()).toBeNull();
  });

  test("shows Dashboard, Plan and Settings links and a Log out button when signed in", async () => {
    const userId = await createTestUser();
    createdUserIds.push(userId);
    await createSession(userId);

    await renderHeader();

    const nav = screen.getByRole("navigation", { name: "Main" });
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]);
    expect(hrefs).toEqual([
      ["Dashboard", "/dashboard"],
      ["Plan", "/plan"],
      ["Settings", "/settings/availability"],
    ]);
    expect(screen.getByRole("button", { name: "Log out" })).toBeDefined();
  });

  test("marks the current section's link", async () => {
    const userId = await createTestUser();
    createdUserIds.push(userId);
    await createSession(userId);
    pathname = "/settings/api";

    await renderHeader();

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
  });
});
