/**
 * Small visual building blocks for items: the category icon, color swatches,
 * and the tile shown instead of a photo for Limited items.
 */
import { colorBackground, CATEGORY_ICON, inkFor } from "@/lib/domain/visuals";
import type { Category, Color } from "@/lib/domain/types";
import { t } from "@/lib/i18n";

export function CategoryIcon({ category, className = "size-6" }: { category: Category; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={CATEGORY_ICON[category]} />
    </svg>
  );
}

/** Color dots with their names, so color is never the only cue. */
export function ColorChips({ colors }: { colors: Color[] }) {
  if (colors.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Colors">
      {colors.map((c) => (
        <li key={c} className="inline-flex items-center gap-1.5 rounded-full border border-border-tint bg-background px-2.5 py-0.5 text-sm font-medium">
          <span aria-hidden className="size-3 rounded-full border border-border-input" style={{ background: colorBackground(c) }} />
          {t(`color.${c}`)}
        </li>
      ))}
    </ul>
  );
}

/** Shown in place of a photo: the category icon on the item's main color. */
export function CategoryTile({ category, colors, className = "" }: { category: Category; colors: Color[]; className?: string }) {
  const main = colors[0];
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ background: colorBackground(main), color: inkFor(main) }}
    >
      <CategoryIcon category={category} className="size-1/3" />
    </div>
  );
}
