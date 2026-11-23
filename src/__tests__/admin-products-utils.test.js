import { describe, it, expect } from "vitest";
import {
  validatePrices,
  priceWarning,
  parseRequiredPrice,
  buildVariantSku,
  paginate,
  copySlugCandidate,
  restoreStatus,
} from "@/lib/admin-products-utils";

describe("validatePrices (regular = compareAtPrice, sale = price)", () => {
  it("allows empty values", () => {
    expect(validatePrices("", "")).toBeNull();
    expect(validatePrices(null, undefined)).toBeNull();
    expect(validatePrices("", "10")).toBeNull();
    expect(validatePrices("10", "")).toBeNull();
  });
  it("accepts sale lower than regular", () => {
    expect(validatePrices("100", "79.99")).toBeNull();
    expect(validatePrices(100, 0)).toBeNull();
  });
  it("warns, but does not reject, sale >= regular", () => {
    expect(validatePrices("100", "100")).toBeNull();
    expect(validatePrices(50, 60)).toBeNull();
    expect(priceWarning("100", "100")).toMatch(/not lower/);
    expect(priceWarning(50, 60)).toMatch(/not lower/);
    expect(priceWarning(60, 50)).toBeNull();
  });
  it("rejects negatives and non-numbers", () => {
    expect(validatePrices("-1", "")).toMatch(/Regular price cannot be negative/);
    expect(validatePrices("", "-5")).toMatch(/Sale price cannot be negative/);
    expect(validatePrices("abc", "")).toMatch(/valid number/);
  });
});

describe("parseRequiredPrice", () => {
  it("rejects empty and invalid input", () => {
    expect(parseRequiredPrice("").error).toBeTruthy();
    expect(parseRequiredPrice("  ").error).toBeTruthy();
    expect(parseRequiredPrice(undefined).error).toBeTruthy();
    expect(parseRequiredPrice("x").error).toBeTruthy();
    expect(parseRequiredPrice("-3").error).toBeTruthy();
  });
  it("parses valid numbers", () => {
    expect(parseRequiredPrice("12.5")).toEqual({ value: 12.5 });
    expect(parseRequiredPrice(0)).toEqual({ value: 0 });
  });
});

describe("buildVariantSku", () => {
  it("omits an empty base SKU", () => {
    expect(buildVariantSku("", ["Red", "S"])).toBe("RED-S");
    expect(buildVariantSku(undefined, ["Red"])).toBe("RED");
  });
  it("joins base and labels", () => {
    expect(buildVariantSku("pr-001", ["Red", "S"])).toBe("PR-001-RED-S");
  });
});

describe("paginate", () => {
  const list = Array.from({ length: 45 }, (_, i) => i);
  it("slices 20 per page and counts pages", () => {
    const r = paginate(list, 1);
    expect(r.items).toHaveLength(20);
    expect(r.totalPages).toBe(3);
    expect(paginate(list, 3).items).toEqual([40, 41, 42, 43, 44]);
  });
  it("clamps out-of-range pages", () => {
    expect(paginate(list, 99).page).toBe(3);
    expect(paginate(list, 0).page).toBe(1);
    expect(paginate([], 5)).toEqual({ items: [], page: 1, totalPages: 1 });
  });
});

describe("copySlugCandidate", () => {
  it("generates -copy, -copy-2, …", () => {
    expect(copySlugCandidate("jacket", 1)).toBe("jacket-copy");
    expect(copySlugCandidate("jacket", 2)).toBe("jacket-copy-2");
  });
  it("does not stack suffixes when copying a copy", () => {
    expect(copySlugCandidate("jacket-copy", 1)).toBe("jacket-copy");
    expect(copySlugCandidate("jacket-copy-3", 2)).toBe("jacket-copy-2");
    expect(copySlugCandidate("", 1)).toBe("product-copy");
  });
});

describe("restoreStatus", () => {
  it("restores the pre-trash status, else Draft", () => {
    expect(restoreStatus("Published")).toBe("Published");
    expect(restoreStatus("Draft")).toBe("Draft");
    expect(restoreStatus(undefined)).toBe("Draft");
    expect(restoreStatus("weird")).toBe("Draft");
  });
});
