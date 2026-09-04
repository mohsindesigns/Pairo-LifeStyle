import { describe, it, expect } from "vitest";
import { matchZone } from "@/services/shipping/ZoneMatcher";

describe("ZoneMatcher.matchZone", () => {
  it("matches a country rule case-insensitively and trims whitespace", () => {
    const zones = [
      { _id: "z1", priority: 0, matchRules: [{ type: "country", values: ["US"] }] },
    ];
    const match = matchZone(zones, { country: " us " });
    expect(match?._id).toBe("z1");
  });

  it("falls back to the wildcard (empty matchRules) zone when nothing else matches", () => {
    const zones = [
      { _id: "specific", priority: 0, matchRules: [{ type: "country", values: ["US"] }] },
      { _id: "catchall", priority: 0, matchRules: [] },
    ];
    const match = matchZone(zones, { country: "PK" });
    expect(match?._id).toBe("catchall");
  });

  it("prefers a more specific rule (postal_code) over a less specific one (country) when both zones match", () => {
    const zones = [
      { _id: "country-zone", priority: 0, matchRules: [{ type: "country", values: ["US"] }] },
      { _id: "zip-zone", priority: 0, matchRules: [{ type: "postal_code", values: ["94103"] }] },
    ];
    const match = matchZone(zones, { country: "US", zip: "94103" });
    expect(match?._id).toBe("zip-zone");
  });

  it("requires ALL rules on a zone to match (AND logic)", () => {
    const zones = [
      { _id: "us-ca", priority: 0, matchRules: [{ type: "country", values: ["US"] }, { type: "state", values: ["CA"] }] },
    ];
    expect(matchZone(zones, { country: "US", state: "NY" })).toBeNull();
    expect(matchZone(zones, { country: "US", state: "CA" })?._id).toBe("us-ca");
  });

  it("matches a postal_code_range rule inclusively at both ends", () => {
    const zones = [
      { _id: "range-zone", priority: 0, matchRules: [{ type: "postal_code_range", values: ["10000", "19999"] }] },
    ];
    expect(matchZone(zones, { zip: "10000" })?._id).toBe("range-zone");
    expect(matchZone(zones, { zip: "19999" })?._id).toBe("range-zone");
    expect(matchZone(zones, { zip: "20000" })).toBeNull();
  });

  it("breaks a specificity tie using zone.priority", () => {
    const zones = [
      { _id: "low", priority: 0, matchRules: [{ type: "country", values: ["US"] }] },
      { _id: "high", priority: 10, matchRules: [{ type: "country", values: ["US"] }] },
    ];
    const match = matchZone(zones, { country: "US" });
    expect(match?._id).toBe("high");
  });

  it("returns null when there are no zones and no wildcard fallback", () => {
    expect(matchZone([], { country: "US" })).toBeNull();
    const zones = [{ _id: "z1", priority: 0, matchRules: [{ type: "country", values: ["US"] }] }];
    expect(matchZone(zones, { country: "CA" })).toBeNull();
  });
});
