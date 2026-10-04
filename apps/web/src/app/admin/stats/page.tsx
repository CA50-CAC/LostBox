/**
 * The impact dashboard: how many items were logged, returned, and donated,
 * the return rate, and how fast things go home. For staff, the pilot write-up,
 * and the demo video. Aggregates only; see lib/services/stats.ts for exactly
 * how each number is counted.
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t, type MessageKey } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/dates";
import { getStaffContext } from "@/lib/server/staff-context";
import { computeImpactStats, durationParts, MAX_WEEKS, RANGE_KEYS, resolveRange, startOfDay } from "@/lib/services/stats";
import { WeeklyChart } from "./weekly-chart";

export const metadata: Metadata = { title: t("stats.title") };

const PRESETS = RANGE_KEYS.filter((k) => k !== "custom");
const fmt = new Intl.NumberFormat("en-US");

export default async function StatsPage({ searchParams }: PageProps<"/admin/stats">) {
  const sp = await searchParams;
  const { repo, school } = await getStaffContext("/admin/stats");
  const tz = school.timeZone;
  const range = resolveRange(sp, new Date(), tz);
  const [items, claims] = await Promise.all([repo.listItems(school.id), repo.listClaims(school.id, ["pending"])]);
  const s = computeImpactStats(items, claims, range, tz);
  const allWeeks = range.fromDay ? null : s.weekly.length === MAX_WEEKS;

  const day = (d: string) => formatDate(startOfDay(d, tz).toISOString(), tz);
  const median = s.medianHoursToReturn === null ? null : durationParts(s.medianHoursToReturn);
  const rate = s.returnRate === null ? null : Math.round(s.returnRate * 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("stats.title")}</h1>
        <p className="max-w-2xl text-muted">{t("stats.lead", { school: school.name })}</p>
      </div>

      {/* Period filter: presets as links, plus a custom from/to. One row on wide screens. */}
      <section aria-label={t("stats.range")} className="card flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-end lg:justify-between">
        <nav aria-label={t("stats.range")}>
          <ul className="flex flex-wrap gap-1">
            {PRESETS.map((k) => (
              <li key={k}>
                <Link
                  href={`/admin/stats?range=${k}`}
                  aria-current={range.key === k ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-medium whitespace-nowrap ${
                    range.key === k ? "bg-foreground text-background" : "text-muted hover:bg-surface"
                  }`}
                >
                  {t(`stats.range.${k}` as MessageKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form method="get" className="grid grid-cols-2 items-end gap-2 sm:flex">
          <input type="hidden" name="range" value="custom" />
          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
            {t("stats.from")}
            <input type="date" name="from" required defaultValue={range.fromDay ?? ""} max={range.toDay} className="min-h-11 rounded-xl border border-border bg-card px-3" />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
            {t("stats.to")}
            <input type="date" name="to" required defaultValue={range.toDay} className="min-h-11 rounded-xl border border-border bg-card px-3" />
          </label>
          <Button type="submit" variant={range.key === "custom" ? "primary" : "secondary"} className="col-span-2 sm:col-span-1">
            {t("stats.apply")}
          </Button>
        </form>
      </section>

      <p className="-mt-2 text-sm text-muted" aria-live="polite">
        {range.fromDay ? t("stats.showing", { from: day(range.fromDay), to: day(range.toDay) }) : t("stats.showingAll", { to: day(range.toDay) })}
      </p>

      {/* The one hero number, then the rest as tiles. */}
      <section aria-labelledby="rate" className="card flex flex-col gap-2 p-5 sm:p-6">
        <h2 id="rate" className="text-sm font-medium text-muted">
          {t("stats.returnRate")}
        </h2>
        <p className="text-6xl font-semibold tracking-tight tabular-nums">{rate === null ? "—" : `${rate}%`}</p>
        {rate !== null ? (
          <div aria-hidden className="h-2 w-full max-w-md overflow-hidden rounded-full bg-accent-soft">
            <div className="h-full rounded-full bg-accent" style={{ width: `${rate}%` }} />
          </div>
        ) : null}
        <p className="text-muted">
          {s.returnRate === null ? t("stats.returnRate.none") : t("stats.returnRate.detail", { returned: s.loggedThenReturned, logged: s.logged })}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t("stats.logged")} value={fmt.format(s.logged)} />
        <Tile label={t("stats.returned")} value={fmt.format(s.returned)} />
        <Tile
          label={t("stats.median")}
          value={median ? median.value : "—"}
          unit={median ? t(`stats.unit.${median.unit}` as MessageKey) : undefined}
          detail={median ? t("stats.median.detail") : t("stats.median.none")}
        />
        <Tile label={t("stats.donated")} value={fmt.format(s.donated)} />
      </div>

      <WeeklyChart weeks={s.weekly} capped={Boolean(allWeeks)} />

      <section aria-labelledby="now" className="flex flex-col gap-3">
        <h2 id="now" className="px-1 text-sm font-semibold tracking-wide text-muted uppercase">
          {t("stats.now")}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label={t("stats.waiting")} value={fmt.format(s.waitingNow)} detail={t("stats.waiting.detail")} href="/admin" />
          <Tile label={t("stats.pending")} value={fmt.format(s.pendingClaimsNow)} detail={t("stats.pending.detail")} href="/admin/claims" />
        </div>
      </section>

      <details className="card p-4 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">{t("stats.definitions")}</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-muted">
          <li>{t("stats.def.logged")}</li>
          <li>{t("stats.def.rate")}</li>
          <li>{t("stats.def.median")}</li>
          <li>{t("stats.def.now")}</li>
        </ul>
      </details>
    </div>
  );
}

function Tile({ label, value, unit, detail, href }: { label: string; value: string; unit?: string; detail?: string; href?: string }) {
  const body: ReactNode = (
    <>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit ? <span className="font-medium text-muted">{unit}</span> : null}
      </p>
      {detail ? <p className="text-sm text-muted">{detail}</p> : null}
    </>
  );
  return href ? (
    <div className="card">
      <Link href={href} className="flex h-full flex-col gap-1 rounded-[inherit] p-4 hover:bg-surface">
        {body}
      </Link>
    </div>
  ) : (
    <div className="card flex flex-col gap-1 p-4">{body}</div>
  );
}
