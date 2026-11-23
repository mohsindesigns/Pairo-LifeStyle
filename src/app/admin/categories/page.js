"use client";

import CategoryManager from "@/components/admin/CategoryManager";
import RequirePermission from "@/components/admin/RequirePermission";

export default function ProductCategories() {
  return (
    <RequirePermission permission="products.view">
      <CategoryManager type="product" title="Product Categories" />
    </RequirePermission>
  );
}
