"use client";

import PageForm from "@/components/admin/PageForm";
import { useParams } from "next/navigation";
import RequirePermission from "@/components/admin/RequirePermission";

export default function EditPageSubRoutePage({ params: propParams }) {
  const routeParams = useParams();
  const id = routeParams?.id || propParams?.id;
  return (
    <RequirePermission permission="pages.edit">
      <PageForm pageId={id} />
    </RequirePermission>
  );
}
