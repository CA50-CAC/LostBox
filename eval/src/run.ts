/**
 * `pnpm eval` — runs the evaluation and prints a results table.
 *
 *   pnpm eval                          # eval/data/manifest.json, dev split
 *   pnpm eval --split test --save      # the held-out split; save aggregate results
 *   pnpm eval --manifest path/to.json --split all --details
 *
 * Options:
 *   --manifest <file>   default: eval/data/manifest.json
 *   --split dev|test|all  default: dev. Tune on dev; run test only to report.
 *   --systems B0,B1,B3  default: all
 *   --save              write eval/results/<date>-<commit>-<split>.json (aggregates only)
 *   --details           write per-query ranks to eval/results/*-detail.json (git-ignored;
 *                       contains query text, never commit it)
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { evaluateSplit, formatTable } from "./harness";
import { loadManifest } from "./manifest";
import { SPLIT_SEED } from "./split";
import { SYSTEMS } from "./systems";

const evalDir = path.resolve(import.meta.dirname, "..");

function commitHash(): string {
  try {
    const hash = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: evalDir, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain", "--", "../apps", "../packages", "src"], { cwd: evalDir, encoding: "utf8" }).trim();
    return dirty ? `${hash}-dirty` : hash;
  } catch {
    return "unknown";
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      manifest: { type: "string", default: path.join(evalDir, "data", "manifest.json") },
      split: { type: "string", default: "dev" },
      systems: { type: "string" },
      save: { type: "boolean", default: false },
      details: { type: "boolean", default: false },
    },
  });
  const split = values.split as "dev" | "test" | "all";
  if (!["dev", "test", "all"].includes(split)) throw new Error("--split must be dev, test, or all");
  const wanted = values.systems?.split(",").map((s) => s.trim().toUpperCase());
  const systems = wanted ? SYSTEMS.filter((s) => wanted.includes(s.id)) : SYSTEMS;

  // pnpm runs this from eval/; INIT_CWD is where you typed the command.
  const manifestPath = path.resolve(process.env.INIT_CWD ?? process.cwd(), values.manifest!);
  const manifest = await loadManifest(manifestPath);
  const { result, details } = await evaluateSplit(manifest, path.dirname(manifestPath), systems, split);
  console.log(formatTable(result));

  const date = new Date().toISOString().slice(0, 10);
  const commit = commitHash();
  const stem = path.join(evalDir, "results", `${date}-${commit}-${split}`);
  if (values.save || values.details) await mkdir(path.dirname(stem), { recursive: true });
  if (values.save) {
    // Aggregates only: counts and metrics. No ids, queries, notes, or file names.
    const saved = { date, commit, seed: SPLIT_SEED, manifestVersion: manifest.version, ...result };
    await writeFile(`${stem}.json`, JSON.stringify(saved, null, 2) + "\n");
    console.log(`\nSaved ${path.relative(path.dirname(evalDir), stem)}.json`);
  }
  if (values.details) {
    await writeFile(`${stem}-detail.json`, JSON.stringify(details, null, 2) + "\n");
    console.log(`Per-query details (do not commit): ${path.relative(path.dirname(evalDir), stem)}-detail.json`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
