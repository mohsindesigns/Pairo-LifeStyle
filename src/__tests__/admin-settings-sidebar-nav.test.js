import { describe, it, expect } from "vitest";
import { resolveActive } from "@/components/admin/Sidebar";

describe("admin sidebar active item", () => {
  const cases = [
    ["/admin/products", "products", "/admin/products"],
    ["/admin/products/abc123", "products", "/admin/products"],
    ["/admin/products/new", "products", "/admin/products/new"],
    ["/admin/products/size-charts/new", "products", "/admin/products/size-charts"],
    ["/admin/products/categories/new", "products", "/admin/categories"],
    ["/admin/product/abc", "products", "/admin/products"],
    ["/admin/blogs/categories/x/edit", "blog", "/admin/blogs/categories"],
    ["/admin/settings/shipping/pickup-locations", "settings", "/admin/settings/shipping"],
    ["/admin/settings/tax", "settings", "/admin/settings/tax"],
    ["/admin/settings/scripts/123", "settings", "/admin/settings/scripts"],
    ["/admin/trash", "settings", "/admin/trash"],
    ["/admin/settings/team/new", "team", "/admin/settings/team/new"],
    ["/admin/roles/new", "team", "/admin/settings/roles"],
    ["/admin/orders/123", "orders", "/admin/orders"],
    ["/admin/orders/new", "orders", "/admin/orders/new"],
    ["/admin/abandoned-carts", "orders", "/admin/abandoned-carts"],
    ["/admin/abandoned-carts/emails", "orders", "/admin/abandoned-carts/emails"],
    ["/admin/reviews", "products", "/admin/reviews"],
    ["/admin/settings/filters", "products", "/admin/settings/filters"],
    ["/admin/contact", "customers", "/admin/contact"],
    ["/admin/site-analytics/traffic", "analytics", "/admin/site-analytics"],
    ["/admin/discounts", "marketing", "/admin/discounts"],
    ["/admin/affiliates", "affiliates", "/admin/affiliates"],
    ["/admin/media", "media", "/admin/media"],
  ];
  it.each(cases)("%s -> %s / %s", (path, group, href) => {
    expect(resolveActive(path)).toMatchObject({ groupId: group, href });
  });
  it("dashboard only for /admin itself", () => {
    expect(resolveActive("/admin")).toMatchObject({ groupId: "dashboard", href: "/admin" });
    expect(resolveActive("/admin/unknown-page").groupId).toBe("");
  });
});
