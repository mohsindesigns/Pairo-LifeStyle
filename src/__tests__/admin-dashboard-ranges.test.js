import { describe, it, expect } from "vitest";
import { getRangeWindow, bucketKeys, bucketLabel, percentChange } from "@/lib/admin-dashboard";

// Wednesday, 23 Oct 2026, 14:30 local time
const NOW = new Date(2026, 9, 23, 14, 30);

describe("getRangeWindow", () => {
  it("covers the whole of today in hourly buckets", () => {
    const w = getRangeWindow("today", NOW);
    expect(w.unit).toBe("hour");
    expect(w.from).toEqual(new Date(2026, 9, 23));
    expect(w.to).toEqual(new Date(2026, 9, 24));
    expect(w.prevFrom).toEqual(new Date(2026, 9, 22));
    expect(w.prevTo).toEqual(w.from);
    expect(bucketKeys(w)).toHaveLength(24);
  });

  it("counts today as the last of the 7 days", () => {
    const w = getRangeWindow("7d", NOW);
    const keys = bucketKeys(w);
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe("2026-10-17");
    expect(keys[6]).toBe("2026-10-23");
  });

  it("gives 30 daily buckets for 30 days", () => {
    expect(bucketKeys(getRangeWindow("30d", NOW))).toHaveLength(30);
  });

  it("runs the year from January to the current month", () => {
    const w = getRangeWindow("year", NOW);
    const keys = bucketKeys(w);
    expect(keys[0]).toBe("2026-01");
    expect(keys[keys.length - 1]).toBe("2026-10");
    expect(keys).toHaveLength(10);
  });

  it("rejects unknown ranges", () => {
    expect(() => getRangeWindow("decade", NOW)).toThrow();
  });
});

describe("bucketLabel", () => {
  it("formats each unit", () => {
    expect(bucketLabel("2026-10-23T00", "hour")).toBe("12 am");
    expect(bucketLabel("2026-10-23T15", "hour")).toBe("3 pm");
    expect(bucketLabel("2026-10-05", "day")).toBe("Oct 5");
    expect(bucketLabel("2026-02", "month")).toBe("Feb");
  });
});

describe("percentChange", () => {
  it("returns null without a previous value", () => {
    expect(percentChange(100, 0)).toBeNull();
  });
  it("computes the change", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });
});
