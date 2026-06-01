import React from "react";
import SectionRenderer from "@/components/common/SectionRenderer";
import { TEMPLATE_REGISTRY } from "@/lib/templates";

export default function AboutTemplate({ page, sections = [] }) {
  const allowed = TEMPLATE_REGISTRY.about.allowedSections;
  const filtered = sections.filter((s) => s && allowed.includes(s.type));

  return (
    <main className="bg-white about-template" data-template="about">
      <SectionRenderer sections={filtered} />
    </main>
  );
}
