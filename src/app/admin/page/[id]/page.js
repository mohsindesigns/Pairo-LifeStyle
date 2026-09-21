"use client";

import PageForm from "@/components/admin/PageForm";
import { useParams } from "next/navigation";

export default function EditPageSingularRoutePage({ params: propParams }) {
  const routeParams = useParams();
  const id = routeParams?.id || propParams?.id;
  return <PageForm pageId={id} />;
}
