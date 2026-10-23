import { describe, it, expect } from "vitest";
import {
  TRASH_MODULES, allowed, visibleModules, filterItems, paginate, summarize, simpleList, pagedList,
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
    }
  });

  it("covers the modules whose trash API exists", () => {
    expect(TRASH_MODULES.map((m) => m.key)).toEqual(
      expect.arrayContaining(["products", "categories", "orders", "customers", "pages", "blogs", "promotions", "scripts"]),
    );
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
    expect(keys).toEqual(["products", "categories", "pages"]);
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
