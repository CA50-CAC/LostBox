/** School approval at /platform/schools: platform admins only, and it really switches the join code. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEMO_CODE, DEMO_STAFF, signIn } from "./helpers";

const PLATFORM_ADMIN = "platform@lostbox.test"; // PLATFORM_ADMIN_EMAILS in playwright.config.ts

test("staff who aren't platform admins get a 404", async ({ page }) => {
  await signIn(page, DEMO_STAFF);
  const res = await page.goto("/platform/schools");
  expect(res?.status()).toBe(404);
});

test("a platform admin rejects and re-approves a school", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, PLATFORM_ADMIN, "/platform/schools");
  await expect(page.getByRole("heading", { name: "Schools", level: 1 })).toBeVisible();

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("link", { name: "Approved" }).click();
  const card = page.getByRole("article", { name: "Demo High School" });
  try {
    await card.getByRole("button", { name: /Reject/ }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    // Students can't join a rejected school.
    const student = await browser.newPage();
    await student.goto("/");
    await student.getByLabel("Join code").fill(DEMO_CODE);
    await student.getByRole("button", { name: "Find my school" }).click();
    await expect(student.getByText(/couldn.t find a school/)).toBeVisible();
    await student.close();
  } finally {
    await page.goto("/platform/schools?view=rejected");
    await page.getByRole("article", { name: "Demo High School" }).getByRole("button", { name: /Approve/ }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  }
  await ctx.close();
});
