import { describe, expect, it } from "vitest";
import type { StaffItem } from "@/lib/domain/types";
import { addDays, computeImpactStats, durationParts, median, resolveRange, startOfDay, weekStart } from "./stats";

const TZ = "America/Los_Angeles";
const NOW = new Date("2026-10-10T19:00:00Z"); // Saturday, Oct 10, noon in Los Angeles
const H = 60 * 60 * 1000;

let n = 0;
function item(createdAt: string, status: StaffItem["status"] = "available", resolvedAt: string | null = null): StaffItem {
  return {
    id: `i${n++}`,
    schoolId: "s",
    status,
    category: "clothing",
    colors: ["gray"],
    note: "Secret note",
    foundLocationId: "l",
    foundLocationName: "Gym",
    foundAt: createdAt,
    visibility: "full",
    ownerHint: "Name: A. Student",
    staffNote: "Private",
    photoPath: null,
    createdAt,
    resolvedAt,
  };
}
const ago = (hours: number) => new Date(NOW.getTime() - hours * H).toISOString();

describe("dates in the school's time zone", () => {
  it("finds the instant a day starts, across daylight saving", () => {
    expect(startOfDay("2026-10-10", TZ).toISOString()).toBe("2026-10-10T07:00:00.000Z"); // PDT
    expect(startOfDay("2026-12-01", TZ).toISOString()).toBe("2026-12-01T08:00:00.000Z"); // PST
    expect(startOfDay("2026-11-01", TZ).toISOString()).toBe("2026-11-01T07:00:00.000Z"); // the day DST ends
    expect(startOfDay("2026-10-10", "UTC").toISOString()).toBe("2026-10-10T00:00:00.000Z");
  });

  it("weeks start on Monday", () => {
    expect(weekStart("2026-10-10")).toBe("2026-10-05");
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
    expect(weekStart("2026-10-04")).toBe("2026-09-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("resolveRange", () => {
  it("presets count back from now", () => {
    const r = resolveRange({ range: "7d" }, NOW, TZ);
    expect(r.from!.toISOString()).toBe("2026-10-03T19:00:00.000Z");
    expect(r.to).toEqual(NOW);
    expect(resolveRange({ range: "all" }, NOW, TZ).from).toBeNull();
  });

  it("the school year starts on August 1 in the school's zone", () => {
    expect(resolveRange({ range: "year" }, NOW, TZ).from!.toISOString()).toBe("2026-08-01T07:00:00.000Z");
    expect(resolveRange({ range: "year" }, new Date("2027-03-01T20:00:00Z"), TZ).fromDay).toBe("2026-08-01");
  });

  it("custom ranges are whole local days, end day included, in either order", () => {
    const r = resolveRange({ range: "custom", from: "2026-10-09", to: "2026-10-01" }, NOW, TZ);
    expect(r.from!.toISOString()).toBe("2026-10-01T07:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-10T07:00:00.000Z");
    expect([r.fromDay, r.toDay]).toEqual(["2026-10-01", "2026-10-09"]);
  });

  it("anything invalid falls back to 30 days", () => {
    expect(resolveRange({ range: "custom", from: "nope", to: "2026-10-01" }, NOW, TZ).key).toBe("30d");
    expect(resolveRange({ range: "forever" }, NOW, TZ).key).toBe("30d");
    expect(resolveRange({}, NOW, TZ).key).toBe("30d");
  });
});

describe("computeImpactStats", () => {
  const items = [
    item(ago(10 * 24), "returned", ago(10 * 24 - 4)), // 4 hours
    item(ago(5 * 24), "returned", ago(5 * 24 - 30)), // 30 hours
    item(ago(3 * 24), "returned", ago(3 * 24 - 50)), // 50 hours
    item(ago(2 * 24)), // still waiting
    item(ago(1 * 24), "claimed"), // waiting for pickup
    item(ago(40 * 24), "returned", ago(6 * 24)), // logged before the period, returned inside it
    item(ago(45 * 24), "donated", ago(8 * 24)),
    item(ago(50 * 24), "returned", ago(40 * 24)), // all outside the period
    item(ago(9 * 24), "removed", ago(8 * 24)),
  ];
  const claims = [{ status: "pending" as const }, { status: "pending" as const }, { status: "picked_up" as const }];

  it("counts the period and today's state", () => {
    const s = computeImpactStats(items, claims, resolveRange({ range: "30d" }, NOW, TZ), TZ);
    expect(s.logged).toBe(6);
    expect(s.returned).toBe(4);
    expect(s.loggedThenReturned).toBe(3);
    expect(s.returnRate).toBeCloseTo(3 / 6);
    expect(s.donated).toBe(1);
    expect(s.waitingNow).toBe(2);
    expect(s.pendingClaimsNow).toBe(2);
    // 4h, 30h, 50h, and 34 days: median of four values.
    expect(s.medianHoursToReturn).toBe((30 + 50) / 2);
  });

  it("buckets returns by week, covering the whole period", () => {
    const s = computeImpactStats(items, claims, resolveRange({ range: "30d" }, NOW, TZ), TZ);
    expect(s.weekly[0].week).toBe(weekStart("2026-09-10"));
    expect(s.weekly.at(-1)!.week).toBe("2026-10-05");
    expect(s.weekly.reduce((a, w) => a + w.returned, 0)).toBe(s.returned);
  });

  it("has nothing to say about an empty period", () => {
    const s = computeImpactStats([], [], resolveRange({ range: "7d" }, NOW, TZ), TZ);
    expect(s.returnRate).toBeNull();
    expect(s.medianHoursToReturn).toBeNull();
    expect(s.weekly.every((w) => w.returned === 0)).toBe(true);
  });

  it("returns only numbers: no notes, names, or ids", () => {
    const s = computeImpactStats(items, claims, resolveRange({ range: "all" }, NOW, TZ), TZ);
    const text = JSON.stringify(s);
    for (const secret of ["Secret note", "A. Student", "Private", '"i1"', "Gym"]) expect(text).not.toContain(secret);
  });
});

describe("small helpers", () => {
  it("median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("durations read naturally", () => {
    expect(durationParts(0.2)).toEqual({ value: "1", unit: "hour" });
    expect(durationParts(5.4)).toEqual({ value: "5", unit: "hours" });
    expect(durationParts(47)).toEqual({ value: "47", unit: "hours" });
    expect(durationParts(60)).toEqual({ value: "2.5", unit: "days" });
    expect(durationParts(24 * 30)).toEqual({ value: "30", unit: "days" });
  });
});
