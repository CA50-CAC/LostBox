/**
 * The impact dashboard's numbers (/admin/stats), computed from data we
 * already keep: when each item was logged (created_at), when and how it was
 * resolved (status, resolved_at), and the claims queue. Nothing about who
 * claimed what: only counts and durations leave this file.
 *
 * Definitions (also shown on the page, so they can be explained in a demo):
 * - Logged: items added during the period.
 * - Returned / Donated: items whose status became that during the period.
 * - Return rate: of the items logged during the period, the share now returned.
 * - Median time to return: for items returned during the period, the middle
 *   value of (returned - logged). The median, not the mean, so one hoodie that
 *   sat for a month doesn't swamp a week of same-day returns.
 * - Waiting now / Claims pending: today's state, whatever the period.
 *
 * Pure functions; the page loads items and claims through the staff data layer
 * (RLS applies). At pilot scale (hundreds of items) doing this in memory is fine.
 */
import type { StaffItem } from "@/lib/domain/types";
import { isoDay } from "@/lib/i18n/dates";
import type { Claim } from "@/lib/repo/interface";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const RANGE_KEYS = ["7d", "30d", "90d", "year", "all", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export interface StatsRange {
  key: RangeKey;
  /** Inclusive start; null means "since the beginning". */
  from: Date | null;
  /** Exclusive end. */
  to: Date;
  /** yyyy-mm-dd in the school's time zone, for the date inputs. */
  fromDay: string | null;
  toDay: string;
}

// ---------- Dates in the school's time zone ----------

/** How far ahead of UTC the zone is at that instant, in ms (negative for the Americas). */
function zoneOffset(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant a calendar day (yyyy-mm-dd) starts in the zone. Handles daylight saving. */
export function startOfDay(day: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - zoneOffset(new Date(guess), timeZone);
  // Second pass: the offset at the real instant can differ from the guess's (DST change days).
  t = guess - zoneOffset(new Date(t), timeZone);
  return new Date(t);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (v: unknown): v is string => typeof v === "string" && DAY_RE.test(v) && !Number.isNaN(Date.parse(v));

/**
 * Turns the page's query (?range=30d, or ?range=custom&from=…&to=…) into
 * instants. Custom days are whole days in the school's time zone, `to`
 * included. Anything invalid falls back to the last 30 days.
 */
export function resolveRange(query: { range?: unknown; from?: unknown; to?: unknown }, now: Date, timeZone: string): StatsRange {
  const today = isoDay(now, timeZone);
  const key = RANGE_KEYS.find((k) => k === query.range) ?? "30d";
  const days = { "7d": 7, "30d": 30, "90d": 90 } as const;

  if (key in days) {
    const n = days[key as keyof typeof days];
    const from = new Date(now.getTime() - n * DAY_MS);
    return { key, from, to: now, fromDay: isoDay(from, timeZone), toDay: today };
  }
  if (key === "year") {
    // US school years start in August.
    const [y, m] = today.split("-").map(Number);
    const fromDay = `${m >= 8 ? y : y - 1}-08-01`;
    return { key, from: startOfDay(fromDay, timeZone), to: now, fromDay, toDay: today };
  }
  if (key === "all") return { key, from: null, to: now, fromDay: null, toDay: today };

  if (!validDay(query.from) || !validDay(query.to)) return resolveRange({ range: "30d" }, now, timeZone);
  const [fromDay, toDay] = query.from <= query.to ? [query.from, query.to] : [query.to, query.from];
  return { key, from: startOfDay(fromDay, timeZone), to: startOfDay(addDays(toDay, 1), timeZone), fromDay, toDay };
}

// ---------- The numbers ----------

export interface WeekBucket {
  /** Monday, yyyy-mm-dd, school time zone. */
  week: string;
  returned: number;
}

export interface ImpactStats {
  logged: number;
  returned: number;
  /** Of the items logged in the period, how many are returned now. */
  loggedThenReturned: number;
  /** 0..1, or null when nothing was logged. */
  returnRate: number | null;
  medianHoursToReturn: number | null;
  donated: number;
  waitingNow: number;
  pendingClaimsNow: number;
  /** Returns per week across the period (at most the last 26 weeks). */
  weekly: WeekBucket[];
}

export const MAX_WEEKS = 26;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function computeImpactStats(items: StaffItem[], claims: Pick<Claim, "status">[], range: StatsRange, timeZone: string): ImpactStats {
  const inRange = (iso: string | null) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return (range.from === null || t >= range.from.getTime()) && t < range.to.getTime();
  };

  const logged = items.filter((i) => inRange(i.createdAt));
  const returned = items.filter((i) => i.status === "returned" && inRange(i.resolvedAt));
  const loggedThenReturned = logged.filter((i) => i.status === "returned").length;
  const hours = returned.map((i) => Math.max(0, Date.parse(i.resolvedAt!) - Date.parse(i.createdAt)) / HOUR_MS);

  // Weekly buckets from the period's first week (or the first item, for "all time") to its last.
  const firstDay =
    range.fromDay ?? (items.length ? isoDay(new Date(Math.min(...items.map((i) => Date.parse(i.createdAt)))), timeZone) : range.toDay);
  const lastDay = isoDay(new Date(range.to.getTime() - 1), timeZone);
  const weeks: string[] = [];
  for (let w = weekStart(firstDay); w <= weekStart(lastDay); w = addDays(w, 7)) weeks.push(w);
  const counts = new Map(weeks.map((w) => [w, 0]));
  for (const i of returned) {
    const w = weekStart(isoDay(new Date(i.resolvedAt!), timeZone));
    if (counts.has(w)) counts.set(w, counts.get(w)! + 1);
  }

  return {
    logged: logged.length,
    returned: returned.length,
    loggedThenReturned,
    returnRate: logged.length ? loggedThenReturned / logged.length : null,
    medianHoursToReturn: median(hours),
    donated: items.filter((i) => i.status === "donated" && inRange(i.resolvedAt)).length,
    waitingNow: items.filter((i) => i.status === "available" || i.status === "claimed").length,
    pendingClaimsNow: claims.filter((c) => c.status === "pending").length,
    weekly: weeks.slice(-MAX_WEEKS).map((week) => ({ week, returned: counts.get(week)! })),
  };
}

/** "5 hours", "1.5 days": short enough for a stat tile. Unit words come from i18n. */
export function durationParts(hours: number): { value: string; unit: "hours" | "hour" | "days" | "day" } {
  if (hours < 48) {
    const h = Math.max(1, Math.round(hours));
    return { value: String(h), unit: h === 1 ? "hour" : "hours" };
  }
  const d = Math.round((hours / 24) * 10) / 10;
  return { value: String(d), unit: d === 1 ? "day" : "days" };
}
