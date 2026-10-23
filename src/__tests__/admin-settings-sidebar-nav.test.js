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
    ["/admin/blogs/categories/x/edit", "posts", "/admin/blogs/categories"],
    ["/admin/settings/shipping/pickup-locations", "settings", "/admin/settings/shipping"],
    ["/admin/settings/tax", "settings", "/admin/settings/tax"],
    ["/admin/settings/scripts/123", "tools", "/admin/settings/scripts"],
    ["/admin/trash", "tools", "/admin/trash"],
    ["/admin/settings/team/new", "users", "/admin/settings/team/new"],
    ["/admin/roles/new", "users", "/admin/settings/roles"],
    ["/admin/orders/123", "commerce", "/admin/orders"],
    ["/admin/affiliates", "affiliates", "/admin/affiliates"],
    ["/admin/media", "media", "/admin/media"],
  ];
  it.each(cases)("%s -> %s / %s", (path, group, href) => {
    expect(resolveActive(path)).toMatchObject({ groupId: group, href });
  });
  it("nothing for the dashboard", () => {
    expect(resolveActive("/admin").groupId).toBe("");
  });
});
