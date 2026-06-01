import React from "react";
import SectionRenderer from "@/components/common/SectionRenderer";
import { TEMPLATE_REGISTRY } from "@/lib/templates";

export default function DefaultTemplate({ page, sections = [] }) {
  const allowed = TEMPLATE_REGISTRY.default.allowedSections;
  const filtered = sections.filter((s) => s && allowed.includes(s.type));

  return (
    <div className="flex flex-col min-h-screen default-template" data-template="default">
      <SectionRenderer sections={filtered} />
    </div>
  );
}
