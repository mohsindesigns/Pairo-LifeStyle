import { describe, it, expect } from "vitest";
import { buildZoneCopy, buildMethodCopy, buildPickupCopy, isCatchAllZone, copyName } from "@/app/api/admin/shipping/copy-helpers";

describe("shipping copies", () => {
  it("zone copy is inactive with the same rules", () => {
    const z = { _id: "z", name: "Europe", priority: 3, status: "Active", matchRules: [{ type: "country", values: ["DE"] }] };
    const c = buildZoneCopy(z, 9);
    expect(c).toEqual({ name: "Europe (Copy)", description: "", priority: 3, sortOrder: 9, status: "Inactive", matchRules: [{ type: "country", values: ["DE"] }] });
    c.matchRules[0].values.push("FR");
    expect(z.matchRules[0].values).toEqual(["DE"]);
  });
  it("method copy: standalone is inactive + renamed; with its zone keeps name/status", () => {
    const m = { name: "Flat", provider: "FLAT_RATE", settings: { cost: 5 }, status: "Active", sortOrder: 2 };
    expect(buildMethodCopy(m, "z1")).toMatchObject({ zoneId: "z1", name: "Flat (Copy)", status: "Inactive", settings: { cost: 5 } });
    expect(buildMethodCopy(m, "z2", { keepName: true })).toMatchObject({ zoneId: "z2", name: "Flat", status: "Active" });
  });
  it("pickup copy is inactive and keeps the address", () => {
    const c = buildPickupCopy({ name: "Shop", address: { city: "Lahore" } }, 4);
    expect(c).toMatchObject({ name: "Shop (Copy)", status: "Inactive", sortOrder: 4 });
    expect(c.address).toEqual({ street: "", city: "Lahore", state: "", zip: "", country: "" });
  });
  it("helpers", () => {
    expect(isCatchAllZone({ matchRules: [] })).toBe(true);
    expect(isCatchAllZone({ matchRules: [{ type: "country" }] })).toBe(false);
    expect(copyName("  ", "Zone")).toBe("Zone (Copy)");
  });
});
