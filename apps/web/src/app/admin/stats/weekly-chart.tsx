/**
 * "Items returned each week" as a column chart, in plain HTML and CSS so it
 * stays crisp and readable at phone width. One series, so no legend: the
 * heading names it. Each column shows its value on hover or keyboard focus,
 * and the same numbers are available as a table.
 *
 * Marks follow the house chart rules: columns at most 24px wide with a
 * rounded top and a square base, hairline gridlines, labels in text colors
 * (never the accent), and only a few week labels on the axis.
 */
import type { WeekBucket } from "@/lib/services/stats";
import { t } from "@/lib/i18n";

const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

/** A clean top for the axis: 1, 2, 4, 5, 10, 20, ... */
function niceMax(max: number): number {
  if (max <= 2) return 2;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * pow >= max) return step * pow;
  return 10 * pow;
}

export function WeeklyChart({ weeks, capped }: { weeks: WeekBucket[]; capped: boolean }) {
  const max = Math.max(0, ...weeks.map((w) => w.returned));
  const top = niceMax(max);
  const total = weeks.reduce((a, w) => a + w.returned, 0);
  const labelEvery = Math.max(1, Math.ceil(weeks.length / 6));

  return (
    <figure className="card flex flex-col gap-4 p-4 sm:p-5">
      <figcaption className="flex flex-col gap-0.5">
        <span className="font-semibold">{t("stats.chart.title")}</span>
        {capped ? <span className="text-sm text-muted">{t("stats.chart.capped", { weeks: weeks.length })}</span> : null}
      </figcaption>

      <p className="sr-only">{t("stats.chart.summary", { total, weeks: weeks.length, max })}</p>
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        {/* Y axis: 0, half, top. */}
        <div aria-hidden className="relative h-44 w-6 text-right text-xs text-muted tabular-nums">
          {[top, top / 2, 0].map((v, i) => (
            <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${i * 50}%` }}>
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </span>
          ))}
        </div>

        <div className="relative h-44">
          {[0, 50].map((pct) => (
            <span aria-hidden key={pct} className="absolute inset-x-0 border-t border-border" style={{ top: `${pct}%` }} />
          ))}
          <span aria-hidden className="absolute inset-x-0 bottom-0 border-t border-muted/50" />
          <ol aria-label={t("stats.chart.title")} className="absolute inset-0 flex items-end">
            {weeks.map((w, i) => (
              <li key={w.week} className="flex h-full flex-1 items-end justify-center px-px">
                {/* A button only so the value can be reached with the keyboard; pressing it does nothing. */}
                <button
                  type="button"
                  aria-label={`${t("stats.chart.week", { week: dayLabel(w.week) })}: ${t("stats.chart.value", { count: w.returned })}`}
                  className="group relative flex h-full w-full max-w-6 cursor-default items-end justify-center rounded-t outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span
                    aria-hidden
                    className="w-full rounded-t-[4px] bg-accent transition-[filter] group-hover:brightness-110"
                    style={{ height: w.returned ? `${(w.returned / top) * 100}%` : "0" }}
                  />
                  <span
                    aria-hidden
                    // Anchored toward the middle of the chart so it never sticks out past the edge.
                    className={`pointer-events-none invisible absolute bottom-full z-10 mb-1 rounded-lg bg-foreground px-2 py-1 text-xs font-semibold whitespace-nowrap text-background group-hover:visible group-focus-visible:visible ${
                      i < weeks.length / 2 ? "left-0" : "right-0"
                    }`}
                    style={{ bottom: `${(w.returned / top) * 100}%` }}
                  >
                    {dayLabel(w.week)} · {t("stats.chart.value", { count: w.returned })}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <span />
        <div aria-hidden className="flex text-xs text-muted">
          {weeks.map((w, i) => (
            <span key={w.week} className="flex-1 truncate text-center">
              {i % labelEvery === 0 || i === weeks.length - 1 ? dayLabel(w.week) : ""}
            </span>
          ))}
        </div>
      </div>

      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-accent">{t("stats.chart.table")}</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead>
            <tr className="border-b border-border text-muted">
              <th scope="col" className="py-1.5 font-medium">{t("stats.chart.colWeek")}</th>
              <th scope="col" className="py-1.5 text-right font-medium">{t("stats.chart.colReturned")}</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week} className="border-b border-border/60">
                <td className="py-1.5">{dayLabel(w.week)}</td>
                <td className="py-1.5 text-right tabular-nums">{w.returned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
