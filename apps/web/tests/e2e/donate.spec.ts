/** "Ready to donate": the seeded demo has items older than its donate-after period. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEMO_STAFF, signIn } from "./helpers";

test("staff select old items, confirm, and they're marked donated", async ({ page }) => {
  await signIn(page, DEMO_STAFF);
  await page.getByRole("link", { name: /items are ready to donate/ }).click();
  await expect(page.getByRole("heading", { name: "Ready to donate", level: 1 })).toBeVisible();

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  const boxes = page.getByRole("checkbox", { name: /^Select (?!all)/ });
  const count = await boxes.count();
  expect(count).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole("button", { name: "Select items to donate" })).toBeDisabled();

  // One item, then all of them.
  await boxes.first().check();
  await expect(page.getByRole("button", { name: "Mark 1 donated" })).toBeEnabled();
  await page.getByRole("checkbox", { name: /Select all/ }).check();
  await page.getByRole("button", { name: `Mark ${count} donated` }).click();

  // Nothing happens until it's confirmed; Cancel backs out.
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: `Mark ${count} donated` }).click();
  await expect(page.getByRole("alertdialog")).toBeFocused();
  await page.getByRole("button", { name: "Yes, mark donated" }).click();

  await expect(page.getByText(`Marked ${count} items as donated.`)).toBeVisible();
  await expect(page.getByText("Nothing to donate right now")).toBeVisible();

  await page.goto("/admin?status=donated");
  await expect(page.locator("main li").getByText("Donated", { exact: true }).first()).toBeVisible();

  // Leave the demo as the other tests expect it.
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect(page.getByRole("link", { name: /items are ready to donate/ })).toBeVisible();
});
