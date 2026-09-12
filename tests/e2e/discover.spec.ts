import { test, expect } from "@playwright/test";

test("discover: search, filter pivot, detail panel", async ({ page }) => {
  await page.goto("/discover?from=now-24h");
  await expect(page.getByText("rows scanned")).toBeVisible();

  const input = page.getByPlaceholder(/level:error/);
  await input.fill("level:error");
  await input.press("Enter");
  await expect(page).toHaveURL(/q=level(%3A|:)error/);
  await expect(page.locator("text=ERROR").first()).toBeVisible();

  // sidebar pivot: open "service" and add the first value as a filter
  await page.getByRole("button", { name: "service", exact: true }).click();
  const firstValue = page.locator("aside .group\\/v").first();
  await firstValue.hover();
  await firstValue.getByTitle("Filter for").click();
  await expect(page).toHaveURL(/service(%3A|:)/);

  // detail panel opens on row click
  await page.getByTestId("log-row").first().click();
  await expect(page.getByText("attributes", { exact: true })).toBeVisible();
});

test("sql mode runs a read-only query", async ({ page }) => {
  await page.goto("/discover?mode=sql");
  await page.getByPlaceholder(/SELECT service/).fill("SELECT count() AS n FROM clickpower.logs");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.locator("th", { hasText: "n" })).toBeVisible();
});
