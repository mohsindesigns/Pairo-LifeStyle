"use client";

import PageForm from "@/components/admin/PageForm";
import RequirePermission from "@/components/admin/RequirePermission";

export default function NewPage() {
  return (
    <RequirePermission permission="pages.create">
      <PageForm pageId="new" />
    </RequirePermission>
  );
}
