"use client";

import React from "react";
import Link from "next/link";
import SizeChartForm from "@/components/admin/SizeChartForm";
import { useParams } from "next/navigation";
import { Page, PageHeader, Notice } from "@/components/admin/ui";

export default function EditSizeChartPage() {
  const params = useParams();
  const id = params?.id;

  return (
    <Page>
      <PageHeader
        title="Edit Size Chart"
        actions={<Link href="/admin/products/size-charts/new" className="wp-btn">Add New Size Chart</Link>}
        aside={<Link href="/admin/products/size-charts" className="wp-link">← Size Charts</Link>}
      />
      <p className="wp-desc" style={{ marginTop: 0, marginBottom: 12 }}>Modify measurements, columns, rows, or update assignment rules.</p>
      {id ? (
        <SizeChartForm initialId={id} />
      ) : (
        <Notice type="error">Invalid ID provided.</Notice>
      )}
    </Page>
  );
}
