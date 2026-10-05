import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Page from "@/models/Page";
import { validateTemplateSections, TEMPLATE_REGISTRY } from "@/lib/templates";
import { SECTION_REGISTRY } from "@/lib/section-registry";
import { SECTION_SCHEMAS } from "@/lib/section-schemas";
import { resolvePageSections } from "@/lib/page-data-resolver";

dotenv.config({ path: ".env.local" });

describe("New Homepage Sections Verification Suite", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("should have trust_badges and dual_category_banner registered in SECTION_REGISTRY", () => {
    expect(SECTION_REGISTRY["trust_badges"]).toBeDefined();
    expect(SECTION_REGISTRY["dual_category_banner"]).toBeDefined();
  });

  it("should have trust_badges and dual_category_banner in TEMPLATE_REGISTRY.home.allowedSections", () => {
    expect(TEMPLATE_REGISTRY.home.allowedSections).toContain("trust_badges");
    expect(TEMPLATE_REGISTRY.home.allowedSections).toContain("dual_category_banner");
  });

  it("should validate without error using validateTemplateSections", () => {
    const sections = [
      { type: "hero_slider" },
      { type: "trust_badges" },
      { type: "dual_category_banner" }
    ];
    const result = validateTemplateSections("home", sections);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
  });

  it("should have comprehensive schemas for both sections in SECTION_SCHEMAS", () => {
    const tbSchema = SECTION_SCHEMAS["trust_badges"];
    expect(tbSchema).toBeDefined();
    expect(tbSchema.name).toBe("Trust Badges & Stats");
    expect(tbSchema.fields.length).toBeGreaterThan(0);
    const tbItemsField = tbSchema.fields.find(f => f.name === "items");
    expect(tbItemsField).toBeDefined();
    expect(tbItemsField.type).toBe("repeater");
    const subFieldNames = tbItemsField.fields.map(f => f.name);
    expect(subFieldNames).toContain("title");
    expect(subFieldNames).toContain("description");
    expect(subFieldNames).toContain("icon");
    expect(subFieldNames).toContain("customIcon");

    const dbSchema = SECTION_SCHEMAS["dual_category_banner"];
    expect(dbSchema).toBeDefined();
    expect(dbSchema.name).toBe("Side-by-Side Category Banners");
    const dbBannersField = dbSchema.fields.find(f => f.name === "banners");
    expect(dbBannersField).toBeDefined();
    expect(dbBannersField.type).toBe("repeater");
    const dbSubFieldNames = dbBannersField.fields.map(f => f.name);
    expect(dbSubFieldNames).toContain("image");
    expect(dbSubFieldNames).toContain("heading");
    expect(dbSubFieldNames).toContain("buttonText");
    expect(dbSubFieldNames).toContain("link");
  });

  it("should resolve homepage sections from the live database without errors", async () => {
    const homePage = await Page.findOne({ slug: "home" }).lean();
    expect(homePage).toBeDefined();
    expect(homePage.sections).toBeDefined();

    const sectionTypes = homePage.sections.map(s => s.type);
    expect(sectionTypes).toContain("trust_badges");
    expect(sectionTypes).toContain("dual_category_banner");

    // Ensure API page validation passes for current database state
    const validation = validateTemplateSections("home", homePage.sections);
    expect(validation.isValid).toBe(true);

    // Resolve sections with page-data-resolver
    const resolved = await resolvePageSections(homePage.sections);
    expect(resolved).toBeDefined();
    expect(resolved.length).toBe(homePage.sections.length);

    const resolvedTb = resolved.find(s => s.type === "trust_badges");
    expect(resolvedTb.config.items).toBeDefined();
    expect(resolvedTb.config.items.length).toBeGreaterThan(0);

    const resolvedDb = resolved.find(s => s.type === "dual_category_banner");
    expect(resolvedDb.config.banners).toBeDefined();
    expect(resolvedDb.config.banners.length).toBe(2);
  });
});
