/** The impact dashboard on the seeded demo school (which has a month of returns and donations). */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEMO_STAFF, signIn } from "./helpers";

const axe = async (page: import("@playwright/test").Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => v.id);

test("staff see the numbers and can change the period", async ({ page }) => {
  await signIn(page, DEMO_STAFF);
  // Other tests return and add items; start from the seeded state.
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect(page).toHaveURL(/reset=1/);
  await page.getByRole("navigation", { name: "Staff" }).first().getByRole("link", { name: "Impact" }).click();
  await expect(page.getByRole("heading", { name: "Impact", level: 1 })).toBeVisible();

  // 30 days by default: the demo's returns and donations are all inside it.
  await expect(page.getByRole("link", { name: "30 days" })).toHaveAttribute("aria-current", "page");
  const tile = (label: string) => page.locator(".card").filter({ has: page.getByText(label, { exact: true }) }).first();
  await expect(tile("Items returned")).toContainText("9");
  await expect(tile("Items donated")).toContainText("2");
  await expect(tile("Claims pending")).toContainText("1");
  await expect(tile("Items waiting")).toContainText("24");
  await expect(page.getByText(/^\d+%$/)).toBeVisible();
  await expect(page.getByText(/of \d+ items logged in this period are back with their owners/)).toBeVisible();
  expect(await axe(page)).toEqual([]);

  // The chart's numbers are reachable by keyboard and as a table.
  await page.getByText("Show as a table").click();
  const rows = page.locator("table tbody tr");
  expect(await rows.count()).toBeGreaterThanOrEqual(4);
  const sum = (await rows.locator("td:last-child").allTextContents()).reduce((a, v) => a + Number(v), 0);
  expect(sum).toBe(9);

  // 7 days: fewer returns.
  await page.getByRole("link", { name: "7 days" }).click();
  await expect(page.getByRole("link", { name: "7 days" })).toHaveAttribute("aria-current", "page");
  await expect(tile("Items donated")).toContainText("0");

  // A custom range with nothing in it.
  await page.getByLabel("From").fill("2020-01-01");
  await page.getByLabel("To").fill("2020-01-31");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page).toHaveURL(/range=custom/);
  await expect(page.getByText("No items were logged in this period.")).toBeVisible();
  await expect(page.getByText("No returns yet")).toBeVisible();
});

test("the dashboard has no student details in it", async ({ page }) => {
  await signIn(page, DEMO_STAFF);
  await page.goto("/admin/stats?range=all");
  const html = await page.content();
  for (const secret of ["lock screen", "initials", "Lucky", "R. Ortiz", "golden retriever", "office safe"]) expect(html).not.toContain(secret);
});

test("the dashboard works in dark mode on a phone", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, colorScheme: "dark" });
  const page = await ctx.newPage();
  await signIn(page, DEMO_STAFF, "/admin/stats");
  await expect(page.getByRole("heading", { name: "Impact", level: 1 })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  await ctx.close();
});
