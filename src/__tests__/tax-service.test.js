import { describe, it, expect } from "vitest";
import { taxService, rowMatches, postcodeMatches } from "@/services/tax/TaxService";

function baseSettings(overrides = {}) {
  return {
    enabled: true,
    calculationMethod: "exclusive",
    taxRoundingMode: "round",
    taxClasses: [
      { key: "standard", name: "Standard", isDefault: true, rates: [] },
    ],
    ...overrides,
  };
}

describe("postcodeMatches", () => {
  it("matches exact postcodes", () => {
    expect(postcodeMatches("94103", "94103")).toBe(true);
    expect(postcodeMatches("94103", "94104")).toBe(false);
  });

  it("matches wildcard prefixes", () => {
    expect(postcodeMatches("9410*", "94103")).toBe(true);
    expect(postcodeMatches("9410*", "95000")).toBe(false);
  });

  it("matches numeric ranges inclusively", () => {
    expect(postcodeMatches("10000...19999", "15000")).toBe(true);
    expect(postcodeMatches("10000...19999", "20000")).toBe(false);
  });

  it("treats a blank row postcode as matching anything", () => {
    expect(postcodeMatches("", "94103")).toBe(true);
  });
});

describe("rowMatches", () => {
  it("a fully blank row matches any address", () => {
    expect(rowMatches({}, { country: "US", state: "CA" })).toBe(true);
  });

  it("requires country to match when specified", () => {
    expect(rowMatches({ country: "US" }, { country: "us" })).toBe(true);
    expect(rowMatches({ country: "US" }, { country: "CA" })).toBe(false);
  });

  it("requires state to match when specified, independent of country", () => {
    expect(rowMatches({ state: "CA" }, { country: "US", state: "ca" })).toBe(true);
    expect(rowMatches({ state: "CA" }, { country: "US", state: "NY" })).toBe(false);
  });
});

describe("TaxService.getTaxClass", () => {
  it("resolves the class flagged isDefault when no key is given", () => {
    const settings = baseSettings({
      taxClasses: [
        { key: "standard", name: "Standard", isDefault: true, rates: [] },
        { key: "reduced-rate", name: "Reduced Rate", isDefault: false, rates: [] },
      ],
    });
    expect(taxService.getTaxClass(settings).key).toBe("standard");
  });

  it("resolves a specific class by key when given", () => {
    const settings = baseSettings({
      taxClasses: [
        { key: "standard", name: "Standard", isDefault: true, rates: [] },
        { key: "reduced-rate", name: "Reduced Rate", isDefault: false, rates: [] },
      ],
    });
    expect(taxService.getTaxClass(settings, "reduced-rate").key).toBe("reduced-rate");
  });
});

describe("TaxService.calculateTax", () => {
  it("returns zero tax when the tax module is disabled", () => {
    const settings = baseSettings({ enabled: false });
    const result = taxService.calculateTax(100, 10, settings, { country: "US" });
    expect(result.taxAmount).toBe(0);
  });

  it("a 0% catch-all rate applies as 0% rather than being skipped (regression: previously a falsy defaultTaxRate short-circuited the whole engine)", () => {
    const settings = baseSettings({
      taxClasses: [{
        key: "standard", name: "Standard", isDefault: true,
        rates: [{ country: "", state: "", postcode: "", city: "", rate: 0, name: "Tax", priority: 1, compound: false, shipping: false }],
      }],
    });
    const result = taxService.calculateTax(100, 0, settings, { country: "PK" });
    expect(result.taxAmount).toBe(0);
    expect(result.breakdown).toHaveLength(1);
  });

  it("a region-specific rate still applies even when the catch-all rate is 0%", () => {
    const settings = baseSettings({
      taxClasses: [{
        key: "standard", name: "Standard", isDefault: true,
        rates: [
          { country: "", state: "", postcode: "", city: "", rate: 0, name: "Default", priority: 1, compound: false, shipping: false },
          { country: "US", state: "CA", postcode: "", city: "", rate: 8.5, name: "CA Sales Tax", priority: 2, compound: false, shipping: false },
        ],
      }],
    });
    const result = taxService.calculateTax(100, 0, settings, { country: "US", state: "CA" });
    // Both rows match (blank catch-all + specific CA row) and stack, matching real combined-tax behavior.
    expect(result.taxAmount).toBe(8.5);
  });

  it("computes simple exclusive tax on subtotal only when shipping is not taxable for that row", () => {
    const settings = baseSettings({
      taxClasses: [{
        key: "standard", name: "Standard", isDefault: true,
        rates: [{ country: "US", state: "", postcode: "", city: "", rate: 10, name: "VAT", priority: 1, compound: false, shipping: false }],
      }],
    });
    const result = taxService.calculateTax(100, 20, settings, { country: "US" });
    expect(result.taxAmount).toBe(10);
    expect(result.breakdown[0].onShipping).toBe(0);
  });

  it("applies tax to shipping when the row's shipping flag is set", () => {
    const settings = baseSettings({
      taxClasses: [{
        key: "standard", name: "Standard", isDefault: true,
        rates: [{ country: "US", rate: 10, name: "VAT", priority: 1, compound: false, shipping: true }],
      }],
    });
    const result = taxService.calculateTax(100, 20, settings, { country: "US" });
    expect(result.taxAmount).toBe(12); // 10 on subtotal + 2 on shipping
  });

  it("sums multiple simultaneous simple rates that both match the same address", () => {
    const settings = baseSettings({
      taxClasses: [{
        key: "standard", name: "Standard", isDefault: true,
        rates: [
          { country: "CA", rate: 5, name: "GST", priority: 1, compound: false, shipping: false },
          { country: "CA", state: "ON", rate: 8, name: "PST", priority: 1, compound: false, shipping: false },
        ],
      }],
    });
    const result = taxService.calculateTax(100, 0, settings, { country: "CA", state: "ON" });
    expect(result.taxAmount).toBe(13);
    expect(result.breakdown).toHaveLength(2);
  });

  it("applies a compound rate on top of subtotal + already-applied simple tax", () => {
    const settings = baseSettings({
      taxClasses: [{
        key: "standard", name: "Standard", isDefault: true,
        rates: [
          { country: "CA", rate: 5, name: "GST", priority: 1, compound: false, shipping: false },
          { country: "CA", state: "QC", rate: 10, name: "QST", priority: 2, compound: true, shipping: false },
        ],
      }],
    });
    // GST: 100 * 5% = 5. QST (compound): (100 + 5) * 10% = 10.5
    const result = taxService.calculateTax(100, 0, settings, { country: "CA", state: "QC" });
    expect(result.taxAmount).toBe(15.5);
  });

  it("backs tax out of an inclusive subtotal correctly for the simple (non-compound) case", () => {
    const settings = baseSettings({
      calculationMethod: "inclusive",
      taxClasses: [{
        key: "standard", name: "Standard", isDefault: true,
        rates: [{ country: "US", rate: 10, name: "VAT", priority: 1, compound: false, shipping: false }],
      }],
    });
    // 110 inclusive of 10% tax means 100 exclusive + 10 tax.
    const result = taxService.calculateTax(110, 0, settings, { country: "US" });
    expect(result.taxAmount).toBe(10);
  });

  it("uses the requested tax class instead of the default when classKey is passed", () => {
    const settings = baseSettings({
      taxClasses: [
        { key: "standard", name: "Standard", isDefault: true, rates: [{ country: "US", rate: 10, name: "Standard Tax", priority: 1, compound: false, shipping: false }] },
        { key: "zero-rate", name: "Zero Rate", isDefault: false, rates: [{ country: "US", rate: 0, name: "Zero", priority: 1, compound: false, shipping: false }] },
      ],
    });
    const result = taxService.calculateTax(100, 0, settings, { country: "US" }, "zero-rate");
    expect(result.taxAmount).toBe(0);
  });

  it("respects the rounding mode", () => {
    const floorSettings = baseSettings({
      taxRoundingMode: "floor",
      taxClasses: [{ key: "standard", name: "Standard", isDefault: true, rates: [{ country: "US", rate: 12.345, name: "Tax", priority: 1, compound: false, shipping: false }] }],
    });
    // 100 * 12.345% = 12.345 -> floor to cents = 12.34
    const result = taxService.calculateTax(100, 0, floorSettings, { country: "US" });
    expect(result.taxAmount).toBe(12.34);
  });
});
