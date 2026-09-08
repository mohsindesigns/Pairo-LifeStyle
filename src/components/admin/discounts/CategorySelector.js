"use client";

import React, { useState, useMemo } from "react";
import { Search, X, FolderTree, Check } from "lucide-react";

export default function CategorySelector({
  selectedIds = [],
  onChange,
  categories = [],
  loading = false,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");

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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-[13px] font-bold text-[#1d2327]">
          Applicable Categories (Optional)
        </label>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="text-[12px] font-semibold text-[#2271b1] hover:text-[#135e96] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <FolderTree className="w-3.5 h-3.5" />
          {dropdownOpen ? "Close Categories" : normalizedSelected.length === 0 ? "Choose Categories" : `Manage Categories (${normalizedSelected.length})`}
        </button>
      </div>

      {/* Selected Categories Chips */}
      {normalizedSelected.length === 0 ? (
        <div
          onClick={() => setDropdownOpen(true)}
          className="border border-dashed border-[#ccd0d4] rounded-[3px] p-2.5 text-center bg-[#fafafa] hover:bg-[#f6f7f7] cursor-pointer transition-colors"
        >
          <p className="text-[12px] text-[#646970]">
            No categories restricted. (Applies to all categories)
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 p-2 bg-[#fafafa] border border-[#ccd0d4] rounded-[3px]">
          {normalizedSelected.map((id) => {
            const cat = categoryMap.get(id);
            const name = cat?.name || `Category ID: ${id.slice(-6)}`;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-[#c3c4c7] rounded-[3px] text-[11px] font-medium text-[#1d2327]"
              >
                <span>{name}</span>
                <button
                  type="button"
                  onClick={() => removeSingle(id)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown Checklist Box */}
      {dropdownOpen && (
        <div className="border border-[#c3c4c7] rounded-[3px] bg-white shadow-md p-3 space-y-2 mt-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-[12px] border border-[#ccd0d4] rounded-[3px] outline-none focus:border-[#2271b1]"
            />
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-[3px]">
            {loading ? (
              <div className="p-3 text-center text-xs text-gray-400 italic">
                Loading categories...
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-500">
                No categories found.
              </div>
            ) : (
              filteredCategories.map((c) => {
                const sId = String(c._id);
                const isChecked = normalizedSelected.includes(sId);
                return (
                  <label
                    key={sId}
                    className={`flex items-center justify-between px-3 py-1.5 hover:bg-[#f6f7f7] cursor-pointer text-[12px] ${
                      isChecked ? "bg-[#f0f6fa] font-semibold text-[#1d2327]" : "text-[#2c3338]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCategory(sId)}
                        className="rounded-sm border-gray-300 text-[#2271b1]"
                      />
                      <span>{c.name}</span>
                    </div>
                    {isChecked && <Check className="w-3.5 h-3.5 text-[#2271b1]" />}
                  </label>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px]">
            <span className="text-gray-500">
              {normalizedSelected.length} selected
            </span>
            <button
              type="button"
              onClick={() => setDropdownOpen(false)}
              className="text-[#2271b1] font-bold hover:underline"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
