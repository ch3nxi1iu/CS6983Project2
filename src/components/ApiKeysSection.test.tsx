// Tests for the API keys page at /settings/api (US-12, #18). The section is a
// Server Component that reads keys from the database, and the create and revoke
// controls are client components. fetch is routed to the real route handlers,
// so every request runs through the route, the lib and the database.
import "dotenv/config";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { createApiKey } from "@/lib/api-keys";
import { createTestUser, deleteTestUsers } from "@/test/work-plan-fixtures";

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

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
  redirect: vi.fn(),
}));

// Test-environment shim, as in src/app/plan/page.test.tsx: jsdom's TextEncoder
// output is rejected by jose as an HS256 key. The sessions are still real JWTs.
class SameRealmTextEncoder {
  encode(text: string): Uint8Array {
    return Uint8Array.from(Buffer.from(text, "utf8"));
  }
}
vi.stubGlobal("TextEncoder", SameRealmTextEncoder);

import ApiKeysSection from "@/components/ApiKeysSection";
import { POST } from "@/app/api/api-keys/route";
import { DELETE } from "@/app/api/api-keys/[id]/route";

const createdUserIds: string[] = [];

async function signIn(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  await createSession(userId);
  return userId;
}

/** Sends fetch calls to the real handlers for /api/api-keys. */
async function routeFetchToHandlers(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), "http://localhost:3000");
  const request = new Request(url, init);
  if (url.pathname === "/api/api-keys" && request.method === "POST") {
    return POST(request);
  }
  const match = /^\/api\/api-keys\/([^/]+)$/.exec(url.pathname);
  if (match && request.method === "DELETE") {
    return DELETE(request, { params: Promise.resolve({ id: match[1] }) });
  }
  throw new Error(`Unexpected fetch: ${request.method} ${url.pathname}`);
}

beforeEach(() => {
  cookieJar.clear();
  refreshMock.mockReset();
  vi.stubGlobal("fetch", vi.fn(routeFetchToHandlers));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal("TextEncoder", SameRealmTextEncoder);
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

async function renderKeys() {
  render(await ApiKeysSection());
}

describe("/settings/api keys list", () => {
  test("shows each active key with its name, prefix, created date and last-used date", async () => {
    const userId = await signIn();
    const { key } = await createApiKey(userId, "Grade script");
    await renderKeys();

    const list = screen.getByRole("list", { name: "Your API keys" });
    const item = within(list).getByText("Grade script").closest("li") as HTMLElement;
    expect(within(item).getByText(key.slice(0, 11))).toBeInTheDocument();
    expect(within(item).getByText(/Created/)).toBeInTheDocument();
    expect(within(item).getByText(/Last used: Never/)).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Revoke Grade script" })).toBeInTheDocument();
  });

  test("never shows a full key in the list", async () => {
    const userId = await signIn();
    const { key } = await createApiKey(userId, "Hidden");
    const { container } = render(await ApiKeysSection());

    expect(container.textContent).not.toContain(key);
  });

  test("says so when the user has no keys", async () => {
    await signIn();
    await renderKeys();

    expect(screen.getByText("You have no active API keys.")).toBeInTheDocument();
  });

  test("links to the API documentation", async () => {
    await signIn();
    await renderKeys();

    expect(screen.getByRole("link", { name: "API documentation" })).toHaveAttribute(
      "href",
      "/docs/api",
    );
  });
});

describe("creating a key", () => {
  test("creates the key, shows it once with a Copy button and a warning, and refreshes the list", async () => {
    const userId = await signIn();
    await renderKeys();

    fireEvent.change(screen.getByLabelText("Key name"), { target: { value: "Laptop" } });
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));

    const shown = await screen.findByText(/^ll_[A-Za-z0-9_-]{43}$/);
    const key = shown.textContent ?? "";
    expect(screen.getByText(/will not be shown again/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/api-keys", expect.objectContaining({ method: "POST" }));
    expect(refreshMock).toHaveBeenCalled();

    const rows = await prisma.apiKey.findMany({ where: { userId, name: "Laptop" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].prefix).toBe(key.slice(0, 11));
  });

  test("copies the new key to the clipboard", async () => {
    await signIn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await renderKeys();

    fireEvent.change(screen.getByLabelText("Key name"), { target: { value: "Copy me" } });
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const shown = await screen.findByText(/^ll_[A-Za-z0-9_-]{43}$/);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(shown.textContent);
    });
    expect(screen.getByRole("status").textContent).toContain("Copied");
  });
});

describe("revoking a key", () => {
  test("revokes the key, reports it to screen readers, and refreshes the list", async () => {
    const userId = await signIn();
    const { apiKey } = await createApiKey(userId, "Old script");
    await renderKeys();

    fireEvent.click(screen.getByRole("button", { name: "Revoke Old script" }));

    expect(await screen.findByText("Key revoked.")).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } });
    expect(row.revokedAt).not.toBeNull();
  });
});
