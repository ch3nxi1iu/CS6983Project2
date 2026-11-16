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

test("a demo user marks a planned session done on the plan", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL("/dashboard");

  await page.goto("/plan");
  // The plan streams in after the page shell, so wait for it before counting.
  await expect(page.getByRole("list", { name: /^Sessions on / })).toHaveCount(7);
  const doneLabels = page.getByText("Done", { exact: true });
  const doneBefore = await doneLabels.count();
  const buttonsBefore = await page.getByRole("button", { name: /^Mark done: / }).count();
  expect(buttonsBefore).toBeGreaterThan(0);

  await page.getByRole("button", { name: /^Mark done: / }).first().click();

  // The page refreshes from the server with the session Done and the plan
  // rebuilt around the hours left (#14).
  await expect(doneLabels).toHaveCount(doneBefore + 1);
});

test("a demo user marks a session missed, then undoes it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL("/dashboard");

  await page.goto("/plan");
  await expect(page.getByRole("list", { name: /^Sessions on / })).toHaveCount(7);
  const missedLabels = page.getByText("Missed", { exact: true });
  const missedBefore = await missedLabels.count();

  const missButton = page.getByRole("button", { name: /^Mark missed: / }).first();
  const title = (await missButton.getAttribute("aria-label"))!.replace("Mark missed: ", "");
  await missButton.click();

  // The session shows as Missed, with an Undo button for it.
  await expect(missedLabels).toHaveCount(missedBefore + 1);
  const undo = page.getByRole("button", { name: `Undo: ${title}` });
  await expect(undo.first()).toBeVisible();

  await undo.first().click();
  await expect(missedLabels).toHaveCount(missedBefore);
});
