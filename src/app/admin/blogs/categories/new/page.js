import CategoryForm from "@/components/admin/CategoryForm";
import RequirePermission from "@/components/admin/RequirePermission";

// The categories API saves blog categories under the products.* permissions
export default function NewBlogCategory() {
  return (
    <RequirePermission permission="products.create">
      <CategoryForm type="blog" />
    </RequirePermission>
  );
}
