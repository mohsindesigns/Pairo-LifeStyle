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
//   canDestroy(doc, ctx) optional; return a string reason to block permanent delete for that row.
//                ctx = { userId, roleSlug } of the signed-in staff member.
//   group        one of TRASH_GROUPS' keys; tabs are shown grouped (rows on desktop, a select on phones)
//   href         the module's own admin screen (linked from the tab)
//
// Adding a module later = append one entry (see the template at the bottom of this file).

import { staffPermanentDeleteError } from "@/app/api/admin/staff/helpers";
import { roleRemovalError } from "@/app/api/admin/roles/helpers";
import { blockersMessage } from "@/app/api/admin/affiliates/list/trash-utils";

const enc = encodeURIComponent;

/** Tab groups, in display order. */
export const TRASH_GROUPS = [
  { key: "catalog", label: "Catalog" },
  { key: "sales", label: "Sales" },
  { key: "content", label: "Content" },
  { key: "inbox", label: "Inbox" },
  { key: "people", label: "People" },
];

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
const clip = (text, n = 90) => {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const fullName = (...parts) => parts.filter(Boolean).join(" ").trim();
const ORDER_MANAGE = ["orders.update", "orders.edit", "orders.delete"];

export const TRASH_MODULES = [
  // ── Catalog ─────────────────────────────────────────────────────────────────
  {
    key: "products",
    label: "Products",
    noun: "product",
    group: "catalog",
    href: "/admin/products",
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
    group: "catalog",
    href: "/admin/categories",
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
    key: "size-charts",
    label: "Size charts",
    noun: "size chart",
    group: "catalog",
    href: "/admin/products/size-charts",
    permissions: { view: "products.view", restore: "products.edit", delete: "products.delete" },
    load: simpleList("/api/admin/size-charts?trash=true"),
    // Restore also puts back the category/product assignments the trash cleared.
    restore: (d) => ({ url: `/api/admin/size-charts/${enc(d._id)}`, method: "PATCH", body: { isDeleted: false } }),
    destroy: (d) => ({ url: `/api/admin/size-charts/${enc(d._id)}?mode=permanent`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.label || "(no label)",
      subtitle: d.publicHeading || "",
      details: [d.status, Array.isArray(d.rows) ? plural(d.rows.length, "row") : ""].filter(Boolean).join(" · "),
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "size-chart-items",
    label: "Size chart images",
    noun: "size chart image",
    group: "catalog",
    href: "/admin/size-chart-items",
    // The API guards every call (list included) with products.edit.
    permissions: { view: "products.edit", restore: "products.edit", delete: "products.edit" },
    load: simpleList("/api/admin/size-chart-items?trash=true"),
    restore: (d) => ({ url: `/api/admin/size-chart-items/${enc(d._id)}`, method: "PATCH", body: { isDeleted: false } }),
    destroy: (d) => ({ url: `/api/admin/size-chart-items/${enc(d._id)}?mode=permanent`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.title || "(no title)",
      subtitle: clip(d.description, 80),
      details: d.enabledBeforeTrash === false ? "Restores as Hidden" : "Restores as Visible",
      thumb: d.image || null,
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "product-questions",
    label: "Product questions",
    noun: "question",
    group: "catalog",
    href: "/admin/product-questions",
    permissions: {
      view: ["products.view", "reviews.view"],
      restore: ["products.edit", "reviews.moderate"],
      delete: ["products.delete", "reviews.delete"],
    },
    load: pagedList(
      (p) => `/api/admin/products/questions?status=Trash&limit=100&page=${p}`,
      (data) => data?.questions,
      (data) => data?.pagination?.totalPages,
    ),
    restore: (d) => ({ url: `/api/admin/products/questions/${enc(d._id)}`, method: "PUT", body: { action: "restore" } }),
    destroy: (d) => ({ url: `/api/admin/products/questions/${enc(d._id)}?permanent=true`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: clip(d.question) || "(no question)",
      subtitle: [d.customerName, d.customerEmail].filter(Boolean).join(" · "),
      details: d.productId?.name ? `On ${d.productId.name}` : d.status || "",
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "reviews",
    label: "Reviews",
    noun: "review",
    group: "catalog",
    href: "/admin/reviews",
    permissions: { view: "reviews.view", restore: "reviews.moderate", delete: "reviews.moderate" },
    load: pagedList(
      (p) => `/api/admin/reviews?status=Trash&limit=100&page=${p}`,
      (data) => data?.reviews,
      (data) => data?.pagination?.totalPages,
    ),
    // Restored reviews go back to Pending for moderation (the API's rule).
    restore: (d) => ({ url: `/api/admin/reviews/${enc(d._id)}`, method: "PUT", body: { restore: true } }),
    // DELETE on a review that is already in the Trash deletes it permanently.
    destroy: (d) => ({ url: `/api/admin/reviews/${enc(d._id)}?mode=permanent`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: clip(d.title || d.comment) || "(no text)",
      subtitle: [d.customerName, d.rating ? `${d.rating}★` : ""].filter(Boolean).join(" · "),
      details: d.productId?.name ? `On ${d.productId.name} · restores as Pending` : "Restores as Pending",
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },

  // ── Sales ───────────────────────────────────────────────────────────────────
  {
    key: "orders",
    label: "Orders",
    noun: "order",
    group: "sales",
    href: "/admin/orders",
    permissions: { view: "orders.view", restore: ORDER_MANAGE, delete: ORDER_MANAGE },
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
    key: "abandoned-carts",
    label: "Abandoned carts",
    noun: "abandoned cart",
    group: "sales",
    href: "/admin/abandoned-carts",
    permissions: { view: "orders.view", restore: ORDER_MANAGE, delete: ORDER_MANAGE },
    load: pagedList(
      (p) => `/api/admin/abandoned-carts?status=trash&limit=100&page=${p}`,
      (data) => data?.items,
      (data) => data?.pagination?.pages,
    ),
    restore: (d) => ({ url: "/api/admin/abandoned-carts", method: "PUT", body: { id: d._id, isDeleted: false } }),
    destroy: (d) => ({ url: `/api/admin/abandoned-carts?id=${enc(d._id)}&permanent=true`, method: "DELETE" }),
    item: (d) => {
      const c = d.contact || {};
      const count = Array.isArray(d.items) ? d.items.reduce((n, i) => n + (Number(i.quantity) || 1), 0) : 0;
      return {
        id: d._id,
        title: fullName(c.firstName, c.lastName) || c.email || "Guest cart",
        subtitle: c.email && fullName(c.firstName, c.lastName) ? c.email : "",
        details: `${money(d.cartTotal ?? d.cartSubtotal)} · ${plural(count, "item")}`,
        trashedAt: d.deletedAt || d.updatedAt,
      };
    },
  },
  {
    key: "size-confirmations",
    label: "Size confirmations",
    noun: "size confirmation",
    group: "sales",
    href: "/admin/size-confirmations",
    permissions: { view: "orders.view", restore: "orders.update", delete: "orders.update" },
    load: pagedList(
      (p) => `/api/admin/size-confirmations?status=trash&limit=100&page=${p}`,
      (data) => data?.confirmations,
      (data) => data?.pagination?.pages,
    ),
    restore: (d) => ({ url: `/api/admin/size-confirmations/${enc(d._id)}`, method: "PATCH", body: { action: "restore" } }),
    destroy: (d) => ({ url: `/api/admin/size-confirmations/${enc(d._id)}?permanent=true`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: `${d.orderNumber ? `#${d.orderNumber} ` : ""}${d.customerName || d.customerEmail || ""}`.trim() || "(no order)",
      subtitle: d.customerName ? d.customerEmail || "" : "",
      details: d.status === "Confirmed" && d.confirmedSize ? `Confirmed: ${d.confirmedSize}` : d.status || "",
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "coupons",
    label: "Coupons",
    noun: "coupon",
    group: "sales",
    href: "/admin/discounts",
    permissions: { view: "promotions.view", restore: "promotions.manage", delete: "promotions.manage" },
    load: simpleList("/api/admin/discounts?status=Trash", (data) => data?.discounts),
    restore: (d) => ({ url: `/api/admin/discounts?id=${enc(d._id)}`, method: "PUT", body: { restore: true } }),
    destroy: (d) => ({ url: `/api/admin/discounts?id=${enc(d._id)}&permanent=1`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.code || "(no code)",
      subtitle: d.type === "percentage" ? `${Number(d.value) || 0}% off` : d.type === "fixed" ? `${money(d.value)} off` : d.type || "",
      details: `Used ${d.usageCount || 0}${d.usageLimit ? ` of ${d.usageLimit}` : ""}`,
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "promotions",
    label: "Promotions",
    noun: "promotion",
    group: "sales",
    href: "/admin/promotions",
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

  // ── Content ─────────────────────────────────────────────────────────────────
  {
    key: "pages",
    label: "Pages",
    noun: "page",
    group: "content",
    href: "/admin/pages",
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
    group: "content",
    href: "/admin/blogs",
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
    key: "gallery-items",
    label: "Gallery items",
    noun: "gallery item",
    group: "content",
    href: "/admin/gallery-items",
    // The API guards every call (list included) with pages.edit.
    permissions: { view: "pages.edit", restore: "pages.edit", delete: "pages.edit" },
    load: simpleList("/api/admin/gallery-items?view=trash"),
    restore: (d) => ({ url: `/api/admin/gallery-items/${enc(d._id)}`, method: "PATCH", body: { restore: true } }),
    destroy: (d) => ({ url: `/api/admin/gallery-items/${enc(d._id)}?permanent=true`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.title || "(no title)",
      subtitle: d.linkedProduct?.name ? `Links to ${d.linkedProduct.name}` : clip(d.description, 80),
      details: d.enabledBeforeTrash === false ? "Restores as Hidden" : "Restores as Visible",
      thumb: d.image || null,
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "media",
    label: "Media",
    noun: "file",
    group: "content",
    href: "/admin/media",
    permissions: { view: "media.manage", restore: "media.manage", delete: "media.manage" },
    load: pagedList(
      (p) => `/api/admin/media?trash=true&limit=100&page=${p}`,
      (data) => data?.items,
      (data) => data?.pagination?.pages,
    ),
    restore: (d) => ({ url: `/api/admin/media/${enc(d._id)}`, method: "PATCH", body: { restore: true } }),
    // Permanent delete also removes the stored file and clears references to it.
    destroy: (d) => ({ url: `/api/admin/media/${enc(d._id)}?permanent=true`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.title || d.originalName || d.filename || "(no name)",
      subtitle: d.originalName && d.originalName !== d.title ? d.originalName : d.filename && d.filename !== d.title ? d.filename : "",
      details: [d.mediaType, d.fileSize ? `${Math.max(1, Math.round(d.fileSize / 1024))} KB` : "", d.usageCount ? `Used ${d.usageCount}×` : ""].filter(Boolean).join(" · "),
      thumb: d.mediaType === "image" || !d.mediaType ? d.thumbnailUrl || d.url || null : null,
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "scripts",
    label: "Scripts",
    noun: "script",
    group: "content",
    href: "/admin/settings/scripts",
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

  // ── Inbox ───────────────────────────────────────────────────────────────────
  {
    key: "submissions",
    label: "Contact submissions",
    noun: "submission",
    group: "inbox",
    href: "/admin/contact",
    permissions: { view: "submissions.view", restore: "submissions.delete", delete: "submissions.delete" },
    load: pagedList(
      (p) => `/api/admin/submissions?status=trash&limit=100&page=${p}`,
      (data) => data?.items,
      (data) => data?.pagination?.pages,
    ),
    // Restore only exists as a bulk action; it answers { processed, failed }.
    restore: (d) => ({ url: "/api/admin/submissions", method: "POST", body: { ids: [d._id], action: "restore" } }),
    destroy: (d) => ({ url: `/api/admin/submissions/${enc(d._id)}`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: clip(d.subject, 80) || d.name || d.email || "(no subject)",
      subtitle: [d.name, d.email].filter(Boolean).join(" · "),
      details: d.sourceForm || d.status || "",
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "corporate-gifting",
    label: "Corporate gifting",
    noun: "corporate gifting inquiry",
    group: "inbox",
    href: "/admin/corporate-gifting-inquiries",
    permissions: { view: "submissions.view", restore: "submissions.delete", delete: "submissions.delete" },
    load: pagedList(
      (p) => `/api/admin/corporate-gifting-inquiries?status=trash&limit=100&page=${p}`,
      (data) => data?.items,
      (data) => data?.pagination?.pages,
    ),
    restore: (d) => ({ url: `/api/admin/corporate-gifting-inquiries/${enc(d._id)}`, method: "PATCH", body: { isDeleted: false } }),
    destroy: (d) => ({ url: `/api/admin/corporate-gifting-inquiries/${enc(d._id)}?permanent=true`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: d.company || d.contactName || d.email || "(no name)",
      subtitle: [d.company ? d.contactName : "", d.email].filter(Boolean).join(" · "),
      details: [d.occasion, d.quantity ? `Qty ${d.quantity}` : ""].filter(Boolean).join(" · ") || d.status || "",
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "custom-jacket-inquiries",
    label: "Custom jacket inquiries",
    noun: "custom jacket inquiry",
    group: "inbox",
    href: "/admin/custom-jacket-inquiries",
    permissions: { view: "submissions.view", restore: "submissions.delete", delete: "submissions.delete" },
    load: pagedList(
      (p) => `/api/admin/custom-jacket-inquiries?status=trash&limit=100&page=${p}`,
      (data) => data?.items,
      (data) => data?.pagination?.pages,
    ),
    restore: (d) => ({ url: `/api/admin/custom-jacket-inquiries/${enc(d._id)}`, method: "PATCH", body: { isDeleted: false } }),
    destroy: (d) => ({ url: `/api/admin/custom-jacket-inquiries/${enc(d._id)}?permanent=true`, method: "DELETE" }),
    item: (d) => ({
      id: d._id,
      title: fullName(d.firstName, d.lastName) || d.email || "(no name)",
      subtitle: fullName(d.firstName, d.lastName) ? d.email || "" : "",
      details: [d.jacketType, d.orderId ? "Converted to order" : d.status].filter(Boolean).join(" · "),
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },

  // ── People ──────────────────────────────────────────────────────────────────
  {
    key: "customers",
    label: "Customers",
    noun: "customer",
    group: "people",
    href: "/admin/customers",
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
    key: "affiliates",
    label: "Affiliates",
    noun: "affiliate",
    group: "people",
    href: "/admin/affiliates",
    permissions: { view: "affiliates.view", restore: "affiliates.manage", delete: "affiliates.manage" },
    load: simpleList("/api/admin/affiliates/list?includeTrashed=1", (data) => data?.trashed),
    restore: (d) => ({ url: "/api/admin/affiliates/list", method: "PATCH", body: { affiliateId: d._id, action: "restore" } }),
    destroy: (d) => ({ url: `/api/admin/affiliates/list?id=${enc(d._id)}&permanent=1`, method: "DELETE" }),
    // Affiliates with commissions, payouts, orders or a balance stay in the Trash for the records.
    canDestroy: (d) => (Array.isArray(d.deleteBlockers) && d.deleteBlockers.length ? blockersMessage(d.deleteBlockers) : null),
    item: (d) => ({
      id: d._id,
      title: d.name || d.email || "(no name)",
      subtitle: d.email || "",
      details: d.deleteBlockers?.length ? `Kept: ${d.deleteBlockers.join(", ")}` : `Lifetime ${money(d.lifetimeEarnings)}`,
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "staff",
    label: "Team members",
    noun: "team member",
    group: "people",
    href: "/admin/settings/team",
    permissions: { view: "staff.view", restore: "staff.delete", delete: "staff.delete" },
    load: simpleList("/api/admin/staff?withTrashed=1", (data) => (Array.isArray(data) ? data.filter((s) => s.isDeleted) : [])),
    restore: (d) => ({ url: `/api/admin/staff/${enc(d._id)}`, method: "PUT", body: { isDeleted: false } }),
    destroy: (d) => ({ url: `/api/admin/staff/${enc(d._id)}?mode=permanent`, method: "DELETE" }),
    canDestroy: (d, ctx = {}) => staffPermanentDeleteError({ actorId: ctx.userId, actorRoleSlug: ctx.roleSlug, target: d }),
    item: (d) => ({
      id: d._id,
      title: d.name || d.email || "(no name)",
      subtitle: d.email || "",
      details: [d.roleId?.name, d.statusBeforeTrash ? `restores as ${d.statusBeforeTrash}` : ""].filter(Boolean).join(" · "),
      trashedAt: d.deletedAt || d.updatedAt,
    }),
  },
  {
    key: "roles",
    label: "Roles",
    noun: "role",
    group: "people",
    href: "/admin/settings/roles",
    permissions: { view: ["staff.manage_roles", "staff.view"], restore: "staff.manage_roles", delete: "staff.manage_roles" },
    load: simpleList("/api/admin/roles?withTrashed=1", (data) => (Array.isArray(data) ? data.filter((r) => r.isDeleted) : [])),
    restore: (d) => ({ url: `/api/admin/roles/${enc(d._id)}`, method: "PUT", body: { isDeleted: false } }),
    destroy: (d) => ({ url: `/api/admin/roles/${enc(d._id)}?mode=permanent`, method: "DELETE" }),
    // System roles and roles still assigned to anyone (trashed users included) can't be deleted.
    canDestroy: (d) => roleRemovalError(d, { active: d.staffCount || 0, trashed: d.trashedStaffCount || 0 }),
    item: (d) => {
      const users = (d.staffCount || 0) + (d.trashedStaffCount || 0);
      return {
        id: d._id,
        title: d.name || "(no name)",
        subtitle: clip(d.description, 80),
        details: [plural(Array.isArray(d.permissions) ? d.permissions.length : 0, "permission"), users ? plural(users, "user") : ""].filter(Boolean).join(" · "),
        trashedAt: d.deletedAt || d.updatedAt,
      };
    },
  },

  // ── Template for a new module ───────────────────────────────────────────────
  // {
  //   key: "things", label: "Things", noun: "thing", group: "content", href: "/admin/things",
  //   permissions: { view: "things.view", restore: "things.edit", delete: "things.delete" },
  //   load: simpleList("/api/admin/things?trash=1"),           // or (data) => data.items
  //   restore: (d) => ({ url: `/api/admin/things/${d._id}`, method: "PATCH", body: { action: "restore" } }),
  //   destroy: (d) => ({ url: `/api/admin/things/${d._id}?permanent=true`, method: "DELETE" }),
  //   item: (d) => ({ id: d._id, title: d.name, trashedAt: d.deletedAt }),
  // },
];

/** Visible modules bucketed by TRASH_GROUPS, empty groups dropped. */
export function groupModules(modules, groups = TRASH_GROUPS) {
  const out = groups.map((g) => ({ ...g, modules: modules.filter((m) => m.group === g.key) }));
  const known = new Set(groups.map((g) => g.key));
  const rest = modules.filter((m) => !known.has(m.group));
  if (rest.length) out.push({ key: "other", label: "Other", modules: rest });
  return out.filter((g) => g.modules.length > 0);
}

/**
 * Turns a fetch result into { ok, error }. Some bulk endpoints answer 200 with
 * { processed, failed }, so a "failed" count counts as a refusal too.
 */
export function responseResult(ok, status, data) {
  if (ok) {
    if (data && typeof data.failed === "number" && data.failed > 0 && !data.processed) {
      return { ok: false, error: data.error || "It is no longer in the Trash" };
    }
    return { ok: true };
  }
  return { ok: false, error: data?.error || `HTTP ${status}` };
}

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

/** "3 restored, 1 failed" (or "2 deleted, 1 skipped") style summary for bulk runs. */
export function summarize(verb, ok, failed, failedWord = "failed") {
  const parts = [];
  if (ok) parts.push(`${ok} ${verb}`);
  if (failed) parts.push(`${failed} ${failedWord}`);
  return parts.join(", ") || "Nothing to do";
}
