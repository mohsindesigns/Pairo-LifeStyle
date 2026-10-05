import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Page from "@/models/Page";

dotenv.config({ path: ".env.local" });

vi.mock("next-auth", () => ({
  default: () => () => {},
  getServerSession: () => Promise.resolve({
    user: { id: new mongoose.Types.ObjectId().toString(), isStaff: true, role: "Super Admin" }
  })
}));

vi.mock("@/lib/rbac", () => ({
  can: () => true
}));

vi.mock("@/lib/audit", () => ({
  logAction: () => Promise.resolve()
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {}
}));

describe("Admin Pages API - System Pages & Slug Collision Protection", () => {
  let testSystemPage;
  let testCustomPage;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    testSystemPage = await Page.create({
      title: "Test System Contact",
      slug: "test-contact-" + Date.now(),
      template: "contact",
      isSystem: true,
      status: "Published",
      sections: [
        { id: "s1", type: "contact_hero", config: { title: "Hello" } },
        { id: "s2", type: "contact_section", config: { address: "123 St" } }
      ]
    });

    testCustomPage = await Page.create({
      title: "Test Custom Page",
      slug: "test-custom-" + Date.now(),
      template: "default",
      isSystem: false,
      status: "Published",
      sections: []
    });
  });

  afterAll(async () => {
    if (testSystemPage) await Page.deleteOne({ _id: testSystemPage._id });
    if (testCustomPage) await Page.deleteOne({ _id: testCustomPage._id });
    await mongoose.connection.close();
  });

  it("should allow updating a system page without throwing reserved route collision error", async () => {
    const { PUT } = await import("@/app/api/admin/pages/[id]/route");

    const req = {
      json: async () => ({
        title: "Updated Test System Contact",
        slug: testSystemPage.slug,
        sections: [
          { id: "s1", type: "contact_hero", config: { title: "Updated Hello" } },
          { id: "s2", type: "contact_section", config: { address: "5880 E 2nd St" } }
        ]
      })
    };

    const res = await PUT(req, { params: Promise.resolve({ id: testSystemPage._id.toString() }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("Updated Test System Contact");
    expect(data.slug).toBe(testSystemPage.slug);
  });

  it("should allow saving a system page with slug 'contact' (reserved route) without collision error", async () => {
    const contactSystemPage = await Page.create({
      title: "Contact Us Reserved Test",
      slug: "contact-temp-" + Date.now(),
      template: "contact",
      isSystem: true,
      status: "Published",
      sections: [
        { id: "s1", type: "contact_hero", config: { title: "Hero" } },
        { id: "s2", type: "contact_section", config: { officeTitle: "USA" } }
      ]
    });

    const { PUT } = await import("@/app/api/admin/pages/[id]/route");

    const req = {
      json: async () => ({
        title: "Contact Us Reserved Test Updated",
        slug: contactSystemPage.slug,
        sections: [
          { id: "s1", type: "contact_hero", config: { title: "Hero New" } },
          { id: "s2", type: "contact_section", config: { officeTitle: "USA New" } }
        ]
      })
    };

    const res = await PUT(req, { params: Promise.resolve({ id: contactSystemPage._id.toString() }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("Contact Us Reserved Test Updated");

    await Page.deleteOne({ _id: contactSystemPage._id });
  });

  it("should reject changing a system page's slug", async () => {
    const { PUT } = await import("@/app/api/admin/pages/[id]/route");

    const req = {
      json: async () => ({
        title: "Hacked Slug",
        slug: "new-system-slug",
        sections: []
      })
    };

    const res = await PUT(req, { params: Promise.resolve({ id: testSystemPage._id.toString() }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("System page slug cannot be modified");
  });

  it("should reject changing a custom page to a reserved system route", async () => {
    const { PUT } = await import("@/app/api/admin/pages/[id]/route");

    const req = {
      json: async () => ({
        title: "Hijacked Cart",
        slug: "cart",
        sections: []
      })
    };

    const res = await PUT(req, { params: Promise.resolve({ id: testCustomPage._id.toString() }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Slug collides with a reserved system route");
  });
});
