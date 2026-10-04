/**
 * Quick checks against a running deployment, with no sign-in and no data
 * changes. Run after every production deploy:
 *
 *   pnpm smoke https://your-lostbox-url
 *
 * It checks the public pages load, private pages refuse anonymous visitors,
 * school pages carry `noindex`, and no secret-looking value appears in the
 * HTML. The steps that need a real inbox or a phone (magic links, a claim from
 * start to finish) are listed in docs/DEPLOY.md, section 5.
 *
 * Optional: SUPABASE_SECRET_KEY in the environment also checks that exact value
 * never appears in any page.
 */
const base = (process.argv[2] || process.env.SMOKE_URL || "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Usage: pnpm smoke <base url>, e.g. pnpm smoke https://lostbox.example.org");
  process.exit(2);
}

const secret = process.env.SUPABASE_SECRET_KEY || "";
const results = [];

async function get(path) {
  const res = await fetch(base + path, { redirect: "manual", headers: { "user-agent": "lostbox-smoke" } });
  const body = res.status >= 300 && res.status < 400 ? "" : await res.text();
  return { res, body };
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, why: err instanceof Error ? err.message : String(err) });
  }
}

function expect(cond, why) {
  if (!cond) throw new Error(why);
}

function noSecrets(body) {
  expect(!/sb_secret_[A-Za-z0-9_-]{6,}/.test(body), "page contains something that looks like a Supabase secret key");
  expect(!secret || !body.includes(secret), "page contains SUPABASE_SECRET_KEY");
}

const isRedirectTo = (res, target) =>
  res.status >= 300 && res.status < 400 && new URL(res.headers.get("location") ?? "", base).pathname === target;

await check("home page loads", async () => {
  const { res, body } = await get("/");
  expect(res.status === 200, `status ${res.status}`);
  expect(body.includes("LostBox"), "no LostBox name in the page");
  noSecrets(body);
});

await check("privacy page loads", async () => {
  const { res, body } = await get("/privacy");
  expect(res.status === 200, `status ${res.status}`);
  noSecrets(body);
});

await check("staff sign-in page loads and is noindex", async () => {
  const { res, body } = await get("/login");
  expect(res.status === 200, `status ${res.status}`);
  expect((res.headers.get("x-robots-tag") ?? "").includes("noindex"), "missing X-Robots-Tag: noindex");
  noSecrets(body);
});

await check("staff pages send anonymous visitors to sign in", async () => {
  for (const path of ["/admin", "/admin/claims", "/admin/settings"]) {
    const { res } = await get(path);
    expect(isRedirectTo(res, "/login"), `${path}: expected a redirect to /login, got ${res.status} ${res.headers.get("location") ?? ""}`);
  }
});

await check("platform page refuses anonymous visitors", async () => {
  const { res } = await get("/platform/schools");
  expect(res.status !== 200, "platform page answered 200 without sign-in");
});

await check("school pages need a join code and are noindex", async () => {
  const { res } = await get("/s/smoke-test-no-such-school");
  expect(isRedirectTo(res, "/"), `expected a redirect to /, got ${res.status}`);
  expect((res.headers.get("x-robots-tag") ?? "").includes("noindex"), "missing X-Robots-Tag: noindex");
});

await check("unsigned photo URLs are refused", async () => {
  const { res } = await get("/api/photos/00000000-0000-0000-0000-000000000000/x.jpg");
  expect(res.status === 404, `status ${res.status}`);
});

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`ok    ${r.name}`);
  else {
    failed++;
    console.log(`FAIL  ${r.name}: ${r.why}`);
  }
}
console.log(failed ? `\n${failed} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
