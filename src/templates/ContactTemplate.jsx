import React from "react";
import SectionRenderer from "@/components/common/SectionRenderer";
import { TEMPLATE_REGISTRY } from "@/lib/templates";

export default function ContactTemplate({ page, sections = [] }) {
  const allowed = TEMPLATE_REGISTRY.contact.allowedSections;
  const filtered = sections.filter((s) => s && allowed.includes(s.type));

  return (
    <main className="bg-white min-h-screen contact-template" data-template="contact">
      <SectionRenderer sections={filtered} />
    </main>
  );
}
