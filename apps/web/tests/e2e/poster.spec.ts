/** The QR code and the print poster: staff only, and always showing the current join code. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { joinLink, qrSvg } from "../../src/lib/qr";
import { DEMO_CODE, DEMO_SLUG, DEMO_STAFF, joinDemo, signIn } from "./helpers";

const APP_URL = "http://localhost:3100"; // APP_URL in playwright.config.ts
const POSTER = `/s/${DEMO_SLUG}/poster`;
const pathOf = (svg: string) => /<path fill="#000" d="([^"]+)"/.exec(svg)![1];

test("the poster needs a staff sign-in, not a student join", async ({ page }) => {
  await page.goto(POSTER);
  await expect(page).toHaveURL(/\/login\?next=/);
  await joinDemo(page);
  await page.goto(POSTER);
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("staff can't open another school's poster", async ({ page }) => {
  await signIn(page, DEMO_STAFF);
  expect((await page.goto("/s/not-my-school/poster"))?.status()).toBe(404);
});

test("poster and QR show the current code, and follow a code rotation", async ({ page }) => {
  await signIn(page, DEMO_STAFF);
  await page.goto(POSTER);
  const sheet = page.locator("main");
  await expect(sheet.getByRole("heading", { name: "Lost something?" })).toBeVisible();
  await expect(sheet.getByText("Scan to browse the lost and found.")).toBeVisible();
  await expect(sheet.getByText("Demo High School", { exact: true })).toBeVisible();
  await expect(sheet.getByText(DEMO_CODE, { exact: true })).toBeVisible();
  await expect(sheet.getByText("Front office, room 101")).toBeVisible();
  await expect(sheet.getByRole("img", { name: /QR code that opens LostBox/ })).toBeVisible();
  expect(await sheet.locator("svg[role=img] path").getAttribute("d")).toBe(pathOf(qrSvg(joinLink(APP_URL, DEMO_CODE), "")));

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // Printing hides the toolbar and the demo banner.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
  await expect(page.getByText(/Demo mode/)).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  // The settings QR is the same picture, drawn on the server.
  await page.goto("/admin/settings");
  await expect(page.getByRole("img", { name: /QR code that opens LostBox/ })).toBeVisible();
  const before = await (await page.request.get("/admin/join-qr")).text();
  expect(pathOf(before)).toBe(pathOf(qrSvg(joinLink(APP_URL, DEMO_CODE), "")));

  try {
    await page.getByRole("button", { name: "Make a new code" }).click();
    const code = page.locator("p.font-mono");
    await expect(code).not.toHaveText(DEMO_CODE);
    const fresh = (await code.textContent())!.trim();

    const after = await (await page.request.get("/admin/join-qr")).text();
    expect(pathOf(after)).toBe(pathOf(qrSvg(joinLink(APP_URL, fresh), "")));
    await expect(page.getByRole("img", { name: /QR code that opens LostBox/ })).toHaveAttribute("src", `/admin/join-qr?v=${fresh}`);

    await page.goto(POSTER);
    await expect(page.locator("main").getByText(fresh, { exact: true })).toBeVisible();
    expect(await page.locator("main svg[role=img] path").getAttribute("d")).toBe(pathOf(qrSvg(joinLink(APP_URL, fresh), "")));
  } finally {
    // Back to DEMO2026 for the other tests.
    await page.goto("/admin");
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await expect(page).toHaveURL(/reset=1/);
  }
});
