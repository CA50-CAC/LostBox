/**
 * Automated accessibility check (axe-core, WCAG 2.1 A and AA rules) on the
 * screens people see most, in both the Light and the Dark theme. Automated
 * checks catch roughly a third of issues; keyboard and screen reader passes
 * are still needed by hand.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { chooseTheme, DEMO_SLUG, DEMO_STAFF, joinDemo, signIn, type ChosenTheme } from "./helpers";

async function expectNoViolations(page: Page, name: string) {
  // After a client-side navigation React swaps the <title> in; checking in that
  // instant reports a page with no title. Wait until the new page is settled.
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary, `${name} has accessibility violations`).toEqual([]);
}

const THEMES: ChosenTheme[] = ["light", "dark"];

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test("public and student pages", async ({ page }) => {
      await chooseTheme(page.context(), theme);
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectNoViolations(page, `home (${theme})`);
      await page.goto("/login");
      await expectNoViolations(page, `login (${theme})`);
      await page.goto("/privacy");
      await expectNoViolations(page, `privacy (${theme})`);
      await joinDemo(page);
      await expectNoViolations(page, `gallery (${theme})`);
      await page.getByRole("link", { name: /Water bottle/ }).first().click();
      await expectNoViolations(page, `item detail (${theme})`);
      await page.goto(`/s/${DEMO_SLUG}/status`);
      await expectNoViolations(page, `claim status (${theme})`);
      await page.goto(`/s/${DEMO_SLUG}/info`);
      await expectNoViolations(page, `pickup (${theme})`);
    });

    test("staff pages", async ({ page }) => {
      await chooseTheme(page.context(), theme);
      await signIn(page, DEMO_STAFF);
      for (const [path, name] of [
        ["/admin", "items"],
        ["/admin/items/new", "intake"],
        ["/admin/claims", "claims"],
        ["/admin/donate", "donate"],
        ["/admin/stats", "stats"],
        ["/admin/settings", "settings"],
      ]) {
        await page.goto(path);
        await expectNoViolations(page, `${name} (${theme})`);
      }
    });

    test("setup wizard privacy step", async ({ page }) => {
      await chooseTheme(page.context(), theme);
      await signIn(page, `a11y-${theme}-${Date.now()}@example.k12.ca.us`, "/setup");
      await page.getByLabel("School name").fill("Axe Check School");
      await page.getByRole("button", { name: "Save and continue" }).click();
      await expect(page).toHaveURL(/\/setup\/3$/);
      await expectNoViolations(page, `wizard places (${theme})`);
      await page.getByRole("button", { name: "+ Gym" }).click();
      await page.getByRole("button", { name: "Save and continue" }).click();
      await expect(page).toHaveURL(/\/setup\/4$/);
      await expectNoViolations(page, `wizard privacy (${theme})`);
    });

    test("phone layout: tab bars, item screen, and pickup tab", async ({ browser }) => {
      // Phone-sized viewport, where the bottom tab bars and the item screen's action bar appear.
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await chooseTheme(ctx, theme);
      const page = await ctx.newPage();
      await joinDemo(page);
      await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Browse" })).toHaveAttribute("aria-current", "page");
      await expectNoViolations(page, `gallery (phone, ${theme})`);
      await page.getByRole("link", { name: /Water bottle/ }).first().click();
      await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
      await expectNoViolations(page, `item detail (phone, ${theme})`);
      await page.goto(`/s/${DEMO_SLUG}/info`);
      await expect(page.getByText("Front office, room 101", { exact: true })).toBeVisible();
      await expectNoViolations(page, `pickup (phone, ${theme})`);
      await signIn(page, DEMO_STAFF);
      await page.goto("/admin");
      await expect(page.getByRole("navigation", { name: "Staff" }).getByRole("link", { name: "Add" })).toBeVisible();
      await expectNoViolations(page, `staff items (phone, ${theme})`);
      await ctx.close();
    });
  });
}

test("System theme follows a dark device and keeps contrast", async ({ browser }) => {
  // No theme cookie: the prefers-color-scheme media query picks the colors.
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  await joinDemo(page);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
  await expectNoViolations(page, "gallery (system dark)");
  await ctx.close();
});
