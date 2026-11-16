import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import MarkDoneButton from "@/components/MarkDoneButton";

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

describe("MarkDoneButton", () => {
  test("names the assignment, so each button on the page is distinct for screen readers", () => {
    render(<MarkDoneButton sessionId="s1" assignmentTitle="Homework 3" />);
    const button = screen.getByRole("button", { name: "Mark done: Homework 3" });
    expect(button.textContent).toBe("Mark done");
  });

  test("marks the session done on the server, then refreshes the page", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { session: { id: "s1", status: "DONE" } }));
    render(<MarkDoneButton sessionId="s1" assignmentTitle="Homework 3" />);

    fireEvent.click(screen.getByRole("button", { name: "Mark done: Homework 3" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/work-sessions/s1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
  });

  test("shows the server's error and doesn't refresh when it fails", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { error: { code: "NOT_FOUND", message: "Work session not found." } }),
    );
    render(<MarkDoneButton sessionId="s1" assignmentTitle="Homework 3" />);

    fireEvent.click(screen.getByRole("button", { name: "Mark done: Homework 3" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Work session not found.");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  test("says so when the server can't be reached", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<MarkDoneButton sessionId="s1" assignmentTitle="Homework 3" />);

    fireEvent.click(screen.getByRole("button", { name: "Mark done: Homework 3" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not reach the server. Try again.",
    );
  });
});
