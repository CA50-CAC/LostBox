/**
 * The evaluation manifest: one entry per real item, with the finder's photos
 * and the owner's queries written from memory (SPEC Section 7.3).
 *
 * The file lives in eval/data/ (git-ignored). See eval/README.md for the
 * format and how to add items.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { CATEGORIES, COLORS } from "@/lib/domain/types";
import type { StudentItem } from "@/lib/domain/visibility";

export const ManifestItemSchema = z.object({
  /** Your own id, e.g. "i001". Never a person's name. */
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "use letters, numbers, - and _ only"),
  /** Paths relative to the manifest file, e.g. "photos/i001-a.jpg". 1 or 2 per item. */
  photos: z.array(z.string().min(1)).min(1).max(4),
  category: z.enum(CATEGORIES),
  colors: z.array(z.enum(COLORS)).min(1).max(3),
  /** What the finder would type at intake. Optional, like in the app. */
  note: z.string().max(500).nullable().default(null),
  foundLocation: z.string().min(1).max(60),
  /** When it was found. Optional; only the "newest first" baseline uses it. */
  foundAt: z.iso.datetime({ offset: true }).optional(),
  /** 1 or 2 owner descriptions, written from memory, without seeing the photo. */
  queries: z.array(z.string().min(2).max(300)).min(1).max(2),
});

export const ManifestSchema = z
  .object({
    version: z.literal(1),
    items: z.array(ManifestItemSchema).min(2),
  })
  .superRefine((m, ctx) => {
    const seen = new Set<string>();
    m.items.forEach((item, i) => {
      if (seen.has(item.id)) ctx.addIssue({ code: "custom", path: ["items", i, "id"], message: `duplicate id "${item.id}"` });
      seen.add(item.id);
    });
  });

export type ManifestItem = z.infer<typeof ManifestItemSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

export async function loadManifest(file: string): Promise<Manifest> {
  const raw = JSON.parse(await readFile(file, "utf8"));
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`${path.basename(file)} is not a valid manifest:\n${issues}`);
  }
  return parsed.data;
}

/**
 * Items as the app would show them to a student. All "full" visibility: the
 * evaluation measures ranking, not privacy rules. Items without `foundAt` get
 * a stable made-up date (manifest order, one hour apart) so "newest first"
 * is still well defined. `photoUrl` is a file:// URL to the first photo, so an
 * image-based ranker can load it; the app would give a signed https URL instead.
 */
export function toStudentItems(items: ManifestItem[], manifestDir: string): StudentItem[] {
  const base = Date.parse("2026-01-01T08:00:00Z");
  return items.map((item, i) => ({
    id: item.id,
    category: item.category,
    colors: item.colors,
    note: item.note,
    foundLocationName: item.foundLocation,
    foundAt: item.foundAt ? new Date(item.foundAt).toISOString() : new Date(base + i * 3_600_000).toISOString(),
    visibility: "full",
    photoUrl: pathToFileURL(path.resolve(manifestDir, item.photos[0])).href,
    hasNameLabel: false,
  }));
}
