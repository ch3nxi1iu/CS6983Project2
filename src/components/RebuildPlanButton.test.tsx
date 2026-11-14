import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import RebuildPlanButton from "@/components/RebuildPlanButton";

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

describe("RebuildPlanButton", () => {
  test("POSTs to /api/plan and refreshes the page once the plan is rebuilt", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sessions: [], atRisk: [] }));
    render(<RebuildPlanButton />);

    fireEvent.click(screen.getByRole("button", { name: "Rebuild plan" }));

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plan",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getByRole("status").textContent).toContain("Plan rebuilt");
  });

  test("shows the server's error message and does not refresh when the plan cannot be rebuilt", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: { code: "AVAILABILITY_NOT_SET", message: "Set your study hours first." },
      }),
    );
    render(<RebuildPlanButton />);

    fireEvent.click(screen.getByRole("button", { name: "Rebuild plan" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Set your study hours first.");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
