import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import DemoBanner from "@/components/DemoBanner";

const fetchMock = vi.fn();
const reload = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  reload.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { ...window.location, reload });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("marks the data as demo data", () => {
  render(<DemoBanner />);
  const banner = screen.getByRole("region", { name: "Demo mode" });
  expect(banner.textContent).toMatch(/sample data/i);
});

test("Reset demo data calls the API and reloads", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  render(<DemoBanner />);
  fireEvent.click(screen.getByRole("button", { name: "Reset demo data" }));

  await waitFor(() => expect(reload).toHaveBeenCalled());
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/demo/reset",
    expect.objectContaining({ method: "POST" }),
  );
});

test("a failed reset says so", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
  render(<DemoBanner />);
  fireEvent.click(screen.getByRole("button", { name: "Reset demo data" }));

  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/couldn't reset/i));
  expect(reload).not.toHaveBeenCalled();
});
