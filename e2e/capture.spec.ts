import { test, expect } from "@playwright/test";

test("login screen is the capture gate", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Margin").first()).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});
