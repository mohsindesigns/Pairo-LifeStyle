import { describe, it, expect } from "vitest";
import { isOptionAvailable, buildVariantTitle } from "@/lib/stock";

const product = {
  manageStock: true,
  attributes: [
    { name: "Color", values: [{ label: "Black" }, { label: "Blue" }] },
    { name: "Size", values: [{ label: "M" }, { label: "L" }] },
  ],
  variantCombinations: [
    { title: "Black / M", stock: 3 },
    { title: "Black / L", stock: 0 },
    { title: "Blue / M", stock: 0 },
    { title: "Blue / L", stock: 2 },
  ],
};

describe("buildVariantTitle", () => {
  it("joins values in attribute order, not selection order", () => {
    expect(buildVariantTitle(product, { Size: "M", Color: "Black" })).toBe("Black / M");
  });
  it("falls back to the selection order for unknown attributes", () => {
    expect(buildVariantTitle({ attributes: [] }, { X: "a", Y: "b" })).toBe("a / b");
  });
});

describe("isOptionAvailable", () => {
  it("judges a value against the other selected attributes", () => {
    expect(isOptionAvailable(product, { Color: "Black" }, "Size", "M")).toBe(true);
    expect(isOptionAvailable(product, { Color: "Black" }, "Size", "L")).toBe(false);
    expect(isOptionAvailable(product, { Color: "Blue" }, "Size", "M")).toBe(false);
    expect(isOptionAvailable(product, { Color: "Blue" }, "Size", "L")).toBe(true);
  });
  it("with nothing else chosen, a value is available if any combination has stock", () => {
    expect(isOptionAvailable(product, {}, "Size", "L")).toBe(true);
    expect(isOptionAvailable(product, {}, "Color", "Blue")).toBe(true);
  });
  it("ignores the current choice of the attribute being asked about", () => {
    expect(isOptionAvailable(product, { Color: "Black", Size: "L" }, "Size", "M")).toBe(true);
    expect(isOptionAvailable(product, { Size: "M" }, "Color", "Blue")).toBe(false);
    expect(isOptionAvailable(product, { Size: "M" }, "Color", "Black")).toBe(true);
  });
  it("marks a value unavailable when every combination containing it is out of stock", () => {
    const p = { ...product, variantCombinations: product.variantCombinations.map((v) => v.title.startsWith("Blue") ? { ...v, stock: 0 } : v) };
    expect(isOptionAvailable(p, {}, "Color", "Blue")).toBe(false);
  });
  it("is always available when stock is not managed", () => {
    expect(isOptionAvailable({ ...product, manageStock: false }, { Color: "Black" }, "Size", "L")).toBe(true);
  });
  it("is available when it cannot be determined", () => {
    expect(isOptionAvailable({ ...product, variantCombinations: [] }, {}, "Size", "L")).toBe(true);
    expect(isOptionAvailable(product, {}, "Fabric", "Wool")).toBe(true);
    expect(isOptionAvailable(product, {}, "Size", "XL")).toBe(true);
    const odd = { ...product, variantCombinations: [...product.variantCombinations, { title: "Black", stock: 0 }] };
    expect(isOptionAvailable(odd, { Color: "Black" }, "Size", "L")).toBe(true);
  });
  it("treats a missing stock number as zero", () => {
    const p = { ...product, variantCombinations: [{ title: "Black / M" }, { title: "Black / L", stock: 1 }, { title: "Blue / M", stock: 1 }, { title: "Blue / L", stock: 1 }] };
    expect(isOptionAvailable(p, { Color: "Black" }, "Size", "M")).toBe(false);
  });
});
