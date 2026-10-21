import React from "react";
import SectionRenderer from "@/components/common/SectionRenderer";
import { TEMPLATE_REGISTRY } from "@/lib/templates";

export default function CorporateGiftingTemplate({ page, sections = [] }) {
  const allowed = TEMPLATE_REGISTRY["corporate-gifting"].allowedSections;
  const filtered = sections.filter((s) => s && allowed.includes(s.type));

  return (
    <main className="bg-background corporate-gifting-template" data-template="corporate-gifting">
      <SectionRenderer sections={filtered} />
    </main>
  );
}
