"use client";

import React from "react";

export default function RichTextSection({ title = "", content = "" }) {
  if (!content) return null;

  // Simple text parser to format layout dynamically
  const lines = content.split(/\r?\n/);
  const formattedElements = [];
  let currentList = [];

  const flushList = (key) => {
    if (currentList.length > 0) {
      formattedElements.push(
        <ul key={`list-${key}`} className="list-disc pl-6 mb-6 space-y-2 text-black text-sm md:text-base font-medium">
          {currentList.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{item}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // 1. Horizontal divider
    if (trimmed.startsWith("___") || trimmed.includes("_____")) {
      flushList(index);
      formattedElements.push(
        <hr key={`hr-${index}`} className="my-8 border-t border-black/20" />
      );
      return;
    }

    // 2. Bullet lists
    if (trimmed.startsWith("●") || trimmed.startsWith("•") || trimmed.startsWith("-")) {
      // Remove the bullet character
      const itemText = trimmed.replace(/^[●•-]\s*/, "");
      currentList.push(itemText);
      return;
    }

    // If it's not a bullet point, flush any pending list items
    flushList(index);

    if (!trimmed) {
      // Empty line
      return;
    }

    // 3. Headings: numbered sections (e.g. "1. About Pairo" or short lines that look like heading titles)
    const isHeading =
      /^\d+\.\s+/.test(trimmed) || 
      trimmed.endsWith("Window") ||
      trimmed.startsWith("What Is Eligible") ||
      trimmed.startsWith("Custom & Made-to-Order") ||
      trimmed.startsWith("How to Request") ||
      trimmed.startsWith("Refunds") ||
      trimmed.startsWith("Return Shipping Costs") ||
      trimmed.startsWith("Questions?") ||
      trimmed.startsWith("Processing & Delivery Time") ||
      trimmed.startsWith("Order Tracking") ||
      trimmed.startsWith("International Orders") ||
      trimmed.startsWith("Questions About Your Order");

    if (isHeading) {
      formattedElements.push(
        <h2 key={`h2-${index}`} className="text-[14px] sm:text-[16px] font-black uppercase tracking-wider text-black mt-10 mb-4">
          {trimmed}
        </h2>
      );
    } else {
      // 4. Regular Paragraph
      formattedElements.push(
        <p key={`p-${index}`} className="text-[12px] sm:text-[14px] leading-relaxed text-black font-medium mb-5">
          {trimmed}
        </p>
      );
    }
  });

  // Flush any list remaining at the end
  flushList("end");

  return (
    <section className="py-16 md:py-24 bg-white text-black min-h-[50vh]">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        {title && (
          <h1 className="text-[24px] sm:text-[32px] md:text-[40px] font-black tracking-tight uppercase text-black mb-12 border-b-2 border-black pb-4">
            {title}
          </h1>
        )}
        <div className="prose prose-neutral max-w-none">
          {formattedElements}
        </div>
      </div>
    </section>
  );
}
