import React from "react";
import SectionRenderer from "@/components/common/SectionRenderer";
import { TEMPLATE_REGISTRY } from "@/lib/templates";

export default function HomeTemplate({ page, sections = [] }) {
  const allowed = TEMPLATE_REGISTRY.home.allowedSections;
  const filtered = sections.filter((s) => s && allowed.includes(s.type));

  return (
    <div className="flex flex-col min-h-screen homepage-template" data-template="home">
      <SectionRenderer sections={filtered} />
    </div>
  );
}
