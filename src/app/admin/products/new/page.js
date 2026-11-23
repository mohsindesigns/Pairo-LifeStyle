"use client";

import ProductForm from "@/components/admin/ProductForm";
import RequirePermission from "@/components/admin/RequirePermission";

export default function NewProductPage() {
  return (
    <RequirePermission permission="products.create">
      <ProductForm />
    </RequirePermission>
  );
}
