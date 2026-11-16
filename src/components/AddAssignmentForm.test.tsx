import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import AddAssignmentForm from "@/components/AddAssignmentForm";

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

function fillIn() {
  fireEvent.change(screen.getByLabelText("Course"), { target: { value: "CS 6983" } });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Final reflection" } });
  fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-11-20" } });
  fireEvent.change(screen.getByLabelText("Estimated hours"), { target: { value: "2.5" } });
  fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "HOMEWORK" } });
}

describe("AddAssignmentForm", () => {
  test("has a labeled field for each part of an assignment", () => {
    render(<AddAssignmentForm />);
    for (const label of ["Course", "Title", "Due date", "Estimated hours", "Kind"]) {
      expect(screen.getByLabelText(label)).toBeDefined();
    }
    expect(screen.getByRole("button", { name: "Add assignment" })).toBeDefined();
  });

  test("sends the assignment as JSON, confirms it, clears the form and refreshes the plan", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { assignment: { id: "a1", title: "Final reflection" } }),
    );
    render(<AddAssignmentForm />);
    fillIn();

    fireEvent.click(screen.getByRole("button", { name: "Add assignment" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseCode: "CS 6983",
        title: "Final reflection",
        dueDate: "2026-11-20",
        estimatedHours: 2.5,
        kind: "HOMEWORK",
      }),
    });
    expect(screen.getByRole("status").textContent).toBe(
      "Added Final reflection. The plan includes it now.",
    );
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
  });

  test("shows the server's error and keeps what was typed", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        error: { code: "VALIDATION_ERROR", message: "Give the hours as more than 0 and at most 100." },
      }),
    );
    render(<AddAssignmentForm />);
    fillIn();

    fireEvent.click(screen.getByRole("button", { name: "Add assignment" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Give the hours as more than 0 and at most 100.",
    );
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Final reflection");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
