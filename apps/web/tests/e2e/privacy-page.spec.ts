/** The plain-English privacy page: public, accessible, and linked from student and staff screens. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEMO_SLUG, DEMO_STAFF, joinDemo, signIn } from "./helpers";

test("anyone can read it, and it covers what the app keeps and doesn't", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
  for (const heading of ["What LostBox keeps", "What LostBox never collects", "How photos are used", "Who can see staff-only information", "How long things are kept"]) {
    await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible();
  }
  await expect(page.getByText(/no ID upload anywhere/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test("linked from the home page, student screens, and staff screens", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);

  await joinDemo(page);
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  await page.goto(`/s/${DEMO_SLUG}/info`);
  await page.getByRole("link", { name: "What LostBox keeps about you" }).click();
  await expect(page).toHaveURL(/\/privacy$/);

  await signIn(page, DEMO_STAFF);
  for (const path of ["/admin", "/admin/claims", "/admin/settings"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  }
});

test("reads well on a phone in dark mode", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto("/privacy");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await ctx.close();
});
