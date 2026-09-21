"use client";

import ProductForm from "@/components/admin/ProductForm";
import { useParams } from "next/navigation";

export default function EditProductPage({ params: propParams }) {
  const routeParams = useParams();
  const id = routeParams?.id || propParams?.id;
  return <ProductForm productId={id} />;
}
