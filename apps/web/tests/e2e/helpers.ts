import { expect, type BrowserContext, type Page } from "@playwright/test";

export const DEMO_STAFF = "demo@lostbox.test";
export const DEMO_CODE = "DEMO2026";
export const DEMO_SLUG = "demo-high-school";

type Cookies = Awaited<ReturnType<BrowserContext["cookies"]>>;
const sessions = new Map<string, Cookies>();

/**
 * Signs in with a magic link. In demo mode the link is shown on the page instead of emailed.
 *
 * The first sign-in per email goes through the real form; later ones reuse its
 * session cookie. The app allows only a few sign-in emails per address and per
 * network each hour (see LIMITS in src/lib/server/rate-limit.ts), and the whole
 * suite would otherwise trip that limit itself.
 */
export async function signIn(page: Page, email: string, next = "/admin") {
  const saved = sessions.get(email);
  if (saved) {
    await page.context().addCookies(saved);
    await page.goto(next);
    if (!page.url().includes("/login")) return;
  }
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("School email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const link = page.getByRole("link", { name: "Open sign-in link" });
  await expect(link).toBeVisible();
  await page.goto((await link.getAttribute("href"))!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth") && !u.pathname.startsWith("/login"));
  sessions.set(email, await page.context().cookies());
}

export async function joinDemo(page: Page) {
  await page.goto("/");
  await page.getByLabel("Join code").fill(DEMO_CODE.toLowerCase());
  await page.getByRole("button", { name: "Find my school" }).click();
  await page.waitForURL(`**/s/${DEMO_SLUG}`);
}
