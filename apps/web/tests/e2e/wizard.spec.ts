/** The setup wizard creates a school, and closing the browser mid-way resumes at the right step. */
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a new admin sets up a school, leaves, comes back, and finishes", async ({ browser }) => {
  const email = `principal-${Date.now()}@example.k12.ca.us`;
  let ctx = await browser.newContext();
  let page = await ctx.newPage();
  await signIn(page, email, "/setup");
  await expect(page).toHaveURL(/\/setup\/2$/);
  await page.getByLabel("School name").fill("Riverside Middle School");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/setup\/3$/);
  await page.getByRole("button", { name: "+ Gym" }).click();
  await page.getByRole("button", { name: "+ Library" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/setup\/4$/);
  await ctx.close();

  // "Close the browser": a new context has no cookies.
  ctx = await browser.newContext();
  page = await ctx.newPage();
  await signIn(page, email, "/setup");
  await expect(page).toHaveURL(/\/setup\/4$/);
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();

  // Wallets can never be Full.
  await expect(page.getByRole("group", { name: "Wallet, ID, or cards" }).getByLabel("Full")).toBeDisabled();
  await page.getByRole("button", { name: /Strict/ }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.getByLabel("Pickup location").fill("Main office");
  await page.getByLabel("Pickup hours").fill("8 to 3");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/setup\/6$/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/setup\/7$/);
  const code = (await page.locator("p.code-text").textContent())!.trim();
  expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  await page.getByRole("button", { name: /Launch/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await ctx.close();
});
