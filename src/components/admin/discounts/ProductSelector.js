"use client";

import React, { useState, useMemo, useId } from "react";
import { X, Check, Package } from "lucide-react";
import { formatMoney } from "@/components/admin/ui";

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

  const uid = useId();
  const headingId = `${uid}-products`;
  const modalTitleId = `${uid}-modal-title`;
  const searchId = `${uid}-search`;

  return (
    <div role="group" aria-labelledby={headingId} className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: 6 }}>
        <span id={headingId} className="wp-strong">
          Products
        </span>
        <button
          type="button"
          onClick={openModal}
          className="wp-btn"
        >
          <Package className="w-4 h-4" aria-hidden="true" />
          {normalizedSelected.length === 0
            ? "Choose Products"
            : `Manage Products (${normalizedSelected.length})`}
        </button>
      </div>

      {/* Selected Products Chips Preview */}
      {normalizedSelected.length === 0 ? (
        <button
          type="button"
          onClick={openModal}
          className="wp-muted w-full text-left"
          style={{ border: "1px dashed #c3c4c7", background: "#fff", padding: "10px 12px", minHeight: 40, cursor: "pointer" }}
        >
          No products restricted. This coupon will apply to <strong>all products</strong> storewide.{" "}
          <span className="wp-link">Restrict to specific products</span>
        </button>
      ) : (
        <div>
          <div className="flex flex-wrap gap-1.5 overflow-y-auto" style={{ maxHeight: 160, border: "1px solid #dcdcde", background: "#fff", padding: 8 }}>
            {normalizedSelected.map((id) => {
              const prod = productMap.get(id);
              const name = prod?.name || `Product ID: ${id.slice(-6)}`;
              const img = prod?.image || (prod?.images && prod.images[0]) || null;
              const price = prod?.price !== undefined ? formatMoney(Number(prod.price)) : "";

              return (
                <span key={id} className="wp-chip" style={{ maxWidth: "100%" }}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      className="w-5 h-5 object-cover shrink-0"
                      style={{ borderRadius: 2 }}
                    />
                  ) : (
                    <Package className="w-4 h-4 shrink-0" aria-hidden="true" style={{ color: "#a7aaad" }} />
                  )}
                  <span className="truncate max-w-[160px] sm:max-w-[220px]" title={name}>
                    {name}
                  </span>
                  {price && <span className="wp-muted wp-small">{price}</span>}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSingle(id);
                    }}
                    aria-label={`Remove ${name}`}
                    title="Remove product"
                    className="max-[782px]:min-h-8 max-[782px]:min-w-8 items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </span>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginTop: 6 }}>
            <span className="wp-muted">
              {normalizedSelected.length} product{normalizedSelected.length === 1 ? "" : "s"} selected
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="wp-link max-[782px]:min-h-10"
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "#b32d2e" }}
            >
              Clear all products
            </button>
          </div>
        </div>
      )}

      {/* ── Product Selection Modal ── */}
      {modalOpen && (
        <div className="wp-modal-backdrop" style={{ zIndex: 99999 }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            className="wp-modal flex flex-col"
            style={{ maxWidth: 680 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="wp-modal-head" style={{ gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 id={modalTitleId}>
                  Select products for coupon
                </h2>
                <p className="wp-desc" style={{ marginTop: 2 }}>
                  Only the checked products will be eligible for this discount.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="wp-notice-dismiss shrink-0 min-h-10 min-w-10 items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Search & Batch Bar */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #dcdcde" }}>
              <label htmlFor={searchId} className="sr-only">Search products by title or SKU</label>
              <div className="flex gap-1.5">
                <input
                  id={searchId}
                  type="text"
                  placeholder="Search products by title or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  // Filtering is live; Enter must not submit the surrounding coupon form.
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  className="wp-input flex-1 min-w-0"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="wp-btn"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginTop: 8 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="wp-btn"
                  >
                    Select all ({filteredProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={clearAllFiltered}
                    className="wp-btn"
                  >
                    Deselect all
                  </button>
                </div>
                <span className="wp-strong">
                  {localSelected.length} selected
                </span>
              </div>
            </div>

            {/* Products List */}
            <div className="overflow-y-auto" style={{ minHeight: 160, maxHeight: "min(420px, 50dvh)" }}>
              {loading ? (
                <p className="wp-muted" style={{ padding: 16, margin: 0 }}>
                  Loading product catalog...
                </p>
              ) : filteredProducts.length === 0 ? (
                <p className="wp-muted" style={{ padding: 16, margin: 0 }}>
                  {search ? `No products match "${search}".` : "No products available in store."}
                </p>
              ) : (
                filteredProducts.map((p, idx) => {
                  const sId = String(p._id);
                  const isChecked = localSelected.includes(sId);
                  const img = p.image || (p.images && p.images[0]) || null;

                  return (
                    <label
                      key={sId}
                      className="flex items-center gap-3 cursor-pointer"
                      style={{
                        padding: "8px 16px",
                        minHeight: 48,
                        borderBottom: "1px solid #f0f0f1",
                        background: isChecked ? "#f0f6fc" : idx % 2 ? "#f6f7f7" : "#fff",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleProduct(sId)}
                        style={{ width: 16, height: 16, margin: 0, accentColor: "#2271b1", flex: "none" }}
                      />

                      <span className="wp-thumb" style={{ width: 36, height: 36 }}>
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                          />
                        ) : (
                          <Package className="w-4 h-4" aria-hidden="true" style={{ color: "#a7aaad" }} />
                        )}
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ color: "#2271b1", fontWeight: 600 }}>
                          {p.name}
                        </span>
                        <span className="block wp-muted wp-small">
                          {p.sku && <>SKU: {p.sku} · </>}
                          {formatMoney(Number(p.price || 0))}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="wp-modal-foot flex-wrap items-center" style={{ justifyContent: "space-between" }}>
              <span className="wp-muted">
                {localSelected.length} product{localSelected.length === 1 ? "" : "s"} will be assigned
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="wp-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="wp-btn wp-btn-primary"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Apply selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
