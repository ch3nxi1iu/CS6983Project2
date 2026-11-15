import { expect, test } from "@playwright/test";

// Demo mode (#10): a visitor tries the app with sample data and no account.
// The sample data has more work than study time next week, so the forecast
// shows an overloaded week.

test("a visitor opens the demo from the landing page and sees sample data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("region", { name: "Demo mode" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

  const forecast = page.getByRole("region", { name: "Forecast", exact: true });
  await expect(forecast.getByText(/^\d+ overloaded weeks? ahead$/)).toBeVisible();
  await expect(forecast.getByText("Overloaded week", { exact: true }).first()).toBeVisible();
});
