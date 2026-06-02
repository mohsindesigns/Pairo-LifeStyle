"use client";

/**
 * SectionRenderer.js
 * 
 * The core rendering engine for dynamic pages.
 * 
 * Important: 
 * All section components should now follow the "Spread Prop Pattern".
 * Instead of receiving a 'config' object, they receive their configuration 
 * fields as top-level props (e.g., { title, description, image }).
 */
import React from "react";
import { getSectionComponent } from "@/lib/section-registry";
import SectionErrorBoundary from "@/components/common/SectionErrorBoundary";
import Reveal from "@/components/common/Reveal";

const SectionWrapper = ({ section, isFirst, children }) => {
  const { overrides = {} } = section;
  // Force removal of the old default culprit if it exists in the DB
  let padding = overrides.padding || "py-0";
  if (padding === "py-12 md:py-20") padding = "py-0";
  
  const background = overrides.background || "transparent";
  const customClasses = overrides.customClasses || "";

  const content = (
    <SectionErrorBoundary>
      {children}
    </SectionErrorBoundary>
  );

  return (
    <div 
      className={`${padding} ${customClasses}`} 
      style={{ backgroundColor: background }}
      data-section-id={section.id}
      data-section-type={section.type}
    >
      {isFirst ? content : <Reveal>{content}</Reveal>}
    </div>
  );
};

export default function SectionRenderer({ sections = [] }) {
  if (!sections || !Array.isArray(sections) || sections.length === 0) return null;

  return (
    <>
      {sections
        .filter((s) => s && s.enabled)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((section, index) => {
          if (!section.type) return null;
          
          const Component = getSectionComponent(section.type);
          if (!Component) {
            console.error(`CRITICAL: Section type "${section.type}" not found in registry.`);
            return process.env.NODE_ENV === 'development' ? (
              <div key={section.id} className="p-10 border border-dashed border-orange-300 bg-orange-50 text-orange-700 m-4 rounded-xl">
                Missing Component: <strong>{section.type}</strong>
              </div>
            ) : null;
          }

          return (
            <SectionWrapper key={section.id} section={section} isFirst={index === 0}>
              <Component {...(section.config || {})} sectionId={section.id} />
            </SectionWrapper>
          );
        })}
    </>
  );
}
