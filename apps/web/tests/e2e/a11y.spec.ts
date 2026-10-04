/**
 * Automated accessibility check (axe-core, WCAG 2.1 A and AA rules) on the
 * screens people see most. Automated checks catch roughly a third of issues;
 * keyboard and screen reader passes are still needed by hand.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { DEMO_SLUG, DEMO_STAFF, joinDemo, signIn } from "./helpers";

async function expectNoViolations(page: Page, name: string) {
  // After a client-side navigation React swaps the <title> in; checking in that
  // instant reports a page with no title. Wait until the new page is settled.
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary, `${name} has accessibility violations`).toEqual([]);
}

test("public and student pages", async ({ page }) => {
  await page.goto("/");
  await expectNoViolations(page, "home");
  await page.goto("/login");
  await expectNoViolations(page, "login");
  await joinDemo(page);
  await expectNoViolations(page, "gallery");
  await page.getByRole("link", { name: /Water bottle/ }).first().click();
  await expectNoViolations(page, "item detail");
  await page.goto(`/s/${DEMO_SLUG}/status`);
  await expectNoViolations(page, "claim status");
});

test("staff pages", async ({ page }) => {
  await signIn(page, DEMO_STAFF);
  for (const [path, name] of [
    ["/admin", "items"],
    ["/admin/items/new", "intake"],
    ["/admin/claims", "claims"],
    ["/admin/settings", "settings"],
  ]) {
    await page.goto(path);
    await expectNoViolations(page, name);
  }
});

test("dark mode keeps contrast", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  await joinDemo(page);
  await expectNoViolations(page, "gallery (dark)");
  await ctx.close();
});

test("phone layout: tab bars, item screen, and pickup tab", async ({ browser }) => {
  // Phone-sized viewport, where the bottom tab bars and the item screen's action bar appear.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await joinDemo(page);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Browse" })).toHaveAttribute("aria-current", "page");
  await expectNoViolations(page, "gallery (phone)");
  await page.getByRole("link", { name: /Water bottle/ }).first().click();
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expectNoViolations(page, "item detail (phone)");
  await page.goto(`/s/${DEMO_SLUG}/info`);
  await expect(page.getByText("Front office, room 101", { exact: true })).toBeVisible();
  await expectNoViolations(page, "pickup (phone)");
  await signIn(page, DEMO_STAFF);
  await page.goto("/admin");
  await expect(page.getByRole("navigation", { name: "Staff" }).getByRole("link", { name: "Add" })).toBeVisible();
  await expectNoViolations(page, "staff items (phone)");
  await ctx.close();
});
