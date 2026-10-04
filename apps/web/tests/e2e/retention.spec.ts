/** The daily retention route only runs with the cron secret (CRON_SECRET in playwright.config.ts). */
import { expect, test } from "@playwright/test";

const CRON_SECRET = "e2e-only-cron-secret-0123456789";
const URL = "/api/cron/retention";

test("the retention route refuses calls without the right secret", async ({ request }) => {
  expect((await request.get(URL)).status()).toBe(401);
  expect((await request.get(URL, { headers: { Authorization: "Bearer wrong-secret-0123456789" } })).status()).toBe(401);
  expect((await request.get(URL, { headers: { Authorization: CRON_SECRET } })).status()).toBe(401);
});

test("the retention route runs with the secret and reports counts only", async ({ request }) => {
  const res = await request.get(URL, { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Object.keys(body).sort()).toEqual(["deleted", "failed"]);
  expect(body.failed).toBe(0);
});
