import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// The list of your assignments on /plan, with Edit and Delete (US-14, #20).
// fetch is mocked here to check what the list sends and shows; the tests in
// src/app/plan/page.test.tsx send the same clicks through the real routes.

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import AssignmentList, { type AssignmentRow } from "@/components/AssignmentList";

const fetchMock = vi.fn();

const ESSAY: AssignmentRow = {
  id: "a1",
  title: "Essay",
  courseCode: "CS 6983",
  dueDate: "2026-11-20",
  dueLabel: "Fri, Nov 20",
  estimatedHours: 3,
  doneHours: 1.5,
};

const QUIZ: AssignmentRow = {
  id: "a2",
  title: "Quiz prep",
  courseCode: "DS 5110",
  dueDate: "2026-11-24",
  dueLabel: "Tue, Nov 24",
  estimatedHours: 2,
  doneHours: 0,
};

beforeEach(() => {
  fetchMock.mockReset();
  refreshMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function statusText(): string {
  return screen.getByRole("status").textContent ?? "";
}

describe("AssignmentList", () => {
  test("shows each assignment's course, title, due date and hours done", () => {
    render(<AssignmentList assignments={[ESSAY, QUIZ]} />);

    const rows = within(screen.getByRole("list", { name: "Your assignments" })).getAllByRole(
      "listitem",
    );
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Essay")).toBeDefined();
    expect(within(rows[0]).getByText("CS 6983")).toBeDefined();
    expect(within(rows[0]).getByText("Due Fri, Nov 20")).toBeDefined();
    expect(within(rows[0]).getByText("1.5h of 3h done")).toBeDefined();
    expect(within(rows[1]).getByText("Quiz prep")).toBeDefined();
    expect(within(rows[1]).getByText("0h of 2h done")).toBeDefined();
  });

  test("says how to add one when there are no assignments", () => {
    render(<AssignmentList assignments={[]} />);

    expect(screen.getByText("No assignments yet. Add one above.")).toBeDefined();
    expect(screen.queryByRole("list", { name: "Your assignments" })).toBeNull();
  });

  describe("editing", () => {
    test("Edit opens a form with the current values, and Cancel closes it without saving", () => {
      render(<AssignmentList assignments={[ESSAY, QUIZ]} />);

      fireEvent.click(screen.getByRole("button", { name: "Edit: Essay" }));

      const form = screen.getByRole("form", { name: "Edit Essay" });
      expect((within(form).getByLabelText("Title") as HTMLInputElement).value).toBe("Essay");
      expect((within(form).getByLabelText("Due date") as HTMLInputElement).value).toBe(
        "2026-11-20",
      );
      expect((within(form).getByLabelText("Estimated hours") as HTMLInputElement).value).toBe(
        "3",
      );

      fireEvent.click(within(form).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("form", { name: "Edit Essay" })).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test("Save sends only the changed fields, confirms it and refreshes the page", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { assignment: { id: "a1", estimatedHours: 5 }, plan: null }),
      );
      render(<AssignmentList assignments={[ESSAY]} />);
      fireEvent.click(screen.getByRole("button", { name: "Edit: Essay" }));
      const form = screen.getByRole("form", { name: "Edit Essay" });

      fireEvent.change(within(form).getByLabelText("Estimated hours"), {
        target: { value: "5" },
      });
      fireEvent.click(within(form).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(refreshMock).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith("/api/assignments/a1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatedHours: 5 }),
      });
      expect(statusText()).toBe("Saved Essay. The plan is rebuilt.");
      expect(screen.queryByRole("form", { name: "Edit Essay" })).toBeNull();
    });

    test("Save with nothing changed closes the form without a request", () => {
      render(<AssignmentList assignments={[ESSAY]} />);
      fireEvent.click(screen.getByRole("button", { name: "Edit: Essay" }));

      fireEvent.click(
        within(screen.getByRole("form", { name: "Edit Essay" })).getByRole("button", {
          name: "Save",
        }),
      );

      expect(screen.queryByRole("form", { name: "Edit Essay" })).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test("shows the server's error and keeps the form open", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(400, {
          error: { code: "VALIDATION_ERROR", message: "Pick a real due date." },
        }),
      );
      render(<AssignmentList assignments={[ESSAY]} />);
      fireEvent.click(screen.getByRole("button", { name: "Edit: Essay" }));
      const form = screen.getByRole("form", { name: "Edit Essay" });

      fireEvent.change(within(form).getByLabelText("Title"), { target: { value: "Essay 2" } });
      fireEvent.click(within(form).getByRole("button", { name: "Save" }));

      expect((await screen.findByRole("alert")).textContent).toBe("Pick a real due date.");
      expect(screen.getByRole("form", { name: "Edit Essay" })).toBeDefined();
      expect(refreshMock).not.toHaveBeenCalled();
    });
  });

  describe("deleting", () => {
    test("Delete asks first on the page, and Cancel keeps the assignment", () => {
      const confirmSpy = vi.spyOn(window, "confirm");
      render(<AssignmentList assignments={[ESSAY]} />);

      fireEvent.click(screen.getByRole("button", { name: "Delete: Essay" }));

      expect(screen.getByText("Delete Essay? Its planned sessions go too.")).toBeDefined();
      expect(confirmSpy).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByText("Delete Essay? Its planned sessions go too.")).toBeNull();
      expect(screen.getByRole("button", { name: "Delete: Essay" })).toBeDefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test("Yes, delete sends DELETE, confirms it and refreshes the page", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      render(<AssignmentList assignments={[ESSAY]} />);

      fireEvent.click(screen.getByRole("button", { name: "Delete: Essay" }));
      fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

      await waitFor(() => expect(refreshMock).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith("/api/assignments/a1", { method: "DELETE" });
      expect(statusText()).toBe("Deleted Essay.");
    });

    test("shows the server's error when the delete fails", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, { error: { code: "NOT_FOUND", message: "Assignment not found." } }),
      );
      render(<AssignmentList assignments={[ESSAY]} />);

      fireEvent.click(screen.getByRole("button", { name: "Delete: Essay" }));
      fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

      expect((await screen.findByRole("alert")).textContent).toBe("Assignment not found.");
      expect(refreshMock).not.toHaveBeenCalled();
    });

    test("shows a plain message when the server can't be reached", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      render(<AssignmentList assignments={[ESSAY]} />);

      fireEvent.click(screen.getByRole("button", { name: "Delete: Essay" }));
      fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Could not reach the server. Try again.",
      );
    });
  });
});
