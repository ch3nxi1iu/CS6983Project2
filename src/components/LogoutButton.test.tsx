import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import LogoutButton from "@/components/LogoutButton";

// Mock the network and the browser navigation, not our own logout code.
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

test("Log out ends the session and goes to the login page", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
  render(<LogoutButton />);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));

  await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/auth/logout",
    expect.objectContaining({ method: "POST" }),
  );
});

test("a failed log out says so and stays on the page", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
  render(<LogoutButton />);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));

  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/couldn't log out/i));
  expect(assign).not.toHaveBeenCalled();
});
