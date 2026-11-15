import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "@/app/page";

test("landing page offers the demo, sign up, and log in", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1, name: "Loadline" })).toBeDefined();
  expect(screen.getByText("See crunch weeks coming and start in time")).toBeDefined();
  expect(screen.getByRole("button", { name: "Try the demo" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/register");
  expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login");
});
