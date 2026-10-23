"use client";

import ProductForm from "@/components/admin/ProductForm";
import { useParams } from "next/navigation";
import RequirePermission from "@/components/admin/RequirePermission";

export default function EditProductSingularRoutePage({ params: propParams }) {
  const routeParams = useParams();
  const id = routeParams?.id || propParams?.id;
  return (
    <RequirePermission permission="products.view">
      <ProductForm productId={id} />
    </RequirePermission>
  );
}
