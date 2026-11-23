"use client";

import { useParams } from "next/navigation";
import CategoryForm from "@/components/admin/CategoryForm";
import RequirePermission from "@/components/admin/RequirePermission";

export default function EditBlogCategorySubRoute({ params: propParams }) {
  const routeParams = useParams();
  const id = routeParams?.id || propParams?.id;
  // The categories API saves blog categories under the products.* permissions
  return (
    <RequirePermission permission="products.edit">
      <CategoryForm categoryId={id} type="blog" />
    </RequirePermission>
  );
}
