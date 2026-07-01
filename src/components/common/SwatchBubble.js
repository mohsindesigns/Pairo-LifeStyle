// src/components/common/SwatchBubble.js
import React from "react";
import { getSwatchBackground, getSwatchClasses } from "@/lib/swatchRenderer";

/**
 * SwatchBubble – reusable UI for displaying a color / texture swatch.
 * Props:
 *  - value: the attribute value object from the product schema
 *  - selected: boolean – whether this swatch is currently selected
 *  - onClick: handler invoked when the swatch is clicked
 *  - size: optional Tailwind size (e.g. "w-9 h-9" or "w-10 h-10"). Defaults to "w-9 h-9".
 */
export default function SwatchBubble({ value, selected, onClick, size = "w-9 h-9" }) {
  const bg = getSwatchBackground(value);
  const extraClasses = getSwatchClasses(value);
  const style = {};
  if (typeof bg === 'string') {
    style.background = bg;
  } else if (typeof bg === 'object') {
    Object.assign(style, bg);
  }
  if (!style.background && !style.backgroundImage) {
    style.background = '#ccc';
  }

  const baseClasses = `relative rounded-full flex items-center justify-center transition-all duration-200 ${size} ${extraClasses}`;
  const selectedClasses = selected
    ? "ring-1 ring-offset-2 ring-primary scale-105"
    : "ring-1 ring-black/10 hover:ring-primary/30 hover:scale-105";

  return (
    <button
      type="button"
      onClick={onClick}
      title={value.label || value.value}
      className={`${baseClasses} ${selectedClasses}`}
      style={style}
    >
      {selected && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/10">
          {/* Check icon – using Lucide's Check component inline */}
          {/* We'll render a simple checkmark using SVG for portability */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="w-3 h-3 text-white"
            strokeWidth={3}
            fill="none"
            stroke="currentColor"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}
    </button>
  );
}
