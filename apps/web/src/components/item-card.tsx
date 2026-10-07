/**
 * The card a student sees for one found item, in the gallery and in the
 * setup wizard's privacy preview (same component, so the preview is exact).
 *
 * It only accepts a StudentItem, so it can't show a field students may not
 * see: a Limited item has no photo or note to show.
 */
import Link from "next/link";
import type { StudentItem } from "@/lib/domain/visibility";
import { foundAgo } from "@/lib/i18n/dates";
import { t } from "@/lib/i18n";
import { CategoryIcon, CategoryTile } from "./item-visuals";

export function itemAltText(item: StudentItem): string {
  const colors = item.colors.map((c) => t(`color.${c}`).toLowerCase()).join(" and ");
  return `${colors ? `${colors} ` : ""}${t(`category.${item.category}`).toLowerCase()}, found at ${item.foundLocationName}`;
}

export function ItemCard({
  item,
  href,
  now,
  timeZone,
}: {
  item: StudentItem;
  href?: string;
  now?: Date;
  timeZone?: string;
}) {
  const title = t(`category.${item.category}`);
  const media =
    item.visibility === "full" && item.photoUrl ? (
      // Plain <img>: photos are short-lived signed URLs, not static assets.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.photoUrl} alt={itemAltText(item)} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
    ) : (
      <CategoryTile category={item.category} colors={item.colors} className="aspect-square w-full" />
    );

  const body = (
    <>
      <div className="relative m-2 mb-0 overflow-hidden rounded-xl bg-accent-soft">
        {media}
        {item.visibility === "limited" ? (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-highlight px-2.5 py-1 text-xs font-bold text-highlight-foreground">
            <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            {t("gallery.noPhoto")}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-3.5">
        <p className="flex items-start gap-1.5 leading-snug font-bold">
          <CategoryIcon category={item.category} className="mt-0.5 size-4 shrink-0 text-accent" />
          <span className="line-clamp-2">{title}</span>
        </p>
        {item.colors.length ? <p className="text-sm text-muted">{item.colors.map((c) => t(`color.${c}`)).join(", ")}</p> : null}
        {item.visibility === "full" && item.note ? <p className="line-clamp-2 text-sm">{item.note}</p> : null}
        <p className="mt-auto flex items-center gap-1 pt-1.5 text-xs font-medium text-muted">
          <svg aria-hidden viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span className="truncate">
            {item.foundLocationName} · {foundAgo(item.foundAt, now, timeZone)}
          </span>
        </p>
        {item.hasNameLabel ? (
          <p className="mt-1 self-start rounded-lg bg-highlight px-2 py-0.5 text-xs font-bold text-highlight-foreground">{t("item.hasNameLabel")}</p>
        ) : null}
      </div>
    </>
  );

  const cls = "card group flex h-full flex-col overflow-hidden";
  return href ? (
    <Link href={href} className={`${cls} card-hover`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
