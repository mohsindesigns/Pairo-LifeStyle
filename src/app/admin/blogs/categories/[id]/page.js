"use client";
import { useParams } from "next/navigation";
import CategoryForm from "@/components/admin/CategoryForm";
import RequirePermission from "@/components/admin/RequirePermission";

export default function EditBlogCategory() {
  const params = useParams();
  // The categories API saves blog categories under the products.* permissions
  return (
    <RequirePermission permission="products.edit">
      <CategoryForm categoryId={params.id} type="blog" />
    </RequirePermission>
  );
}
