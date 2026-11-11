import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AvailabilitySettings from "@/components/AvailabilitySettings";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/planner/availability";

// We mock fetch (the network), not our own save code, so the component's real
// save path runs (AGENTS.md, Testing strategy).
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
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

function renderSettings(props: Partial<Parameters<typeof AvailabilitySettings>[0]> = {}) {
  return render(
    <AvailabilitySettings
      initialWeeklyHours={DEFAULT_WEEKLY_HOURS}
      initialUnavailableDates={[]}
      isSet={false}
      {...props}
    />,
  );
}

function dayRow(day: string) {
  return screen.getByRole("group", { name: day });
}

describe("weekly hours", () => {
  test("shows the prefilled defaults and a 22h weekly total", () => {
    renderSettings();
    expect(within(dayRow("Monday")).getByText("3h")).toBeDefined();
    expect(within(dayRow("Friday")).getByText("2h")).toBeDefined();
    expect(within(dayRow("Sunday")).getByText("4h")).toBeDefined();
    expect(screen.getByText("22h a week")).toBeDefined();
    expect(screen.getByText(/prefilled defaults/i)).toBeDefined();
  });

  test("steppers change a day by half an hour and update the total", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "More Monday hours" }));
    expect(within(dayRow("Monday")).getByText("3.5h")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Fewer Friday hours" }));
    expect(within(dayRow("Friday")).getByText("1.5h")).toBeDefined();
    expect(screen.getByText("22h a week")).toBeDefined();
  });

  test("hours stay between 0 and 12", () => {
    renderSettings({
      initialWeeklyHours: { ...DEFAULT_WEEKLY_HOURS, monday: 0, tuesday: 12 },
    });
    expect(
      (screen.getByRole("button", { name: "Fewer Monday hours" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "More Tuesday hours" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test("Save sends every day's hours to the API and confirms", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { weeklyHours: DEFAULT_WEEKLY_HOURS }));
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "More Saturday hours" }));
    fireEvent.click(screen.getByRole("button", { name: "Save hours" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/saved/i));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/availability",
      expect.objectContaining({ method: "PUT" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ ...DEFAULT_WEEKLY_HOURS, saturday: 4.5 });
  });

  test("a failed save shows the API's error message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Hours must be 0–12." } }),
    );
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Save hours" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Hours must be 0–12."));
  });
});

describe("unavailable dates", () => {
  test("marking a date sends it with the reason and lists it", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, { id: "d1", date: "2026-11-20", reason: "Interview" }),
    );
    renderSettings();
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-11-20" } });
    fireEvent.change(screen.getByLabelText("Reason (optional)"), {
      target: { value: "Interview" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark unavailable" }));

    const list = await screen.findByRole("list", { name: "Unavailable dates" });
    expect(within(list).getByText(/Interview/)).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/unavailable-dates",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      date: "2026-11-20",
      reason: "Interview",
    });
  });

  test("removing a date deletes it through the API", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    renderSettings({
      initialUnavailableDates: [{ id: "d1", date: "2026-11-20", reason: "Interview" }],
    });
    fireEvent.click(screen.getByRole("button", { name: /Remove Fri, Nov 20/ }));

    await waitFor(() =>
      expect(screen.queryByRole("list", { name: "Unavailable dates" })).toBeNull(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/unavailable-dates/d1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
