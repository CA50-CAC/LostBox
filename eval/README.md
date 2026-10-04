# Search evaluation

This folder measures how well each search system finds the right item: SPEC
Section 7. One command runs every system on the same items and queries and
prints a table.

```bash
pnpm eval                       # dev split, prints the table
pnpm eval --split test --save   # held-out split, saves aggregate results
```

**What's here and what isn't.** This is the harness: the manifest format,
the dev/test split, the metrics, and two baselines. The ranking algorithm
(the matching engine) is not here. The student writes it, and the harness
already has a slot for it (system B3).

## Privacy: what never goes into git

- **Photos** of real belongings, and the **manifest** with the owners' own
  words. Keep both in `eval/data/`, which is git-ignored, or on a private drive
  with `--manifest <path>`.
- **Per-query results** (`--details`). They contain the query text, so they're
  git-ignored too (`results/*-detail.json`).
- Only **aggregate** results go into git: `results/<date>-<commit>-<split>.json`
  has counts and metrics, and nothing else: no item ids, queries, notes, or file names.

Collect items with consent and return them afterwards (SPEC 7.3). Use your own
item ids (`i001`), never a person's name.

## Manifest format

`eval/data/manifest.json`:

```json
{
  "version": 1,
  "items": [
    {
      "id": "i001",
      "photos": ["photos/i001-a.jpg", "photos/i001-b.jpg"],
      "category": "clothing",
      "colors": ["gray"],
      "note": "Hoodie, size M, paint on the left cuff",
      "foundLocation": "Main hall",
      "foundAt": "2026-10-06T14:30:00-07:00",
      "queries": ["gray hoodie with paint on the sleeve", "my grey sweatshirt"]
    }
  ]
}
```

| Field | Required | What it is |
|---|---|---|
| `id` | yes | Your id for the item: letters, numbers, `-`, `_`. Unique. |
| `photos` | yes | 1 to 4 paths, relative to the manifest file. The finder's casual photos (1 to 2 per item is normal). |
| `category` | yes | One of the app's categories: `clothing`, `bottle_lunchbox`, `bag`, `books_stationery`, `calculator_supplies`, `sports_gear`, `electronics`, `earbuds_headphones`, `keys`, `wallet_id`, `glasses_medical`, `jewelry_watch`, `instrument`, `other`. |
| `colors` | yes | 1 to 3 of the app's colors: `black`, `white`, `gray`, `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `brown`, `beige`, `silver`, `gold`, `multicolor`. |
| `note` | no | What a finder would type at intake. `null` or leave out. |
| `foundLocation` | yes | Where it was found, e.g. `Gym`. |
| `foundAt` | no | ISO date and time. Only "newest first" (B0) uses it; without it, manifest order is used. |
| `queries` | yes | 1 or 2 descriptions **by the owner, written from memory, without seeing the photo**, ideally the next day. Two different people if possible. |

`fixtures/synthetic-manifest.json` is a made-up example used by the tests. Its
photos don't exist and it isn't evaluation data.

### Adding items

1. Photograph the item the way a finder would (casually, 1 to 2 shots), and save
   the photos under `eval/data/photos/`.
2. Fill in its manifest entry (category, colors, note, location), as the finder.
3. The next day, ask the owner to describe it from memory, without the photo.
   Put their words in `queries` exactly as written (typos included: real
   students make them too).
4. Run `pnpm eval`. If the manifest has a mistake, the error names the item and field.

Aim for 60 to 120 items, with at least 30% in confusable groups (several black
bottles, gray hoodies, earbud cases, calculators): SPEC 7.3.

## Dev/test split

Each item is assigned to **dev** or **test** by hashing its id with a fixed seed
(`SPLIT_SEED` in `src/split.ts`), about half each. All of an item's queries land
on the same side.

- Because it's a hash rather than a shuffle, adding items later never moves
  existing ones to the other side, and anyone with the same manifest gets the
  same split.
- **Tune on dev only.** Look at test only to report final numbers, and don't
  change the system after looking. Otherwise the test numbers stop meaning
  anything.
- Don't change the seed: it reshuffles everything and makes old results
  incomparable.

## Systems

| ID | System | Where |
|---|---|---|
| B0 | **Newest first**: ignores the query, like digging through the box. The floor. | `src/systems.ts` |
| B1 | **Keyword filter**: the app's real search today (category, color and note words; every word must match). Imported from the app, not copied. | `apps/web/src/lib/services/search.ts` |
| B3 | **Matching engine**: *stub, not implemented*. Reported as "not implemented" until it is. | `apps/web/src/lib/services/match.ts` |

Every system has the app's search signature,
`(students, query, filters) → { ids, items }`, with ids best first. So what's
measured here is exactly what the app would run. To evaluate the matching
engine, implement `matchItems` in `match.ts` (or import it from
`packages/matching`) and run `pnpm eval` again.

The candidate pool for every query is all the items in the split, like a
school's box holding all of them at once. Queries are run with no filters,
just text, the way a student types into the search box.

## Metrics

For each query the harness finds the rank of the right item (1 = first).

| Metric | Meaning |
|---|---|
| **Recall@1 / @3 / @5** | Share of queries where the right item is in the top 1, 3, or 5. |
| **MRR** | Mean reciprocal rank: the average of 1/rank (0 if not returned). 1.0 means always first. |
| **Median rank** | The middle rank across queries: "how far down a student usually scrolls". Missing items count as last; if more than half are missing it says "not found". |
| **Found** | Share of queries where the item was returned at all. A filter (B1) can hide the right item entirely; a ranker shouldn't. |

When reporting, always give the dataset size (items and queries) and how the
queries were written (SPEC 7.2). The table prints both.

## Running it

```bash
pnpm eval                                   # eval/data/manifest.json, dev split
pnpm eval --split test                      # held-out split
pnpm eval --split all                       # everything (only for sanity checks)
pnpm eval --systems B0,B1                   # only some systems
pnpm eval --manifest ~/private/manifest.json
pnpm eval --split test --save               # write results/<date>-<commit>-test.json
pnpm eval --details                         # per-query ranks (git-ignored)
```

## Results

`--save` writes `results/<date>-<commit>-<split>.json`. The commit is the
current git commit, with `-dirty` added if the app or harness has uncommitted
changes; commit first so a result can always be traced to the exact code.
Commit the results file to keep a record.

```bash
pnpm --filter @lostbox/eval test   # the harness's own tests (also part of `pnpm test`)
```
