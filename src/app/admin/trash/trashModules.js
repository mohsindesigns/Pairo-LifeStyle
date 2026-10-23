// Config for the global Trash screen (src/app/admin/trash/page.js).
//
// Every module that supports soft delete is ONE entry in TRASH_MODULES. The page renders a tab
// per entry the signed-in staff member may view, loads its trashed items, and wires Restore /
// Delete permanently / bulk / Empty trash through the entry's request builders.
//
// Entry shape:
//   key          unique tab key (also used in ?tab=)
//   label        tab label, plural ("Size charts")
//   noun         singular noun for messages ("size chart")
//   permissions  { view, restore, delete } — each a "module.action" key or an array of keys
//                (any one is enough). Tab is hidden without `view`; the actions without theirs.
//   load(getJson) async; returns the raw trashed documents. getJson(url) resolves to parsed JSON
//                and throws on a non-2xx response. Use `simpleList(url, pick?)` for one request.
//   restore(doc)  -> { url, method, body? }   request that brings the item back
//   destroy(doc)  -> { url, method }          request that deletes a TRASHED item permanently
//   item(doc)     -> { id, title, subtitle?, details?, thumb?, trashedAt?, editHref? }
//   canDestroy(doc) optional; return a string reason to block permanent delete for that row.
//
// Adding a module later = append one entry (see the template at the bottom of this file).

const enc = encodeURIComponent;

/** One GET that returns the trashed docs (optionally picked out of a wrapper object). */
export function simpleList(url, pick = (data) => data) {
  return async (getJson) => {
    const data = await getJson(url);
    const list = pick(data);
    return Array.isArray(list) ? list : [];
  };
}

/** Follows ?page=1..N for APIs that paginate their trash view. */
export function pagedList(urlForPage, pick, pagesOf, maxPages = 50) {
  return async (getJson) => {
    const first = await getJson(urlForPage(1));
    const out = [...(pick(first) || [])];
    const pages = Math.min(Number(pagesOf(first)) || 1, maxPages);
    for (let p = 2; p <= pages; p++) {
      out.push(...(pick(await getJson(urlForPage(p))) || []));
    }
    return out;
  };
}

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const firstImage = (doc) => doc.image || doc.images?.[0] || doc.featuredImage || null;

export const TRASH_MODULES = [
  {
    key: "products",
    label: "Products",
    noun: "product",
    permissions: { view: "products.view", restore: "products.edit", delete: "products.delete" },
    load: simpleList("/api/admin/products?isDeleted=true"),
    restore: (d) => ({ url: "/api/admin/products", method: "PUT", body: { id: d._id, isDeleted: false } }),
    destroy: (d) => ({ url: `/api/admin/products/${enc(d._id)}`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.name || "(no name)",
      subtitle: d.sku ? `SKU: ${d.sku}` : "",
      details: money(d.price),
      thumb: firstImage(d),
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "categories",
    label: "Categories",
    noun: "category",
    permissions: { view: ["products.view", "blogs.view"], restore: "products.edit", delete: "products.delete" },
    // Product and blog categories live in one collection but the API lists them per type.
    load: async (getJson) => {
      const [product, blog] = await Promise.all([
        getJson("/api/admin/categories?trash=true&type=product"),
        getJson("/api/admin/categories?trash=true&type=blog").catch(() => []),
      ]);
      return [...(Array.isArray(product) ? product : []), ...(Array.isArray(blog) ? blog : [])];
    },
    restore: (d) => ({ url: "/api/admin/categories", method: "PUT", body: { id: d._id, isDeleted: false } }),
    destroy: (d) => ({ url: `/api/admin/categories?id=${enc(d._id)}&mode=permanent`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.name || "(no name)",
      subtitle: d.slug ? `/${d.slug}` : "",
      details: d.type === "blog" ? "Blog category" : "Product category",
      thumb: d.image || null,
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "orders",
    label: "Orders",
    noun: "order",
    permissions: {
      view: "orders.view",
      restore: ["orders.update", "orders.edit", "orders.delete"],
      delete: ["orders.update", "orders.edit", "orders.delete"],
    },
    load: pagedList(
      (p) => `/api/admin/orders?trash=true&limit=100&page=${p}`,
      (data) => data?.orders,
      (data) => data?.pagination?.pages,
    ),
    restore: (d) => ({ url: "/api/admin/orders", method: "PUT", body: { id: d._id, isDeleted: false } }),
    destroy: (d) => ({ url: `/api/admin/orders?id=${enc(d._id)}&permanent=true`, method: "DELETE" }),
    item: (d) => {
      const who = d.shippingAddress?.fullName || d.customer?.name || d.customer?.email || "";
      return {
        id: d._id,
        title: `#${d.orderNumber || String(d._id).slice(-6)}${who ? ` ${who}` : ""}`,
        subtitle: d.status || "",
        details: money(d.financials?.total),
        trashedAt: d.deletedAt || d.updatedAt,
      };
    },
  },
  {
    key: "customers",
    label: "Customers",
    noun: "customer",
    permissions: { view: "customers.view", restore: "customers.delete", delete: "customers.delete" },
    load: pagedList(
      (p) => `/api/admin/customers?filter=trash&page=${p}`,
      (data) => data?.customers,
      (data) => data?.pages,
    ),
    restore: (d) => ({ url: "/api/admin/customers", method: "PUT", body: { id: d._id, isDeleted: false } }),
    destroy: (d) => ({ url: `/api/admin/customers?id=${enc(d._id)}&mode=permanent`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.name || d.email || "(no name)",
      subtitle: d.email || "",
      details: `${d.orderCount || 0} order${d.orderCount === 1 ? "" : "s"}`,
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "pages",
    label: "Pages",
    noun: "page",
    permissions: { view: "pages.view", restore: "pages.edit", delete: "pages.delete" },
    load: simpleList("/api/admin/pages?trash=1"),
    restore: (d) => ({ url: `/api/admin/pages/${enc(d._id)}`, method: "PATCH", body: { action: "restore" } }),
    destroy: (d) => ({ url: `/api/admin/pages/${enc(d._id)}?permanent=true`, method: "DELETE" }),
    canDestroy: (d) => (d.isSystem ? "System pages cannot be deleted" : null),
    item: (d) => ({
      id: d._id,
      title: d.title || "(no title)",
      subtitle: d.slug ? `/${d.slug}` : "",
      details: d.template ? `Template: ${d.template}` : "",
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "blogs",
    label: "Posts",
    noun: "post",
    permissions: { view: "blogs.view", restore: "blogs.edit", delete: "blogs.delete" },
    load: simpleList("/api/admin/blogs?isDeleted=true"),
    restore: (d) => ({ url: "/api/admin/blogs", method: "PUT", body: { id: d._id, isDeleted: false, deletedAt: null } }),
    destroy: (d) => ({ url: `/api/admin/blogs?id=${enc(d._id)}&permanent=true`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.title || "(no title)",
      subtitle: d.author ? `By ${d.author}` : "",
      details: d.status || "",
      thumb: d.image || null,
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "promotions",
    label: "Promotions",
    noun: "promotion",
    permissions: { view: "promotions.view", restore: "promotions.manage", delete: "promotions.manage" },
    // Promotions are "trashed" by archiving them. Restore brings them back as a Draft so
    // nothing goes live by accident (same as the Promotions screen).
    load: simpleList("/api/admin/promotions?status=Archived"),
    restore: (d) => ({ url: `/api/admin/promotions/${enc(d._id)}`, method: "PATCH", body: { adminStatus: "Draft" } }),
    destroy: (d) => ({ url: `/api/admin/promotions/${enc(d._id)}?permanent=1`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.title || "(no title)",
      subtitle: d.code ? `Code: ${d.code}` : d.isAutomatic ? "Automatic" : "",
      details: "Restores as Draft",
      trashedAt: d.updatedAt,
    }),
  },
  {
    key: "scripts",
    label: "Scripts",
    noun: "script",
    permissions: { view: "scripts.view", restore: "scripts.edit", delete: "scripts.delete" },
    load: simpleList("/api/admin/scripts?trash=1"),
    restore: (d) => ({ url: `/api/admin/scripts/${enc(d._id)}`, method: "PATCH", body: { action: "restore" } }),
    destroy: (d) => ({ url: `/api/admin/scripts/${enc(d._id)}?permanent=true`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.name || "(no name)",
      subtitle: [d.type, d.location].filter(Boolean).join(" · ").replace(/_/g, " "),
      details: "Restores as Paused",
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },

  // ── Template for a new module ───────────────────────────────────────────────
  // {
  //   key: "size-charts", label: "Size charts", noun: "size chart",
  //   permissions: { view: "products.view", restore: "products.edit", delete: "products.delete" },
  //   load: simpleList("/api/admin/size-charts?trash=1"),           // or (data) => data.items
  //   restore: (d) => ({ url: `/api/admin/size-charts/${d._id}`, method: "PATCH", body: { action: "restore" } }),
  //   destroy: (d) => ({ url: `/api/admin/size-charts/${d._id}?permanent=true`, method: "DELETE" }),
  //   item: (d) => ({ id: d._id, title: d.name, trashedAt: d.deletedAt }),
  // },
];

/** True when `can` grants the key, or any key of an array. */
export function allowed(can, permission) {
  if (!permission) return false;
  const keys = Array.isArray(permission) ? permission : [permission];
  return keys.some((k) => can(k));
}

/** The modules this user may see, in config order. */
export function visibleModules(can, modules = TRASH_MODULES) {
  return modules.filter((m) => allowed(can, m.permissions?.view));
}

/** Case-insensitive filter over title/subtitle/details of normalized items. */
export function filterItems(items, term) {
  const q = String(term || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) =>
    [it.title, it.subtitle, it.details].some((v) => String(v || "").toLowerCase().includes(q)),
  );
}

export function paginate(items, page, perPage) {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(Math.max(1, page), pages);
  return { pages, page: current, slice: items.slice((current - 1) * perPage, current * perPage) };
}

/** "3 restored, 1 failed" style summary for bulk runs. */
export function summarize(verb, ok, failed) {
  const parts = [];
  if (ok) parts.push(`${ok} ${verb}`);
  if (failed) parts.push(`${failed} failed`);
  return parts.join(", ") || "Nothing to do";
}
