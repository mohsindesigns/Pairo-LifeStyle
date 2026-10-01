"use client";

import CategoryManager from "@/components/admin/CategoryManager";
import RequirePermission from "@/components/admin/RequirePermission";

export default function BlogCategories() {
  return (
    <RequirePermission permission="blogs.view">
      <CategoryManager type="blog" title="Blog Categories" />
    </RequirePermission>
  );
}
