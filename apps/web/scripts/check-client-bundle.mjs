/**
 * Fails if a server-only secret (Supabase secret key, session secret, cron
 * secret) ended up in files sent to browsers.
 * CI builds with a fake secret, then runs this. See the `secrets` CI job.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Every server-only secret the build was given. SUPABASE_SECRET_KEY is required;
// the others are checked too when they're set.
const secrets = ["SUPABASE_SECRET_KEY", "SESSION_SECRET", "CRON_SECRET"]
  .map((name) => ({ name, value: process.env[name] }))
  .filter((s) => s.value);
if (!process.env.SUPABASE_SECRET_KEY) {
  console.error("Set SUPABASE_SECRET_KEY to the value used for the build.");
  process.exit(2);
}

const found = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const text = readFileSync(p, "latin1");
      for (const s of secrets) if (text.includes(s.value)) found.push(`${p} (${s.name})`);
    }
  }
}
walk(path.join(import.meta.dirname, "..", ".next", "static"));

if (found.length) {
  console.error("A server-only secret is in browser files:\n" + found.join("\n"));
  process.exit(1);
}
console.log(`OK: ${secrets.map((s) => s.name).join(", ")} not in any browser file.`);
