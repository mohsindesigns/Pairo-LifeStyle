import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import dbConnect from "../lib/db";
import Product from "../models/Product";
import Page from "../models/Page";
import Blog from "../models/Blog";

describe("Database SEO Persistence Tests", () => {
  beforeAll(async () => {
    await dbConnect();
  });

  it("should successfully save and retrieve SEO fields on a Product", async () => {
    // 1. Create a dummy product
    const productData = {
      tenantId: "TEST_TENANT",
      name: "SEO Test Jacket",
      slug: "seo-test-jacket",
      price: 299,
      status: "Draft",
      seo: {
        title: "Custom SEO Title for Jacket",
        description: "Custom SEO Description for Jacket",
        focusKeyword: "jacket",
        keywords: ["jacket", "shearling"],
        ogTitle: "OG Title Jacket",
        ogDescription: "OG Description Jacket",
        ogImage: "http://example.com/og.jpg"
      }
    };

    // Clean old test records
    await Product.deleteOne({ slug: "seo-test-jacket", tenantId: "TEST_TENANT" });

    const created = await Product.create(productData);
    expect(created.seo.title).toBe("Custom SEO Title for Jacket");
    expect(created.seo.keywords).toContain("jacket");

    // 2. Test updating via findOneAndUpdate (how the API route does it)
    const updateData = {
      name: "SEO Test Jacket Edited",
      seo: {
        title: "Updated SEO Title",
        description: "Updated SEO Description",
        focusKeyword: "updated jacket",
        keywords: ["updated", "jacket"],
        ogTitle: "Updated OG Title",
        ogDescription: "Updated OG Description",
        ogImage: "http://example.com/updated-og.jpg"
      }
    };

    const updated = await Product.findOneAndUpdate(
      { _id: created._id, tenantId: "TEST_TENANT" },
      updateData,
      { new: true }
    );

    expect(updated.seo.title).toBe("Updated SEO Title");
    expect(updated.seo.description).toBe("Updated SEO Description");
    expect(updated.seo.keywords).toContain("updated");

    // Retrieve from DB to make sure it's persisted
    const retrieved = await Product.findById(created._id).lean();
    expect(retrieved.seo.title).toBe("Updated SEO Title");
    expect(retrieved.seo.description).toBe("Updated SEO Description");

    // Cleanup
    await Product.deleteOne({ _id: created._id });
  });

  it("should successfully save and retrieve SEO fields on a Page", async () => {
    const pageData = {
      tenantId: "TEST_TENANT",
      title: "SEO Test Page",
      slug: "seo-test-page",
      status: "Draft",
      seo: {
        title: "Custom Page SEO Title",
        description: "Custom Page SEO Description",
        focusKeyword: "page",
        keywords: ["page", "test"],
        ogTitle: "OG Title Page",
        ogDescription: "OG Description Page",
        ogImage: "http://example.com/page-og.jpg"
      }
    };

    // Clean old test records
    await Page.deleteOne({ slug: "seo-test-page", tenantId: "TEST_TENANT" });

    const created = await Page.create(pageData);
    expect(created.seo.title).toBe("Custom Page SEO Title");
    expect(created.seo.keywords).toContain("page");

    // Update via findByIdAndUpdate (how the API route does it)
    const updateData = {
      seo: {
        title: "Updated Page SEO Title",
        description: "Updated Page SEO Description",
        focusKeyword: "updated page",
        keywords: ["updated", "page"],
        ogTitle: "Updated OG Title Page",
        ogDescription: "Updated OG Description Page",
        ogImage: "http://example.com/updated-page-og.jpg"
      }
    };

    const updated = await Page.findByIdAndUpdate(
      created._id,
      { ...updateData, updatedBy: created._id },
      { new: true }
    );

    expect(updated.seo.title).toBe("Updated Page SEO Title");
    expect(updated.seo.description).toBe("Updated Page SEO Description");
    expect(updated.seo.keywords).toContain("updated");

    const retrieved = await Page.findById(created._id).lean();
    expect(retrieved.seo.title).toBe("Updated Page SEO Title");
    expect(retrieved.seo.description).toBe("Updated Page SEO Description");

    // Cleanup
    await Page.deleteOne({ _id: created._id });
  });

  it("should successfully save and retrieve SEO fields on a Blog", async () => {
    const blogData = {
      tenantId: "TEST_TENANT",
      title: "SEO Test Blog",
      slug: "seo-test-blog",
      status: "Draft",
      seo: {
        title: "Custom Blog SEO Title",
        description: "Custom Blog SEO Description",
        focusKeyword: "blog",
        keywords: ["blog", "test"],
        ogTitle: "OG Title Blog",
        ogDescription: "OG Description Blog",
        ogImage: "http://example.com/blog-og.jpg"
      }
    };

    // Clean old test records
    await Blog.deleteOne({ slug: "seo-test-blog", tenantId: "TEST_TENANT" });

    const created = await Blog.create(blogData);
    expect(created.seo.title).toBe("Custom Blog SEO Title");

    // Update via findOneAndUpdate (how the API route does it)
    const updateData = {
      seo: {
        title: "Updated Blog SEO Title",
        description: "Updated Blog SEO Description",
        focusKeyword: "updated blog",
        keywords: ["updated", "blog"],
        ogTitle: "Updated OG Title Blog",
        ogDescription: "Updated OG Description Blog",
        ogImage: "http://example.com/updated-blog-og.jpg"
      }
    };

    const updated = await Blog.findOneAndUpdate(
      { _id: created._id, tenantId: "TEST_TENANT" },
      updateData,
      { new: true }
    );

    expect(updated.seo.title).toBe("Updated Blog SEO Title");
    expect(updated.seo.description).toBe("Updated Blog SEO Description");

    const retrieved = await Blog.findById(created._id).lean();
    expect(retrieved.seo.title).toBe("Updated Blog SEO Title");
    expect(retrieved.seo.description).toBe("Updated Blog SEO Description");

    // Cleanup
    await Blog.deleteOne({ _id: created._id });
  });
});
