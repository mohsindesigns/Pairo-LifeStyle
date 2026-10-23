import { describe, it, expect } from "vitest";
import {
  TRASH_MODULES, TRASH_GROUPS, allowed, visibleModules, groupModules, filterItems, paginate, summarize,
  simpleList, pagedList, responseResult,
} from "@/app/admin/trash/trashModules";

const doc = { _id: "abc123", name: "N", title: "T", isSystem: false };

describe("trash module config", () => {
  it("every entry has the required shape", () => {
    const keys = new Set();
    for (const m of TRASH_MODULES) {
      expect(typeof m.key).toBe("string");
      expect(keys.has(m.key)).toBe(false);
      keys.add(m.key);
      expect(m.label && m.noun).toBeTruthy();
      for (const p of ["view", "restore", "delete"]) expect(m.permissions[p]).toBeTruthy();
      expect(typeof m.load).toBe("function");
      const r = m.restore(doc);
      const d = m.destroy(doc);
      expect(r.url).toMatch(/^\/api\/admin\//);
      expect(["PUT", "PATCH", "POST"]).toContain(r.method);
      expect(d.method).toBe("DELETE");
      expect(d.url).toMatch(/^\/api\/admin\//);
      const it = m.item(doc);
      expect(it.id).toBe("abc123");
      expect(typeof it.title).toBe("string");
      expect(TRASH_GROUPS.map((g) => g.key)).toContain(m.group);
      expect(m.href).toMatch(/^\/admin\//);
    }
  });

  it("item() copes with sparse documents", () => {
    for (const m of TRASH_MODULES) {
      const it = m.item({ _id: "x" });
      expect(it.id).toBe("x");
      expect(it.title.length).toBeGreaterThan(0);
    }
  });

  it("covers the modules whose trash API exists", () => {
    expect(TRASH_MODULES.map((m) => m.key)).toEqual(
      expect.arrayContaining([
        "products", "categories", "orders", "customers", "pages", "blogs", "promotions", "scripts",
        "size-charts", "size-chart-items", "gallery-items", "product-questions", "reviews", "media", "coupons",
        "affiliates", "staff", "roles", "submissions", "corporate-gifting", "custom-jacket-inquiries",
        "size-confirmations", "abandoned-carts",
      ]),
    );
    expect(TRASH_MODULES).toHaveLength(23);
  });

  it("new modules call their trash APIs with the right shape", () => {
    const by = Object.fromEntries(TRASH_MODULES.map((m) => [m.key, m]));
    const req = (k) => [by[k].restore(doc), by[k].destroy(doc)];
    expect(req("size-charts")).toEqual([
      { url: "/api/admin/size-charts/abc123", method: "PATCH", body: { isDeleted: false } },
      { url: "/api/admin/size-charts/abc123?mode=permanent", method: "DELETE" },
    ]);
    expect(req("size-chart-items")[1].url).toBe("/api/admin/size-chart-items/abc123?mode=permanent");
    expect(req("gallery-items")).toEqual([
      { url: "/api/admin/gallery-items/abc123", method: "PATCH", body: { restore: true } },
      { url: "/api/admin/gallery-items/abc123?permanent=true", method: "DELETE" },
    ]);
    expect(req("product-questions")[0]).toEqual({ url: "/api/admin/products/questions/abc123", method: "PUT", body: { action: "restore" } });
    expect(req("reviews")[0].body).toEqual({ restore: true });
    expect(req("media")[1].url).toBe("/api/admin/media/abc123?permanent=true");
    expect(req("coupons")).toEqual([
      { url: "/api/admin/discounts?id=abc123", method: "PUT", body: { restore: true } },
      { url: "/api/admin/discounts?id=abc123&permanent=1", method: "DELETE" },
    ]);
    expect(req("affiliates")[0].body).toEqual({ affiliateId: "abc123", action: "restore" });
    expect(req("affiliates")[1].url).toBe("/api/admin/affiliates/list?id=abc123&permanent=1");
    expect(req("staff")[1].url).toBe("/api/admin/staff/abc123?mode=permanent");
    expect(req("roles")[1].url).toBe("/api/admin/roles/abc123?mode=permanent");
    expect(req("submissions")[0]).toEqual({ url: "/api/admin/submissions", method: "POST", body: { ids: ["abc123"], action: "restore" } });
    expect(req("corporate-gifting")[1].url).toBe("/api/admin/corporate-gifting-inquiries/abc123?permanent=true");
    expect(req("custom-jacket-inquiries")[0].body).toEqual({ isDeleted: false });
    expect(req("size-confirmations")[0].body).toEqual({ action: "restore" });
    expect(req("abandoned-carts")).toEqual([
      { url: "/api/admin/abandoned-carts", method: "PUT", body: { id: "abc123", isDeleted: false } },
      { url: "/api/admin/abandoned-carts?id=abc123&permanent=true", method: "DELETE" },
    ]);
  });

  it("extra guards block permanent delete up front", () => {
    const by = Object.fromEntries(TRASH_MODULES.map((m) => [m.key, m]));
    expect(by.roles.canDestroy({ isSystem: true, isDeleted: true })).toMatch(/System roles/);
    expect(by.roles.canDestroy({ isDeleted: true, staffCount: 0, trashedStaffCount: 2 })).toMatch(/2 users/);
    expect(by.roles.canDestroy({ isDeleted: true, staffCount: 0, trashedStaffCount: 0 })).toBeNull();
    expect(by.affiliates.canDestroy({ deleteBlockers: ["3 commissions"] })).toMatch(/3 commissions/);
    expect(by.affiliates.canDestroy({ deleteBlockers: [] })).toBeNull();
    const me = { userId: "me", roleSlug: "manager" };
    expect(by.staff.canDestroy({ _id: "me", isDeleted: true }, me)).toMatch(/your own/);
    expect(by.staff.canDestroy({ _id: "x", isDeleted: true, roleId: { slug: "super-admin" } }, me)).toMatch(/Super Admin/);
    expect(by.staff.canDestroy({ _id: "x", isDeleted: true, roleId: { slug: "editor" } }, me)).toBeNull();
  });

  it("permanent-delete requests are explicit where the API supports it", () => {
    const by = Object.fromEntries(TRASH_MODULES.map((m) => [m.key, m]));
    expect(by.categories.destroy(doc).url).toContain("mode=permanent");
    expect(by.customers.destroy(doc).url).toContain("mode=permanent");
    expect(by.orders.destroy(doc).url).toContain("permanent=true");
    expect(by.pages.destroy(doc).url).toBe("/api/admin/pages/abc123?permanent=true");
    expect(by.blogs.destroy(doc).url).toContain("permanent=true");
    expect(by.promotions.destroy(doc).url).toContain("permanent=1");
    expect(by.promotions.restore(doc).body).toEqual({ adminStatus: "Draft" });
    expect(by.scripts.destroy(doc).url).toBe("/api/admin/scripts/abc123?permanent=true");
    expect(by.pages.canDestroy({ isSystem: true })).toMatch(/System/);
  });
});

describe("trash helpers", () => {
  it("allowed accepts a key or any of an array", () => {
    const can = (k) => k === "orders.update";
    expect(allowed(can, "orders.update")).toBe(true);
    expect(allowed(can, ["orders.edit", "orders.update"])).toBe(true);
    expect(allowed(can, "orders.view")).toBe(false);
    expect(allowed(can, undefined)).toBe(false);
  });

  it("visibleModules keeps only viewable tabs, in order", () => {
    const can = (k) => ["pages.view", "products.view"].includes(k);
    const keys = visibleModules(can).map((m) => m.key);
    expect(keys).toEqual(["products", "categories", "size-charts", "product-questions", "pages"]);
  });

  it("groupModules buckets in group order and drops empty groups", () => {
    const can = (k) => ["pages.view", "products.view", "staff.view"].includes(k);
    const groups = groupModules(visibleModules(can));
    expect(groups.map((g) => g.key)).toEqual(["catalog", "content", "people"]);
    expect(groups[2].modules.map((m) => m.key)).toEqual(["staff", "roles"]);
    expect(groupModules([{ key: "z", group: "nope" }]).map((g) => g.key)).toEqual(["other"]);
  });

  it("responseResult treats a 200 with only failures as a refusal", () => {
    expect(responseResult(true, 200, { success: true })).toEqual({ ok: true });
    expect(responseResult(true, 200, { success: true, processed: 0, failed: 1 }).ok).toBe(false);
    expect(responseResult(true, 200, { success: true, processed: 1, failed: 0 }).ok).toBe(true);
    expect(responseResult(false, 409, { error: "Nope" })).toEqual({ ok: false, error: "Nope" });
    expect(responseResult(false, 500, null)).toEqual({ ok: false, error: "HTTP 500" });
  });

  it("filters and paginates", () => {
    const items = Array.from({ length: 45 }, (_, i) => ({ title: `Item ${i}`, subtitle: i === 3 ? "Special" : "" }));
    expect(filterItems(items, "special")).toHaveLength(1);
    expect(filterItems(items, "  ")).toHaveLength(45);
    const p = paginate(items, 3, 20);
    expect(p.pages).toBe(3);
    expect(p.slice).toHaveLength(5);
    expect(paginate(items, 9, 20).page).toBe(3);
    expect(paginate([], 1, 20)).toMatchObject({ pages: 1, page: 1 });
  });

  it("summarizes bulk results", () => {
    expect(summarize("restored", 3, 0)).toBe("3 restored");
    expect(summarize("restored", 2, 1)).toBe("2 restored, 1 failed");
    expect(summarize("restored", 0, 0)).toBe("Nothing to do");
    expect(summarize("deleted", 4, 2, "skipped")).toBe("4 deleted, 2 skipped");
  });

  it("simpleList / pagedList read through getJson", async () => {
    expect(await simpleList("/x", (d) => d.items)(async () => ({ items: [1, 2] }))).toEqual([1, 2]);
    expect(await simpleList("/x")(async () => ({ error: "no" }))).toEqual([]);
    const calls = [];
    const load = pagedList((p) => `/y?page=${p}`, (d) => d.rows, (d) => d.pages);
    const rows = await load(async (url) => { calls.push(url); return { rows: [url], pages: 3 }; });
    expect(calls).toEqual(["/y?page=1", "/y?page=2", "/y?page=3"]);
    expect(rows).toHaveLength(3);
  });
});
