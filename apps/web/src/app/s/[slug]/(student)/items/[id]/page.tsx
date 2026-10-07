/**
 * One item, as a student sees it, with the claim form. The item comes from
 * the student data layer (getItem returns null for anything students can't
 * see), so a Limited item here simply has no photo or note to show.
 */
import Link from "next/link";
import { itemAltText } from "@/components/item-card";
import { Icon } from "@/components/icons";
import { CategoryTile, ColorChips } from "@/components/item-visuals";
import { EmptyState } from "@/components/ui/alert";
import { buttonClass, ButtonLink } from "@/components/ui/button";
import { foundAgo } from "@/lib/i18n/dates";
import { t } from "@/lib/i18n";
import { getStudentContext } from "@/lib/server/student-context";
import { ClaimForm } from "./claim-form";

export default async function StudentItemPage({ params }: PageProps<"/s/[slug]/items/[id]">) {
  const { slug, id } = await params;
  const { students, school } = await getStudentContext(slug);
  const item = /^[0-9a-f-]{36}$/.test(id) ? await students.getItem(id) : null;
  const back = (
    <Link href={`/s/${slug}`} className="inline-flex min-h-11 items-center self-start rounded-full px-1 text-sm font-semibold text-accent hover:underline underline-offset-4">
      ← {t("gallery.back")}
    </Link>
  );

  if (!item) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <EmptyState title={t("detail.gone")} action={<ButtonLink href={`/s/${slug}`}>{t("gallery.back")}</ButtonLink>} />
      </div>
    );
  }

  const pickup = school.pickupLocation ?? "the front office";
  return (
    <div className="flex flex-col gap-6">
      <div className="max-md:hidden">{back}</div>
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        {/* On phones the picture runs edge to edge under the top bar, like an app's detail screen. */}
        <div className="relative max-md:-mx-4 max-md:-mt-5 md:card md:overflow-hidden md:p-2">
          {item.visibility === "full" && item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt={itemAltText(item)} className="aspect-square w-full object-cover md:rounded-xl" />
          ) : (
            <CategoryTile category={item.category} colors={item.colors} className="aspect-square w-full md:rounded-xl" />
          )}
          <Link
            href={`/s/${slug}`}
            aria-label={t("gallery.back")}
            className="absolute top-3 left-3 grid size-11 place-items-center rounded-full bg-background text-foreground md:hidden"
          >
            <Icon name="back" className="size-5" strokeWidth={2.5} />
          </Link>
        </div>
        <div className="relative flex flex-col gap-5 max-md:-mx-4 max-md:-mt-12 max-md:rounded-t-[1.25rem] max-md:bg-background max-md:px-4 max-md:pt-6 md:py-2">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[2rem] leading-[1.1] headline sm:text-5xl">{t(`category.${item.category}`)}</h1>
            <p className="flex items-center gap-1.5 text-muted">
              <Icon name="pin" className="size-4 shrink-0" />
              {t("detail.found", { when: foundAgo(item.foundAt).toLowerCase(), place: item.foundLocationName })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ColorChips colors={item.colors} />
            {item.hasNameLabel ? (
              <p className="rounded-full bg-highlight px-3 py-1 text-sm font-bold text-highlight-foreground">{t("item.hasNameLabel")}</p>
            ) : null}
          </div>
          {item.visibility === "full" && item.note ? (
            <div className="card p-4">
              <h2 className="text-sm font-medium text-muted">{t("detail.description")}</h2>
              <p className="mt-0.5">{item.note}</p>
            </div>
          ) : null}
          {item.visibility === "limited" ? (
            <p className="flex items-start gap-2.5 rounded-2xl bg-surface p-4 text-sm">
              <Icon name="lock" className="mt-0.5 size-4 shrink-0 text-accent" />
              {t("detail.limited")}
            </p>
          ) : null}
          <a href="#claim" className={`${buttonClass("primary")} self-start max-md:hidden md:mt-2`}>
            {t("detail.mine")}
          </a>
        </div>
      </div>

      <section id="claim" aria-labelledby="claim-title" className="card flex scroll-mt-20 flex-col gap-3 p-5 sm:p-8">
        <h2 id="claim-title" className="text-2xl headline">
          {t("detail.mine")}
        </h2>
        <p className="text-muted">{t("claim.lead")}</p>
        <ClaimForm slug={slug} itemId={item.id} pickup={pickup} hours={school.pickupHours ?? ""} />
      </section>

      {/* Phones: the main action stays in reach of the thumb (the tab bar is hidden on this screen). */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-lg md:hidden">
        <a href="#claim" className={`${buttonClass("primary")} w-full`}>
          {t("detail.mine")}
        </a>
      </div>
    </div>
  );
}
