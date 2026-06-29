import { describe, it, expect } from "vitest";
import { normalizePath, isReservedPath } from "../lib/redirect-resolver";
import { sanitizeSEOString, validateAndParseJsonLd, resolveSEOMetadata, normalizeCanonicalUrl } from "../lib/seo-resolver";

describe("SEO - Path Normalization", () => {
  it("should lowercase and trim paths", () => {
    expect(normalizePath("  /Product/Shearling-Jacket/   ")).toBe("/product/shearling-jacket");
  });

  it("should strip trailing slashes but preserve root", () => {
    expect(normalizePath("/shop/")).toBe("/shop");
    expect(normalizePath("/")).toBe("/");
  });

  it("should clean duplicate slashes", () => {
    expect(normalizePath("///product//shearling-jacket///")).toBe("/product/shearling-jacket");
  });

  it("should decode URI components", () => {
    expect(normalizePath("/shop?category=mens%20jackets")).toBe("/shop?category=mens jackets");
  });

  it("should keep absolute URLs intact", () => {
    expect(normalizePath("https://pairolifestyle.com/product/jacket")).toBe("https://pairolifestyle.com/product/jacket");
  });
});

describe("SEO - Reserved Path Safeguards", () => {
  it("should flag reserved paths correctly", () => {
    expect(isReservedPath("/admin")).toBe(true);
    expect(isReservedPath("/admin/products")).toBe(true);
    expect(isReservedPath("/api/products")).toBe(true);
    expect(isReservedPath("/checkout/success")).toBe(true);
    expect(isReservedPath("cart")).toBe(true);
  });

  it("should not flag normal storefront paths", () => {
    expect(isReservedPath("/product/shearling-jacket")).toBe(false);
    expect(isReservedPath("/blog/style-guide")).toBe(false);
    expect(isReservedPath("/about-us")).toBe(false);
  });
});

describe("SEO - Metadata Sanitization", () => {
  it("should strip script tags and HTML elements", () => {
    const dirty = "Premium <script>alert('XSS')</script> Shearling <b>Jacket</b>";
    expect(sanitizeSEOString(dirty).replace(/\s+/g, " ")).toBe("Premium Shearling Jacket");
  });

  it("should strip quotes to prevent breaking meta tags", () => {
    const dirty = 'Modern "Shearling" jacket\'s story';
    expect(sanitizeSEOString(dirty)).toBe("Modern Shearling jackets story");
  });
});

describe("SEO - JSON-LD Schema Validation", () => {
  it("should parse valid JSON-LD schemas and ensure @context", () => {
    const valid = '{"@type": "Product", "name": "Shearling Co."}';
    const parsed = validateAndParseJsonLd(valid);
    expect(parsed).toBeDefined();
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("Product");
  });

  it("should fail gracefully and return null for invalid JSON", () => {
    const invalid = '{"@type": "Product", "name": "Shearling Co."'; // Missing closing brace
    expect(validateAndParseJsonLd(invalid)).toBeNull();
  });
});

describe("SEO - Centralized Metadata Resolver", () => {
  it("should compile products with correct metadata and canonical fallback", () => {
    const mockProduct = {
      name: "Handcrafted Shearling Coat",
      shortDescription: "Luxurious handcrafted shearling coat.",
      slug: "handcrafted-shearling-coat",
      price: 1200,
      stock: 5,
      seo: {
        title: "Buy Handcrafted Shearling Coat Online | Pairo",
        description: "Custom SEO description override.",
        noIndex: false,
        noFollow: true
      }
    };

    const { metadata, structuredData } = resolveSEOMetadata({
      entity: mockProduct,
      type: "product",
      path: "/product/handcrafted-shearling-coat"
    });

    expect(metadata.title).toBe("Buy Handcrafted Shearling Coat Online | Pairo");
    expect(metadata.description).toBe("Custom SEO description override.");
    expect(metadata.alternates.canonical).toBe("https://pairolifestyle.com/product/handcrafted-shearling-coat");
    expect(metadata.robots.index).toBe(true);
    expect(metadata.robots.follow).toBe(false);
    expect(metadata.twitter.site).toBe("@pairostore");
    expect(metadata.twitter.creator).toBe("@pairostore");

    expect(structuredData).toBeDefined();
    const productSchema = structuredData["@graph"] 
      ? structuredData["@graph"].find(x => x["@type"] === "Product")
      : structuredData;
    expect(productSchema["@type"]).toBe("Product");
    expect(productSchema.offers.price).toBe(1200);
  });

  it("should fall back to global settings when entity SEO is empty", () => {
    const mockBlog = {
      title: "The Shearling Heritage",
      excerpt: "Deep dive into the craftsmanship.",
      slug: "shearling-heritage",
      createdAt: "2026-05-25T12:00:00.000Z"
    };

    const { metadata, structuredData } = resolveSEOMetadata({
      entity: mockBlog,
      type: "blog"
    });

    expect(metadata.title).toBe("The Shearling Heritage");
    expect(metadata.description).toBe("Deep dive into the craftsmanship.");
    expect(metadata.alternates.canonical).toBe("https://pairolifestyle.com/blog/shearling-heritage");

    expect(structuredData).toBeDefined();
    expect(structuredData["@type"]).toBe("BlogPosting");
    expect(structuredData.headline).toBe("The Shearling Heritage");
  });

  it("should resolve image fallback hierarchy correctly", () => {
    const mockEntity = {
      title: "Test Page",
      image: "/featured.jpg",
      images: ["/first-in-array.jpg"],
      seo: {
        ogImage: "/seo-og.jpg",
        twitterImage: "/seo-tw.jpg"
      }
    };

    // Case 1: Custom SEO images present
    const res1 = resolveSEOMetadata({
      entity: mockEntity,
      type: "page",
      fallbackImage: "/global.jpg"
    });
    expect(res1.metadata.openGraph.images[0].url).toBe("https://pairolifestyle.com/seo-og.jpg");
    expect(res1.metadata.twitter.images[0]).toBe("https://pairolifestyle.com/seo-tw.jpg");

    // Case 2: Custom SEO images missing, should fall back to entity featured image
    const mockEntityNoSeoImage = {
      title: "Test Page",
      image: "/featured.jpg",
      seo: {}
    };
    const res2 = resolveSEOMetadata({
      entity: mockEntityNoSeoImage,
      type: "page",
      fallbackImage: "/global.jpg"
    });
    expect(res2.metadata.openGraph.images[0].url).toBe("https://pairolifestyle.com/featured.jpg");
    expect(res2.metadata.twitter.images[0]).toBe("https://pairolifestyle.com/featured.jpg");

    // Case 3: All missing, should fall back to global image
    const mockEntityEmpty = {
      title: "Test Page"
    };
    const res3 = resolveSEOMetadata({
      entity: mockEntityEmpty,
      type: "page",
      fallbackImage: "/global.jpg"
    });
    expect(res3.metadata.openGraph.images[0].url).toBe("https://pairolifestyle.com/global.jpg");
    expect(res3.metadata.twitter.images[0]).toBe("https://pairolifestyle.com/global.jpg");
  });

  it("should normalize and deduplicate canonical query parameters", () => {
    expect(normalizeCanonicalUrl("https://pairolifestyle.com/shop?category=Men&color=black&size=XL&type=Jackets"))
      .toBe("https://pairolifestyle.com/shop?category=men&type=jackets");
  });

  it("should force noindex/nofollow on draft pages", () => {
    const mockBlog = {
      title: "Draft Story",
      excerpt: "Deep dive into the craftsmanship.",
      slug: "draft-story",
      status: "Draft",
      seo: {
        noIndex: false,
        noFollow: false
      }
    };

    const { metadata } = resolveSEOMetadata({
      entity: mockBlog,
      type: "blog"
    });

    expect(metadata.robots.index).toBe(false);
    expect(metadata.robots.follow).toBe(false);
    expect(metadata.robots.googleBot.index).toBe(false);
    expect(metadata.robots.googleBot.follow).toBe(false);
  });
});
