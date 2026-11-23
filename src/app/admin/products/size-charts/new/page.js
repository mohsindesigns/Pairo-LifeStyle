"use client";

import React from "react";
import Link from "next/link";
import SizeChartForm from "@/components/admin/SizeChartForm";
import { Page, PageHeader } from "@/components/admin/ui";

export default function NewSizeChartPage() {
  return (
    <Page>
      <PageHeader
        title="Add New Size Chart"
        aside={<Link href="/admin/products/size-charts" className="wp-link">← Size Charts</Link>}
      />
      <p className="wp-desc" style={{ marginTop: 0, marginBottom: 12 }}>Configure a master size chart and assign it to categories or products.</p>
      <SizeChartForm />
    </Page>
  );
}
