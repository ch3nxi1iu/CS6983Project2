import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import WeekForecast from "@/components/WeekForecast";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/planner/availability";
import { getForecast, type ForecastAssignment } from "@/lib/planner/forecast";

afterEach(cleanup);

const NOW = new Date("2026-11-18T15:00:00Z");

function assignment(title: string, hours: number, dueAt: string): ForecastAssignment {
  return {
    id: title,
    title,
    courseId: "c1",
    courseCode: "CS 5800",
    dueAt: new Date(dueAt),
    estimatedHours: hours,
    submitted: false,
  };
}

// Uses the real forecast function, so the component shows what users will see.
const weeks = getForecast({
  now: NOW,
  weeklyHours: DEFAULT_WEEKLY_HOURS,
  unavailableDates: [],
  assignments: [
    assignment("Essay draft", 4, "2026-11-20T12:00:00Z"),
    assignment("Final project", 20, "2026-11-25T12:00:00Z"),
    assignment("Lab report", 6, "2026-11-27T12:00:00Z"),
  ],
});

describe("WeekForecast", () => {
  test("shows each week's work against study hours", () => {
    render(<WeekForecast weeks={weeks} />);
    const week = screen.getByRole("button", { name: /Week of Nov 16/ });
    expect(week.textContent).toMatch(/4h of work/);
    expect(week.textContent).toMatch(/22h study time/);
    expect(screen.getAllByRole("button", { name: /^Week of/ })).toHaveLength(4);
  });

  test("labels crunch weeks in text, not only color", () => {
    render(<WeekForecast weeks={weeks} />);
    expect(screen.getByRole("button", { name: /Week of Nov 23/ }).textContent).toMatch(/Crunch week/);
    expect(screen.getByRole("button", { name: /Week of Nov 16/ }).textContent).not.toMatch(/Crunch/);
    expect(screen.getByText("1 crunch week ahead")).toBeDefined();
  });

  test("clicking a week lists the assignments behind it", () => {
    render(<WeekForecast weeks={weeks} />);
    fireEvent.click(screen.getByRole("button", { name: /Week of Nov 23/ }));
    const list = screen.getByRole("list", { name: "Assignments due the week of Nov 23" });
    expect(within(list).getByText("Final project")).toBeDefined();
    expect(within(list).getByText("Lab report")).toBeDefined();
    expect(within(list).queryByText("Essay draft")).toBeNull();
  });

  test("clicking a day lists only that day's assignments", () => {
    render(<WeekForecast weeks={weeks} />);
    fireEvent.click(screen.getByRole("button", { name: /Week of Nov 23/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fri, Nov 27/ }));
    const list = screen.getByRole("list", { name: "Assignments due Fri, Nov 27" });
    expect(within(list).getByText("Lab report")).toBeDefined();
    expect(within(list).queryByText("Final project")).toBeNull();
  });

  test("shows an empty message when nothing is due", () => {
    const empty = getForecast({
      now: NOW,
      weeklyHours: DEFAULT_WEEKLY_HOURS,
      unavailableDates: [],
      assignments: [],
    });
    render(<WeekForecast weeks={empty} />);
    expect(screen.getByText(/No crunch weeks ahead/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Week of Nov 16/ }));
    expect(screen.getByText("Nothing due this week.")).toBeDefined();
  });
});
