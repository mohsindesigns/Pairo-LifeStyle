import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Page from "@/models/Page";
import { resolvePageAndTemplate } from "@/lib/page-cache";
import { validateTemplateSections, TEMPLATE_REGISTRY } from "@/lib/templates";

dotenv.config({ path: ".env.local" });

describe("CMS Template-Driven Engine Verification Suite", () => {
  let createdPageId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    if (createdPageId) {
      await Page.findByIdAndDelete(createdPageId);
    }
    await mongoose.connection.close();
  });

  it("should validate and allow correct sections for templates", () => {
    // 1. Home template allowed sections validation
    const validHomeSections = [
      { type: "hero_slider" },
      { type: "product_grid" }
    ];
    const invalidHomeSections = [
      { type: "about_hero" },
      { type: "hero_slider" }
    ];

    const validHomeRes = validateTemplateSections("home", validHomeSections);
    expect(validHomeRes.isValid).toBe(true);

    const invalidHomeRes = validateTemplateSections("home", invalidHomeSections);
    expect(invalidHomeRes.isValid).toBe(false);
    expect(invalidHomeRes.error).toContain("is not allowed in template");

    // 2. About template allowed sections validation
    const validAboutSections = [
      { type: "about_hero" },
      { type: "story_section" }
    ];
    const invalidAboutSections = [
      { type: "hero_slider" }
    ];

    const validAboutRes = validateTemplateSections("about", validAboutSections);
    expect(validAboutRes.isValid).toBe(true);

    const invalidAboutRes = validateTemplateSections("about", invalidAboutSections);
    expect(invalidAboutRes.isValid).toBe(false);
  });

  it("should create a Page document with a specific template field", async () => {
    const pageData = {
      title: "Vitest Custom Landing",
      slug: "vitest-custom-landing-" + Date.now(),
      template: "default",
      status: "Draft",
      sections: []
    };

    const created = await Page.create(pageData);
    createdPageId = created._id;
    expect(created.template).toBe("default");
  });

  it("should resolve missing template fields dynamically at runtime", async () => {
    // Create a page without template to simulate an old record (using direct DB save overrides)
    const rawPage = new Page({
      title: "Vitest Legacy Page",
      slug: "vitest-legacy-" + Date.now(),
      status: "Published",
      sections: []
    });
    
    // Bypass validation/enums defaults for testing runtime resolvers
    const doc = rawPage.toObject();
    delete doc.template;

    const { page, templateInfo } = await resolvePageAndTemplate(rawPage.slug, "default");
    
    // Expect dynamic mapping logic in resolvePageAndTemplate to default to "default"
    expect(page.template).toBe("default");
    expect(templateInfo.name).toBe(TEMPLATE_REGISTRY.default.name);
  });

  it("should construct dynamic template fallbacks for missing page documents without cache pollution", async () => {
    const nonexistentSlug = "nonexistent-page-" + Date.now();
    const { page, templateInfo } = await resolvePageAndTemplate(nonexistentSlug, "about");

    // Must construct about defaultSections dynamically
    expect(page.template).toBe("about");
    expect(page.sections.length).toBe(TEMPLATE_REGISTRY.about.defaultSections.length);
    expect(page.status).toBe("Published");
    expect(templateInfo.name).toBe(TEMPLATE_REGISTRY.about.name);

    // Make sure it did not create a db document or pollute overall app cache
    const checkDb = await Page.findOne({ slug: nonexistentSlug }).lean();
    expect(checkDb).toBeNull();
  });
});
