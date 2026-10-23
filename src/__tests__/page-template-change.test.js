import { describe, it, expect } from "vitest";
import { planTemplateChange } from "@/components/admin/builder/templateChange";

const registry = {
  default: { name: "Default", allowedSections: ["text", "image"], defaultSections: [{ type: "text", config: { a: 1 } }] },
  gallery: { name: "Gallery", allowedSections: ["image", "gallery_grid"], defaultSections: [{ type: "gallery_grid" }] },
};
const schemas = { text: { name: "Text Block" }, image: { name: "Image" } };

describe("planTemplateChange", () => {
  it("builds template defaults with fresh ids and cloned config", () => {
    let n = 0;
    const { defaults } = planTemplateChange(registry, schemas, "default", [], () => `id${n++}`);
    expect(defaults).toEqual([{ id: "id0", type: "text", enabled: true, order: 0, config: { a: 1 } }]);
    expect(defaults[0].config).not.toBe(registry.default.defaultSections[0].config);
  });

  it("keeps only sections allowed by the new template and names the removed ones", () => {
    const current = [
      { id: "1", type: "text", order: 0 },
      { id: "2", type: "image", order: 1 },
      { id: "3", type: "text", order: 2 },
    ];
    const { kept, removed, removedNames } = planTemplateChange(registry, schemas, "gallery", current);
    expect(kept).toEqual([{ id: "2", type: "image", order: 0 }]);
    expect(removed.map(s => s.id)).toEqual(["1", "3"]);
    expect(removedNames).toEqual(["Text Block"]);
  });

  it("falls back to the default template for unknown keys", () => {
    const { templateConfig } = planTemplateChange(registry, schemas, "nope", []);
    expect(templateConfig.name).toBe("Default");
  });
});
