import { describe, it, expect } from "vitest";
import { hydratePageDefaults, hydrateSectionDefaults, withSectionDefaults, SECTION_DEFAULTS } from "@/lib/section-defaults";
import { SECTION_SCHEMAS } from "@/lib/section-schemas";

describe("section defaults (what the page builder shows)", () => {
  it("fills an empty gifting page with the real content", () => {
    const page = hydratePageDefaults({
      sections: [
        { id: "a", type: "corporate_gifting_hero", config: {} },
        { id: "b", type: "corporate_gifting_process", config: {} },
        { id: "c", type: "corporate_gifting_form", config: {} },
        { id: "d", type: "rich_text", config: { html: "x" } },
      ],
    });
    expect(page.sections[0].config.title).toBe("CUSTOMIZE CORPORATE GIFTING");
    expect(page.sections[1].config.steps).toHaveLength(4);
    const form = page.sections[2].config;
    expect(form.formTitle).toBe("BUILD YOUR GIFT PACK");
    expect(form.minQuantity).toBe(10);
    expect(form.occasions[0]).toEqual({ label: "Employee appreciation" });
    expect(form.packItems).toHaveLength(8);
    expect(page.sections[3].config).toEqual({ html: "x" }); // untouched
  });

  it("never overwrites what the admin saved, including deliberately cleared fields", () => {
    const s = hydrateSectionDefaults({
      type: "corporate_gifting_hero",
      config: { title: "My title", secondaryButtonText: "", minQuantity: 0 },
    });
    expect(s.config.title).toBe("My title");
    expect(s.config.secondaryButtonText).toBe("");
    expect(s.config.primaryButtonText).toBe("Build your pack");
  });

  it("every default key has an editable field in the builder schema", () => {
    for (const type of Object.keys(SECTION_DEFAULTS)) {
      const fieldNames = SECTION_SCHEMAS[type].fields.map((f) => f.name);
      for (const key of Object.keys(SECTION_DEFAULTS[type])) {
        expect(fieldNames, `${type}.${key} has no builder field`).toContain(key);
      }
    }
  });

  it("props override defaults but undefined never does", () => {
    const merged = withSectionDefaults("corporate_gifting_hero", { title: "Hi", subtitle: undefined });
    expect(merged.title).toBe("Hi");
    expect(merged.subtitle).toMatch(/Handcrafted/);
  });
});
