import { expect, test } from "@playwright/test";

// Smoke tests (#6): the public pages load in a real browser.

test("the landing page loads", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("Loadline");
  await expect(page.getByRole("heading", { level: 1, name: "Loadline" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
});

test("the login page loads", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { level: 1, name: "Log in to Loadline" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});
