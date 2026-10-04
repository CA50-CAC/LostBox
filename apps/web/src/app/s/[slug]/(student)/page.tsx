/**
 * The student gallery: a grid of found items with a search box and filters.
 * Works without JavaScript (it's a plain GET form). Every item shown comes
 * from the student data layer, which only has what students may see.
 */
import { ItemCard } from "@/components/item-card";
import { Icon } from "@/components/icons";
import { CategoryIcon } from "@/components/item-visuals";
import { EmptyState } from "@/components/ui/alert";
import { Button, buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { CATEGORIES, type Category } from "@/lib/domain/types";
import { t } from "@/lib/i18n";
import { searchItems } from "@/lib/services/search";
import { getStudentContext } from "@/lib/server/student-context";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export default async function GalleryPage({ params, searchParams }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { students, school } = await getStudentContext(slug);

  const q = str(sp.q).slice(0, 100);
  // A category chip submits `pick`; the form carries the current one as `category`.
  const rawCategory = "pick" in sp ? str(sp.pick) : str(sp.category);
  const category = (CATEGORIES as readonly string[]).includes(rawCategory) ? (rawCategory as Category) : "";
  const location = str(sp.location).slice(0, 60);
  const from = DATE.test(str(sp.from)) ? str(sp.from) : "";
  const to = DATE.test(str(sp.to)) ? str(sp.to) : "";
  const filtering = Boolean(q || category || location || from || to);
  const moreFilters = Boolean(location || from || to);
  const chip = (active: boolean) =>
    `inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
      active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-foreground hover:border-accent/50 hover:bg-accent-soft"
    }`;

  const [{ ids, items }, locations] = await Promise.all([
    searchItems(students, q, {
      categories: category ? [category] : undefined,
      locationNames: location ? [location] : undefined,
      foundAfter: from || undefined,
      foundBefore: to || undefined,
    }),
    students.listLocationNames(),
  ]);
  const pickup = school.pickupLocation ?? "the front office";
  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-4xl">{t("gallery.title", { school: school.name })}</h1>
        <p className="text-muted max-sm:text-[0.95rem] sm:text-lg">{t("gallery.lead")}</p>
      </div>

      <form method="get" role="search" className="relative flex flex-col gap-3">
        <input type="hidden" name="category" value={category} />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <label htmlFor="q" className="sr-only">
              {t("gallery.search")}
            </label>
            {/* First submit button in the form, so pressing Enter searches (and keeps the chosen category). */}
            <button
              type="submit"
              aria-label={t("gallery.search")}
              className="absolute top-1/2 left-1 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-muted hover:text-accent"
            >
              <Icon name="search" className="size-5" />
            </button>
            <input
              id="q"
              name="q"
              type="search"
              enterKeyHint="search"
              defaultValue={q}
              placeholder={t("gallery.search.placeholder")}
              className={`${inputClass} min-h-12 rounded-2xl pl-12 text-base`}
              maxLength={100}
            />
          </div>
          <details className="group">
            <summary
              aria-label={moreFilters ? `${t("gallery.filters")} (${t("gallery.filtersOn")})` : t("gallery.filters")}
              className="relative grid size-12 cursor-pointer list-none place-items-center rounded-2xl border border-border bg-card text-foreground shadow-xs hover:border-accent/50 group-open:border-accent group-open:bg-accent-soft group-open:text-accent [&::-webkit-details-marker]:hidden"
            >
              <Icon name="sliders" className="size-5" />
              {moreFilters ? <span aria-hidden className="absolute top-2.5 right-2.5 size-2 rounded-full bg-accent ring-2 ring-card" /> : null}
            </summary>
            <div className="card absolute inset-x-0 top-14 z-10 grid gap-3 p-4 shadow-xl sm:grid-cols-3">
              <p className="font-semibold sm:col-span-3">{t("gallery.filters")}</p>
              <label className="flex flex-col gap-1 text-sm font-medium">
                {t("gallery.location")}
                <select name="location" defaultValue={location} className={inputClass}>
                  <option value="">{t("gallery.any")}</option>
                  {locations.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                {t("gallery.from")}
                <input type="date" name="from" defaultValue={from} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                {t("gallery.to")}
                <input type="date" name="to" defaultValue={to} className={inputClass} />
              </label>
              <div className="flex gap-2 sm:col-span-3">
                <Button type="submit" className="flex-1 sm:flex-none">
                  {t("gallery.apply")}
                </Button>
                {filtering ? (
                  <a href={`/s/${slug}`} className={buttonClass("secondary")}>
                    {t("gallery.clear")}
                  </a>
                ) : null}
              </div>
            </div>
          </details>
        </div>
        <div role="group" aria-label={t("gallery.category")} className="-mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none]">
          <button type="submit" name="pick" value="" aria-pressed={!category} className={chip(!category)}>
            {t("gallery.all")}
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} type="submit" name="pick" value={c} aria-pressed={category === c} className={chip(category === c)}>
              <CategoryIcon category={c} className="size-4" />
              {t(`category.${c}`)}
            </button>
          ))}
        </div>
      </form>

      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted" aria-live="polite">
          {ids.length === 1 ? t("gallery.count.one") : t("gallery.count", { count: ids.length })}
        </p>
        {filtering ? (
          <a href={`/s/${slug}`} className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-accent underline-offset-4 hover:underline">
            {t("gallery.clear")}
          </a>
        ) : null}
      </div>

      {ids.length === 0 ? (
        <EmptyState title={t("gallery.empty.title")}>
          {filtering ? t("gallery.empty.body", { pickup }) : t("gallery.empty.none", { pickup })}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {ids.map((id) => (
            <li key={id}>
              <ItemCard item={items.get(id)!} href={`/s/${slug}/items/${id}`} now={now} timeZone="UTC" />
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-start gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
        <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
        {t("gallery.notListed", { pickup })}
      </p>
    </div>
  );
}
