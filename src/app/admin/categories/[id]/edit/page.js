"use client";

import { useParams } from "next/navigation";
import CategoryForm from "@/components/admin/CategoryForm";

export default function EditCategorySubRoutePage({ params: propParams }) {
  const routeParams = useParams();
  const id = routeParams?.id || propParams?.id;
  return <CategoryForm categoryId={id} type="product" />;
}
