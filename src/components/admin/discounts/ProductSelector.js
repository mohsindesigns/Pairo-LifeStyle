"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, X, Check, Package, CheckSquare, Square, ChevronRight } from "lucide-react";

export default function ProductSelector({
  selectedIds = [],
  onChange,
  products = [],
  loading = false,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localSelected, setLocalSelected] = useState([]);

  // Normalize selected IDs to string IDs
  const normalizedSelected = useMemo(() => {
    if (!Array.isArray(selectedIds)) return [];
    return selectedIds.map((item) =>
      typeof item === "object" && item?._id ? String(item._id) : String(item)
    );
  }, [selectedIds]);

  const openModal = () => {
    setLocalSelected([...normalizedSelected]);
    setSearch("");
    setModalOpen(true);
  };

  // Map of products for instant lookup
  const productMap = useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      if (p && p._id) map.set(String(p._id), p);
    });
    return map;
  }, [products]);

  // Filtered products inside modal
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products || [];
    const q = search.toLowerCase().trim();
    return (products || []).filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const sku = String(p.sku || "").toLowerCase();
      return name.includes(q) || sku.includes(q);
    });
  }, [products, search]);

  const toggleProduct = (id) => {
    const sId = String(id);
    setLocalSelected((prev) =>
      prev.includes(sId) ? prev.filter((i) => i !== sId) : [...prev, sId]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredProducts.map((p) => String(p._id));
    setLocalSelected((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const clearAllFiltered = () => {
    const filteredIdsSet = new Set(filteredProducts.map((p) => String(p._id)));
    setLocalSelected((prev) => prev.filter((id) => !filteredIdsSet.has(id)));
  };

  const handleApply = () => {
    onChange(localSelected);
    setModalOpen(false);
  };

  const removeSingle = (idToRemove) => {
    const sId = String(idToRemove);
    onChange(normalizedSelected.filter((id) => id !== sId));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-[13px] font-bold text-[#1d2327]">
          Applicable Products (Optional)
        </label>
        <button
          type="button"
          onClick={openModal}
          className="text-[12px] font-semibold text-[#2271b1] hover:text-[#135e96] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Package className="w-3.5 h-3.5" />
          {normalizedSelected.length === 0
            ? "Choose Products"
            : `Manage Products (${normalizedSelected.length})`}
        </button>
      </div>

      {/* Selected Products Chips Preview */}
      {normalizedSelected.length === 0 ? (
        <div
          onClick={openModal}
          className="border border-dashed border-[#ccd0d4] rounded-[3px] p-3 text-center bg-[#fafafa] hover:bg-[#f6f7f7] cursor-pointer transition-colors"
        >
          <p className="text-[12px] text-[#646970]">
            No products restricted. This coupon will apply to <strong>all products</strong> storewide.
          </p>
          <span className="inline-block mt-1 text-[11px] font-bold text-[#2271b1]">
            + Click to restrict to specific products
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-[#fafafa] border border-[#ccd0d4] rounded-[3px]">
            {normalizedSelected.map((id) => {
              const prod = productMap.get(id);
              const name = prod?.name || `Product ID: ${id.slice(-6)}`;
              const img = prod?.image || (prod?.images && prod.images[0]) || null;
              const price = prod?.price !== undefined ? `$${Number(prod.price).toFixed(2)}` : "";

              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-white border border-[#c3c4c7] rounded-[3px] text-[11px] font-medium text-[#1d2327] shadow-xs"
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      className="w-4 h-4 rounded object-cover shrink-0"
                    />
                  ) : (
                    <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  )}
                  <span className="truncate max-w-[140px] sm:max-w-[200px]" title={name}>
                    {name}
                  </span>
                  {price && <span className="text-gray-400 text-[10px]">{price}</span>}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSingle(id);
                    }}
                    className="text-gray-400 hover:text-red-600 ml-0.5"
                    title="Remove product"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#646970]">
            <span>
              {normalizedSelected.length} product{normalizedSelected.length === 1 ? "" : "s"} selected
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-red-600 hover:text-red-800 hover:underline"
            >
              Clear all products
            </button>
          </div>
        </div>
      )}

      {/* ── Product Selection Modal ── */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
        >
          <div
            className="bg-white rounded-[4px] border border-[#c3c4c7] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#f6f7f7] border-b border-[#ccd0d4]">
              <div>
                <h3 className="text-[14px] font-bold text-[#1d2327]">
                  Select Products For Coupon
                </h3>
                <p className="text-[11px] text-[#646970]">
                  Only the checked products will be eligible for this discount.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search & Batch Bar */}
            <div className="p-3 border-b border-[#ccd0d4] bg-white space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search products by title or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-[12px] border border-[#ccd0d4] rounded-[3px] outline-none focus:border-[#2271b1]"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="text-[#2271b1] hover:underline font-semibold flex items-center gap-1"
                  >
                    <CheckSquare className="w-3 h-3" /> Select All ({filteredProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={clearAllFiltered}
                    className="text-gray-500 hover:underline flex items-center gap-1"
                  >
                    <Square className="w-3 h-3" /> Deselect All
                  </button>
                </div>
                <span className="text-[#1d2327] font-bold">
                  {localSelected.length} selected
                </span>
              </div>
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#f0f0f1] min-h-[260px] max-h-[420px]">
              {loading ? (
                <div className="p-10 text-center text-xs text-gray-400 italic">
                  Loading product catalog...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-10 text-center text-xs text-gray-500">
                  {search ? `No products match "${search}".` : "No products available in store."}
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const sId = String(p._id);
                  const isChecked = localSelected.includes(sId);
                  const img = p.image || (p.images && p.images[0]) || null;

                  return (
                    <div
                      key={sId}
                      onClick={() => toggleProduct(sId)}
                      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-[#f6f7f7] cursor-pointer transition-colors ${
                        isChecked ? "bg-[#f0f6fa]" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Handled by parent div
                        className="rounded-sm border-gray-300 text-[#2271b1] pointer-events-none"
                      />

                      <div className="w-9 h-9 rounded bg-[#f0f0f1] border border-[#ccd0d4] overflow-hidden shrink-0 flex items-center justify-center">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-4 h-4 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#1d2327] truncate">
                          {p.name}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-[#646970]">
                          {p.sku && <span>SKU: {p.sku}</span>}
                          {p.sku && <span>•</span>}
                          <span>${Number(p.price || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {isChecked && (
                        <span className="text-[11px] font-bold text-[#2271b1] px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">
                          Selected
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#f6f7f7] border-t border-[#ccd0d4]">
              <span className="text-[12px] text-[#646970]">
                {localSelected.length} product{localSelected.length === 1 ? "" : "s"} will be assigned
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="bg-[#f6f7f7] border border-[#ccd0d4] hover:bg-[#f0f0f1] text-[#2c3338] text-xs font-semibold px-3 py-1.5 rounded-[3px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="bg-[#2271b1] border border-[#135e96] hover:bg-[#135e96] text-white text-xs font-semibold px-4 py-1.5 rounded-[3px] shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Apply Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
