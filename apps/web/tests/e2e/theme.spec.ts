/**
 * The light/dark theme: the choice is a cookie the SERVER reads, so the very
 * first HTML already carries the right data-theme (no flash, no script).
 */
import { expect, test } from "@playwright/test";
import { DEMO_SLUG, joinDemo, THEME_COOKIE } from "./helpers";

const LIGHT_BG = "rgb(255, 255, 255)";
const DARK_BG = "rgb(11, 20, 36)";

/** The <html ...> opening tag from the raw response body, before any JavaScript could touch it. */
function htmlTag(body: string): string {
  return body.match(/<html[^>]*>/)?.[0] ?? "";
}

test("the server puts the cookie's theme in the first HTML response", async ({ request }) => {
  for (const theme of ["dark", "light"] as const) {
    const res = await request.get("/", { headers: { cookie: `${THEME_COOKIE}=${theme}` } });
    const body = await res.text();
    expect(htmlTag(body)).toContain(`data-theme="${theme}"`);
    // One fixed address-bar color, matching that theme's background.
    expect(body.match(/<meta name="theme-color"[^>]*>/g)).toEqual([`<meta name="theme-color" content="${theme === "dark" ? "#0b1424" : "#ffffff"}"/>`]);
  }
});

test("System (no cookie) and junk cookie values set no data-theme", async ({ request }) => {
  for (const cookie of ["", `${THEME_COOKIE}=system`, `${THEME_COOKIE}=%22%3E%3Cscript%3E`, `${THEME_COOKIE}=blue`]) {
    const res = await request.get("/", { headers: cookie ? { cookie } : {} });
    const body = await res.text();
    expect(htmlTag(body), `cookie: ${cookie || "(none)"}`).not.toContain("data-theme");
    // System sends both colors and lets the device pick.
    const metas = body.match(/<meta name="theme-color"[^>]*>/g) ?? [];
    expect(metas).toHaveLength(2);
    expect(metas.find((m) => m.includes("(prefers-color-scheme: light)"))).toContain('content="#ffffff"');
    expect(metas.find((m) => m.includes("(prefers-color-scheme: dark)"))).toContain('content="#0b1424"');
  }
});

test("a chosen theme beats the device setting", async ({ browser }) => {
  // The device says dark, the person chose Light: Light wins. And the reverse.
  for (const [device, chosen, bg] of [
    ["dark", "light", LIGHT_BG],
    ["light", "dark", DARK_BG],
  ] as const) {
    const ctx = await browser.newContext({ colorScheme: device });
    await ctx.addCookies([{ name: THEME_COOKIE, value: chosen, url: "http://localhost:3100" }]);
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator("body")).toHaveCSS("background-color", bg);
    await ctx.close();
  }
});

test("students switch theme on the Pickup tab with the keyboard, and it sticks", async ({ page }) => {
  await joinDemo(page);
  await page.goto(`/s/${DEMO_SLUG}/info`);
  const group = page.getByRole("main").getByRole("group", { name: "Theme" });
  await expect(group.getByRole("radio", { name: "System" })).toBeChecked();

  // Arrow keys move through a radio group: System -> Light -> Dark.
  await group.getByRole("radio", { name: "System" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", DARK_BG);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0b1424");

  // The choice is a cookie, so it survives a reload and applies to other pages.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Back to System removes the attribute again.
  await page.goto(`/s/${DEMO_SLUG}/info`);
  await page.getByRole("main").getByRole("radio", { name: "System" }).check();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
});

test("the header has a compact, labelled theme switch on wide screens", async ({ page }) => {
  await joinDemo(page);
  const header = page.getByRole("banner").getByRole("group", { name: "Theme" });
  await expect(header.getByRole("radio")).toHaveCount(3);
  await header.getByRole("radio", { name: "Dark" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await header.getByRole("radio", { name: "Light" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
