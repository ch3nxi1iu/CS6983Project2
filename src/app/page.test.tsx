import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "@/app/page";

test("home page renders", () => {
  render(<Home />);
  expect(screen.getByText("Hello world!")).toBeDefined();
});
