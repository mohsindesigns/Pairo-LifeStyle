"use client";

import { useState } from "react";

/** Checklist with a search box and Select all / Clear that act on the options currently shown. */
export default function MultiSelectChecklist({ options = [], value, onChange, maxHeight = 200, max }) {
  const [query, setQuery] = useState("");
  const selected = Array.isArray(value) ? value : [];
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => String(o.label).toLowerCase().includes(q)) : options;
  const isOn = (v) => selected.some((s) => String(s) === String(v));
  const shownOn = shown.filter((o) => isOn(o.value)).length;
  const allShownOn = shown.length > 0 && shownOn === shown.length;

  const toggleAll = () => {
    if (allShownOn) {
      const drop = new Set(shown.map((o) => String(o.value)));
      onChange(selected.filter((s) => !drop.has(String(s))));
      return;
    }
    const merged = [...selected, ...shown.filter((o) => !isOn(o.value)).map((o) => o.value)];
    onChange(max ? merged.slice(0, max) : merged);
  };

  const toggleOne = (opt, on) => {
    if (!on) return onChange(selected.filter((s) => String(s) !== String(opt.value)));
    if (max && selected.length >= max) return;
    onChange([...selected, opt.value]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          aria-label="Search options"
          className="flex-1 min-w-[120px] border border-[#8c8f94] px-2 py-1 text-[13px]"
        />
        <button type="button" onClick={toggleAll} disabled={shown.length === 0} className="wp-btn">
          {allShownOn ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="wp-muted mb-1">
        {selected.length} selected{max ? ` (max ${max})` : ""}
      </div>
      <div className="wp-checklist" style={{ maxHeight, overflowY: "auto" }}>
        {options.length === 0 && <span className="wp-muted">No options available</span>}
        {options.length > 0 && shown.length === 0 && <span className="wp-muted">No matches</span>}
        {shown.map((opt) => (
          <label key={opt.value} className="wp-check">
            <input type="checkbox" checked={isOn(opt.value)} onChange={(e) => toggleOne(opt, e.target.checked)} />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
