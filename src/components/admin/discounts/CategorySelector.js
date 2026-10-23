"use client";

import React, { useState, useMemo, useId } from "react";
import { X, FolderTree } from "lucide-react";

export default function CategorySelector({
  selectedIds = [],
  onChange,
  categories = [],
  loading = false,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const uid = useId();
  const headingId = `${uid}-cats`;
  const searchId = `${uid}-cat-search`;

  const normalizedSelected = useMemo(() => {
    if (!Array.isArray(selectedIds)) return [];
    return selectedIds.map((item) =>
      typeof item === "object" && item?._id ? String(item._id) : String(item)
    );
  }, [selectedIds]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    (categories || []).forEach((c) => {
      if (c && c._id) map.set(String(c._id), c);
    });
    return map;
  }, [categories]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories || [];
    const q = search.toLowerCase().trim();
    return (categories || []).filter((c) => {
      const name = String(c.name || "").toLowerCase();
      const slug = String(c.slug || "").toLowerCase();
      return name.includes(q) || slug.includes(q);
    });
  }, [categories, search]);

  const toggleCategory = (id) => {
    const sId = String(id);
    if (normalizedSelected.includes(sId)) {
      onChange(normalizedSelected.filter((i) => i !== sId));
    } else {
      onChange([...normalizedSelected, sId]);
    }
  };

  const removeSingle = (idToRemove) => {
    const sId = String(idToRemove);
    onChange(normalizedSelected.filter((id) => id !== sId));
  };

  return (
    <div role="group" aria-labelledby={headingId} className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: 6 }}>
        <span id={headingId} className="wp-strong">
          Product categories
        </span>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen}
          className="wp-btn"
        >
          <FolderTree className="w-4 h-4" aria-hidden="true" />
          {dropdownOpen ? "Close Categories" : normalizedSelected.length === 0 ? "Choose Categories" : `Manage Categories (${normalizedSelected.length})`}
        </button>
      </div>

      {/* Selected Categories Chips */}
      {normalizedSelected.length === 0 ? (
        <button
          type="button"
          onClick={() => setDropdownOpen(true)}
          className="wp-muted w-full text-left"
          style={{ border: "1px dashed #c3c4c7", background: "#fff", padding: "10px 12px", minHeight: 40, cursor: "pointer" }}
        >
          No categories restricted. (Applies to all categories)
        </button>
      ) : (
        <div className="flex flex-wrap gap-1.5" style={{ border: "1px solid #dcdcde", background: "#fff", padding: 8 }}>
          {normalizedSelected.map((id) => {
            const cat = categoryMap.get(id);
            const name = cat?.name || `Category ID: ${id.slice(-6)}`;
            return (
              <span key={id} className="wp-chip" style={{ maxWidth: "100%" }}>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{name}</span>
                <button
                  type="button"
                  onClick={() => removeSingle(id)}
                  aria-label={`Remove ${name}`}
                  className="max-[782px]:min-h-8 max-[782px]:min-w-8 items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown Checklist Box */}
      {dropdownOpen && (
        <div style={{ marginTop: 8, border: "1px solid #c3c4c7", background: "#f6f7f7", padding: 10 }}>
          <label htmlFor={searchId} className="sr-only">Search categories</label>
          <input
            id={searchId}
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="wp-input wp-full"
            style={{ marginBottom: 8 }}
          />

          <div className="wp-checklist">
            {loading ? (
              <p className="wp-muted" style={{ margin: "6px 0" }}>
                Loading categories...
              </p>
            ) : filteredCategories.length === 0 ? (
              <p className="wp-muted" style={{ margin: "6px 0" }}>
                No categories found.
              </p>
            ) : (
              filteredCategories.map((c) => {
                const sId = String(c._id);
                const isChecked = normalizedSelected.includes(sId);
                return (
                  <label key={sId} className="wp-check max-[782px]:min-h-10">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCategory(sId)}
                    />
                    <span className={isChecked ? "wp-strong" : undefined}>{c.name}</span>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-2" style={{ marginTop: 8 }}>
            <span className="wp-muted">
              {normalizedSelected.length} selected
            </span>
            <button
              type="button"
              onClick={() => setDropdownOpen(false)}
              className="wp-btn"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
