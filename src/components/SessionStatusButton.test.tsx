import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import SessionStatusButton from "@/components/SessionStatusButton";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  refreshMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SessionStatusButton", () => {
  test.each([
    ["DONE", "Mark done", "Mark done: Homework 3"],
    ["MISSED", "Missed", "Mark missed: Homework 3"],
    ["SCHEDULED", "Undo", "Undo: Homework 3"],
  ] as const)("%s: shows %s and names the assignment", (status, text, name) => {
    render(<SessionStatusButton sessionId="s1" assignmentTitle="Homework 3" status={status} />);
    expect(screen.getByRole("button", { name }).textContent).toBe(text);
  });

  test("saves the new status, then refreshes the page", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { session: { id: "s1", status: "MISSED" } }));
    render(<SessionStatusButton sessionId="s1" assignmentTitle="Homework 3" status="MISSED" />);

    fireEvent.click(screen.getByRole("button", { name: "Mark missed: Homework 3" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/work-sessions/s1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "MISSED" }),
    });
  });

  test("shows the server's error and doesn't refresh when it fails", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { error: { code: "NOT_FOUND", message: "Work session not found." } }),
    );
    render(<SessionStatusButton sessionId="s1" assignmentTitle="Homework 3" status="SCHEDULED" />);

    fireEvent.click(screen.getByRole("button", { name: "Undo: Homework 3" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Work session not found.");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
