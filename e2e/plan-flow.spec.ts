import { expect, test } from "@playwright/test";

// The first-visit flow (#6): sign up, save study hours, then see the plan and
// the dashboard. Each run signs up a new user, so it doesn't depend on data
// already in the database.

test("a signed-out visit to the dashboard goes to the login page", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Log in to Loadline" })).toBeVisible();
});

test("a new user signs up, saves study hours, and sees the plan and dashboard", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;

  await test.step("sign up", async () => {
    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("e2e-password-123");
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    // No study hours saved yet, so there's no plan.
    await expect(page.getByRole("link", { name: "Set your study hours" })).toBeVisible();
  });

  await test.step("save study hours", async () => {
    await page.goto("/settings/availability");
    await expect(page.getByRole("heading", { level: 1, name: "Your study hours" })).toBeVisible();
    await expect(page.getByText("These are prefilled defaults.")).toBeVisible();

    const monday = page.getByRole("group", { name: "Monday" });
    await expect(monday).toContainText("3h");
    await page.getByRole("button", { name: "More Monday hours" }).click();
    await expect(monday).toContainText("3.5h");
    await page.getByRole("button", { name: "Save hours" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Saved. Your plan and forecast use these hours.",
    );

    // The hours are saved on the server, not just shown in the page.
    await page.reload();
    await expect(page.getByRole("group", { name: "Monday" })).toContainText("3.5h");
    await expect(page.getByText("22.5h a week")).toBeVisible();
    await expect(page.getByText("These are prefilled defaults.")).toBeHidden();
  });

  await test.step("open the work plan", async () => {
    await page.goto("/plan");

    await expect(page.getByRole("heading", { level: 1, name: "Work plan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Study hours not set" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Rebuild plan" })).toBeVisible();
    await expect(page.getByRole("list", { name: /^Sessions on / })).toHaveCount(7);
    await expect(page.getByRole("heading", { name: "At risk" })).toBeVisible();
    // A new user has no assignments, so nothing is at risk.
    await expect(page.getByText("Everything fits inside your study hours.")).toBeVisible();
  });

  await test.step("open the dashboard", async () => {
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

    const forecast = page.getByRole("region", { name: "Forecast", exact: true });
    await expect(forecast.getByText("No overloaded weeks ahead.")).toBeVisible();
    await expect(forecast.getByRole("button", { name: /^Week of / })).toHaveCount(4);

    const today = page.getByRole("region", { name: "Today", exact: true });
    await expect(today.getByText("Nothing planned for today.")).toBeVisible();
    await expect(today.getByRole("link", { name: "See the full plan" })).toBeVisible();
    await expect(today.getByRole("link", { name: "Set your study hours" })).toBeHidden();
  });
});

test("a new user adds their own assignment and sees it in the plan", async ({ page }) => {
  const email = `e2e-add-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/dashboard");

  await page.goto("/settings/availability");
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved. Your plan and forecast use these hours.");

  await page.goto("/plan");
  const dueDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Course").fill("CS 6983");
  await page.getByLabel("Title").fill("Final reflection");
  await page.getByLabel("Due date").fill(dueDate);
  await page.getByLabel("Estimated hours").fill("3");
  await page.getByRole("button", { name: "Add assignment" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Added Final reflection" })).toBeVisible();
  await expect(page.getByRole("list", { name: /^Sessions on / }).getByText("Final reflection").first()).toBeVisible();
});

test("a user edits the hours of their own assignment, then deletes it from the plan", async ({
  page,
}) => {
  const email = `e2e-edit-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/dashboard");

  await page.goto("/settings/availability");
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved. Your plan and forecast use these hours.");

  await page.goto("/plan");
  const sessionLists = page.getByRole("list", { name: /^Sessions on / });
  const yourAssignments = page.getByRole("region", { name: "Your assignments" });
  await expect(sessionLists).toHaveCount(7);
  await expect(yourAssignments.getByText("No assignments yet. Add one above.")).toBeVisible();

  const dueDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const addForm = page.getByRole("region", { name: "Add an assignment" });
  await addForm.getByLabel("Course").fill("CS 6983");
  await addForm.getByLabel("Title").fill("Final reflection");
  await addForm.getByLabel("Due date").fill(dueDate);
  await addForm.getByLabel("Estimated hours").fill("3");
  await addForm.getByRole("button", { name: "Add assignment" }).click();
  await expect(yourAssignments.getByText("0h of 3h done")).toBeVisible();
  await expect(sessionLists.getByText("Final reflection").first()).toBeVisible();

  await test.step("edit its hours", async () => {
    await yourAssignments.getByRole("button", { name: "Edit: Final reflection" }).click();
    const editForm = yourAssignments.getByRole("form", { name: "Edit Final reflection" });
    await editForm.getByLabel("Estimated hours").fill("5");
    await editForm.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "Saved Final reflection. The plan is rebuilt." }),
    ).toBeVisible();
    await expect(yourAssignments.getByText("0h of 5h done")).toBeVisible();

    // The new estimate is saved on the server, not just shown in the page.
    await page.reload();
    await expect(sessionLists).toHaveCount(7);
    await expect(yourAssignments.getByText("0h of 5h done")).toBeVisible();
  });

  await test.step("delete it", async () => {
    await yourAssignments.getByRole("button", { name: "Delete: Final reflection" }).click();
    await expect(
      yourAssignments.getByText("Delete Final reflection? Its planned sessions go too."),
    ).toBeVisible();
    await yourAssignments.getByRole("button", { name: "Yes, delete" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "Deleted Final reflection." }),
    ).toBeVisible();
    await expect(yourAssignments.getByText("No assignments yet. Add one above.")).toBeVisible();

    // Gone from the plan too, also after a reload. Wait for the streamed
    // plan before counting, so an unloaded plan can't pass the check.
    await page.reload();
    await expect(sessionLists).toHaveCount(7);
    await expect(yourAssignments.getByText("No assignments yet. Add one above.")).toBeVisible();
    await expect(sessionLists.getByText("Final reflection")).toHaveCount(0);
  });
});
