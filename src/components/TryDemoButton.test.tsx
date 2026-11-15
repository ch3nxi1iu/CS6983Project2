import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import TryDemoButton from "@/components/TryDemoButton";

const fetchMock = vi.fn();
const assign = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  assign.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { ...window.location, assign });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("Try the demo opens a demo session and goes to the dashboard", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ user: { id: "demo", name: "Demo student", isDemo: true } }), {
      status: 201,
    }),
  );
  render(<TryDemoButton />);
  fireEvent.click(screen.getByRole("button", { name: "Try the demo" }));

  await waitFor(() => expect(assign).toHaveBeenCalledWith("/dashboard"));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/auth/demo",
    expect.objectContaining({ method: "POST" }),
  );
});

test("a failed demo says so and stays on the page", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
  render(<TryDemoButton />);
  fireEvent.click(screen.getByRole("button", { name: "Try the demo" }));

  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toMatch(/couldn't open the demo/i),
  );
  expect(assign).not.toHaveBeenCalled();
});
