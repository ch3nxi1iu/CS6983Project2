import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import RegisterPage from "@/app/register/page";

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

describe("RegisterPage", () => {
  test("renders labeled email and password inputs and a submit button", () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /sign up|create account/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /log in|sign in/i })).toBeDefined();
  });

  test("submits registration and shows error announced to screen readers if registration fails", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: { code: "EMAIL_EXISTS", message: "An account with this email already exists." },
      }),
    );

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "SecretPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign up|create account/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeDefined();
      expect(alert.textContent).toContain("An account with this email already exists.");
    });
  });

  test("submits registration credentials to /api/auth/register", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, {
        user: { id: "u1", email: "new@example.com" },
      }),
    );

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "SecretPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign up|create account/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "new@example.com",
            password: "SecretPass123!",
            name: undefined,
          }),
        }),
      );
    });
  });
});
