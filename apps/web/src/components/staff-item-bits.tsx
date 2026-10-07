/** Small staff-only displays: status and visibility badges, and a photo thumbnail. */
import type { ItemStatus, StaffItem, Visibility } from "@/lib/domain/types";
import { t } from "@/lib/i18n";
import { CategoryTile } from "./item-visuals";

const STATUS_STYLE: Record<ItemStatus, string> = {
  available: "bg-success-soft text-success",
  claimed: "bg-accent-soft text-accent",
  returned: "bg-border text-muted",
  donated: "bg-border text-muted",
  removed: "bg-danger-soft text-danger",
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${STATUS_STYLE[status]}`}>{t(`status.${status}`)}</span>;
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const style = visibility === "staff_only" ? "border-warning/40 bg-warning-soft text-warning" : "border-border-tint bg-background text-muted";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-medium ${style}`}>
      {visibility === "staff_only" ? <span aria-hidden>🔒</span> : null}
      {t(`visibility.${visibility}`)}
    </span>
  );
}

export function Thumb({ item, url, size = "size-14" }: { item: Pick<StaffItem, "category" | "colors">; url: string | null; size?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${size} shrink-0 rounded-xl object-cover`} />
  ) : (
    <CategoryTile category={item.category} colors={item.colors} className={`${size} shrink-0 rounded-xl`} />
  );
}
