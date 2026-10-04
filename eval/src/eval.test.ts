/**
 * The harness on a tiny synthetic manifest (fixtures/, made up for tests: not
 * real items or real people's words).
 */
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateSplit, formatTable } from "./harness";
import { loadManifest, toStudentItems } from "./manifest";
import { computeMetrics, rankOf } from "./metrics";
import { splitOf } from "./split";
import { memoryStudentRepo, newestFirst, SYSTEMS } from "./systems";

const FIXTURE = path.join(import.meta.dirname, "..", "fixtures", "synthetic-manifest.json");

describe("metrics", () => {
  it("recall@k, MRR, median rank, found", () => {
    const m = computeMetrics([1, 2, 4, null]);
    expect(m.queries).toBe(4);
    expect(m.recallAt1).toBe(0.25);
    expect(m.recallAt3).toBe(0.5);
    expect(m.recallAt5).toBe(0.75);
    expect(m.mrr).toBeCloseTo((1 + 0.5 + 0.25 + 0) / 4);
    expect(m.medianRank).toBe(3); // (2 + 4) / 2
    expect(m.found).toBe(0.75);
  });

  it("median rank is 'not found' when most queries miss", () => {
    expect(computeMetrics([1, null, null]).medianRank).toBeNull();
    expect(computeMetrics([]).queries).toBe(0);
  });

  it("ranks are 1-based", () => {
    expect(rankOf(["a", "b", "c"], "b")).toBe(2);
    expect(rankOf(["a"], "z")).toBeNull();
  });
});

describe("split", () => {
  it("is stable, seeded, and roughly half and half", () => {
    const ids = Array.from({ length: 400 }, (_, i) => `item-${i}`);
    const dev = ids.filter((id) => splitOf(id) === "dev").length;
    expect(dev).toBeGreaterThan(160);
    expect(dev).toBeLessThan(240);
    expect(ids.map((id) => splitOf(id))).toEqual(ids.map((id) => splitOf(id)));
    expect(ids.map((id) => splitOf(id, "other-seed"))).not.toEqual(ids.map((id) => splitOf(id)));
  });

  it("adding items never moves existing ones", () => {
    const before = ["a", "b", "c"].map((id) => splitOf(id));
    expect(["a", "b", "c", "d", "e"].slice(0, 3).map((id) => splitOf(id))).toEqual(before);
  });
});

describe("manifest", () => {
  it("loads the synthetic fixture", async () => {
    const m = await loadManifest(FIXTURE);
    expect(m.items).toHaveLength(8);
    const items = toStudentItems(m.items, path.dirname(FIXTURE));
    expect(items[0]).toMatchObject({ id: "syn-01", visibility: "full", foundLocationName: "Gym" });
    expect((items[0] as { photoUrl: string }).photoUrl).toMatch(/^file:\/\/.*photos\/syn-01\.jpg$/);
  });

  it("rejects bad entries with a readable message", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "lostbox-eval-"));
    const file = path.join(dir, "bad.json");
    const item = { id: "x1", photos: ["a.jpg"], category: "clothing", colors: ["gray"], foundLocation: "Gym", queries: ["gray hoodie"] };
    await writeFile(file, JSON.stringify({ version: 1, items: [item, { ...item, category: "spaceship" }, { ...item, queries: [] }] }));
    await expect(loadManifest(file)).rejects.toThrow(/items\.1\.category[\s\S]*items\.2\.queries/);
    await writeFile(file, JSON.stringify({ version: 1, items: [item, item] }));
    await expect(loadManifest(file)).rejects.toThrow(/duplicate id "x1"/);
  });
});

describe("harness", () => {
  it("B0 ranks newest first, ignoring the query", async () => {
    const m = await loadManifest(FIXTURE);
    const repo = memoryStudentRepo(toStudentItems(m.items, "."));
    expect((await newestFirst(repo, "anything")).ids.slice(0, 2)).toEqual(["syn-08", "syn-07"]);
  });

  it("scores B0 and B1, and reports the matching stub as not implemented", async () => {
    const m = await loadManifest(FIXTURE);
    const { result, details } = await evaluateSplit(m, path.dirname(FIXTURE), SYSTEMS, "all");
    expect(result).toMatchObject({ split: "all", items: 8, queries: 11 });
    const [b0, b1, b3] = result.systems;
    expect(b0.status).toBe("ok");
    expect(b0.metrics!.found).toBe(1); // newest-first returns everything
    expect(b1.status).toBe("ok");
    // The keyword filter finds exact-word queries ("graphing calculator") but not paraphrases ("grey sweatshirt").
    const rankFor = (q: string) => details.find((d) => d.query === q)!.ranks.B1;
    expect(rankFor("graphing calculator")).toBe(1);
    expect(rankFor("grey sweatshirt")).toBeNull();
    expect(b3).toMatchObject({ id: "B3", status: "not_implemented", metrics: null });
    expect(formatTable(result)).toContain("B3: not implemented yet");
  });

  it("dev and test together cover every item exactly once", async () => {
    const m = await loadManifest(FIXTURE);
    const dev = await evaluateSplit(m, ".", [SYSTEMS[0]], "dev");
    const test = await evaluateSplit(m, ".", [SYSTEMS[0]], "test");
    expect(dev.result.items + test.result.items).toBe(8);
  });

  it("a ranker can't write through the data it's given", async () => {
    const repo = memoryStudentRepo([]);
    await expect(repo.createClaim({ itemId: "x", claimantDetail: "abc", contactEmail: null, codeHash: "h" })).rejects.toThrow();
  });
});
