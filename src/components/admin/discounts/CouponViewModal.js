"use client";

import React, { useState } from "react";
import {
  X, QrCode, Copy, Check, Edit2, Package,
} from "lucide-react";

export default function CouponViewModal({
  discount,
  onClose,
  onEdit,
  onShare,
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  if (!discount) return null;

  const handleCopyCode = async () => {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(discount.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyError("Could not copy the code.");
    }
  };

  const isExpired = discount.endDate && new Date(discount.endDate) < new Date();
  const isScheduled = discount.startDate && new Date(discount.startDate) > new Date();

  let statusBadge = {
    label: "Active",
    color: "wp-st-published",
  };
  if (discount.isDeleted) {
    statusBadge = {
      label: "Trashed",
      color: "wp-st-cancelled",
    };
  } else if (!discount.isActive) {
    statusBadge = {
      label: "Inactive",
      color: "wp-st-draft",
    };
  } else if (isScheduled) {
    statusBadge = {
      label: "Scheduled",
      color: "wp-st-shipped",
    };
  } else if (isExpired) {
    statusBadge = {
      label: "Expired",
      color: "wp-st-confirmed",
    };
  }

  const products = Array.isArray(discount.specificProducts)
    ? discount.specificProducts
    : [];
  const categories = Array.isArray(discount.specificCategories)
    ? discount.specificCategories
    : [];

  const formatDate = (dStr) => {
    if (!dStr) return "None";
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? "None" : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const titleId = `coupon-view-title-${discount._id || "x"}`;

  const rule = (on, label) => (
    <div className="wp-kv">
      <span className="wp-kv-k">{label}</span>
      <span className={on ? "wp-stock-in" : "wp-muted"}>{on ? "Yes" : "No"}</span>
    </div>
  );

  return (
    <div
      className="wp-modal-backdrop"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="wp-modal"
        style={{ maxWidth: 680 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="wp-modal-head" style={{ gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id={titleId} style={{ overflowWrap: "anywhere" }}>
                {discount.code}
              </h2>
              <span className={`wp-pill wp-pill-sm ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            </div>
            <p className="wp-desc" style={{ marginTop: 2 }}>
              {discount.type === "percentage" ? `${discount.value}% discount on eligible items` : `$${Number(discount.value || 0).toFixed(2)} fixed cart discount`}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleCopyCode}
              className="wp-notice-dismiss min-h-10 min-w-10 items-center justify-center"
              title="Copy coupon code"
              aria-label={copied ? "Coupon code copied" : "Copy coupon code"}
            >
              {copied ? <Check className="w-5 h-5" aria-hidden="true" style={{ color: "#2f6f1a" }} /> : <Copy className="w-5 h-5" aria-hidden="true" />}
            </button>
            {copyError && (
              <span role="alert" className="wp-small" style={{ color: "#b32d2e" }}>{copyError}</span>
            )}
            {onShare && (
              <button
                type="button"
                onClick={() => onShare(discount)}
                className="wp-notice-dismiss min-h-10 min-w-10 items-center justify-center"
                title="QR Code & Share Link"
                aria-label="QR code and share link"
              >
                <QrCode className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="wp-notice-dismiss min-h-10 min-w-10 items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="wp-modal-body">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6" style={{ marginBottom: 16 }}>
            <div>
              <div className="wp-kv">
                <span className="wp-kv-k">Discount</span>
                <span className="wp-kv-v">
                  {discount.type === "percentage" ? `${discount.value}%` : `$${Number(discount.value).toFixed(2)}`}
                </span>
              </div>
              <div className="wp-kv">
                <span className="wp-kv-k">Usage / limit</span>
                <span className="wp-kv-v">
                  {discount.usageCount || 0} <span className="wp-muted" style={{ fontWeight: 400 }}>/ {discount.usageLimit || "∞"}</span>
                </span>
              </div>
              <div className="wp-kv">
                <span className="wp-kv-k">Start date</span>
                <span className="wp-kv-v">{formatDate(discount.startDate)}</span>
              </div>
            </div>
            <div>
              <div className="wp-kv">
                <span className="wp-kv-k">Minimum spend</span>
                <span className="wp-kv-v">
                  {discount.minPurchase ? `$${Number(discount.minPurchase).toFixed(2)}` : "None"}
                </span>
              </div>
              <div className="wp-kv">
                <span className="wp-kv-k">Usage limit per user</span>
                <span className="wp-kv-v">
                  {discount.usagePerUserLimit !== null && discount.usagePerUserLimit !== undefined ? `${discount.usagePerUserLimit} per customer` : "Unlimited"}
                </span>
              </div>
              <div className="wp-kv">
                <span className="wp-kv-k">Expiry date</span>
                <span className="wp-kv-v">{formatDate(discount.endDate)}</span>
              </div>
            </div>
          </div>

          {/* Applicable Products Section */}
          <div style={{ marginBottom: 16 }}>
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
              <h3 className="wp-strong" style={{ margin: 0, fontSize: 14 }}>
                Applicable products
              </h3>
              <span className="wp-muted">
                {products.length === 0 ? "Storewide" : `${products.length} product${products.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {products.length === 0 ? (
              <div className="wp-notice wp-notice-info" style={{ margin: 0 }}>
                <p>This coupon applies to <strong>all products</strong> in the catalog (no specific product restrictions).</p>
              </div>
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: 192, border: "1px solid #dcdcde" }}>
                {products.map((p, idx) => {
                  const name = typeof p === "object" ? p.name : `Product ID: ${p}`;
                  const img = typeof p === "object" ? (p.image || p.images?.[0]) : null;
                  const price = typeof p === "object" && p.price ? `$${Number(p.price).toFixed(2)}` : "";
                  const sku = typeof p === "object" ? p.sku : "";

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5"
                      style={{ padding: "8px 10px", borderBottom: "1px solid #f0f0f1", background: idx % 2 ? "#f6f7f7" : "#fff" }}
                    >
                      <span className="wp-thumb" style={{ width: 32, height: 32 }}>
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" />
                        ) : (
                          <Package className="w-4 h-4" aria-hidden="true" style={{ color: "#a7aaad" }} />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="wp-strong truncate" style={{ margin: 0 }}>{name}</p>
                        <div className="flex items-center gap-2 wp-muted wp-small">
                          {sku && <span>SKU: {sku}</span>}
                          {price && <span>{price}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Applicable Categories Section */}
          <div style={{ marginBottom: 16 }}>
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
              <h3 className="wp-strong" style={{ margin: 0, fontSize: 14 }}>
                Applicable categories
              </h3>
              <span className="wp-muted">
                {categories.length === 0 ? "All Categories" : `${categories.length} category${categories.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {categories.length === 0 ? (
              <p className="wp-muted" style={{ margin: 0 }}>
                Applies to all product categories.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c, idx) => {
                  const name = typeof c === "object" ? c.name : `Category ID: ${c}`;
                  return (
                    <span key={idx} className="wp-chip">
                      {name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Eligibility Conditions */}
          <div>
            <h3 className="wp-strong" style={{ margin: "0 0 6px", fontSize: 14 }}>
              Rules &amp; restrictions
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {rule(discount.firstOrderOnly, "First order only")}
              {rule(discount.userRegistrationRequired, "Registered customer required")}
              {rule(discount.newsletterSubscribedOnly, "Newsletter subscribers only")}
              {rule(discount.excludeSaleItems, "Exclude sale items")}
              {rule(discount.oneRedemptionPerDevice, "1 redemption per device/IP")}

              {Number(discount.maxDiscountAmount) > 0 && (
                <div className="wp-kv">
                  <span className="wp-kv-k">Max discount cap</span>
                  <span className="wp-kv-v">${Number(discount.maxDiscountAmount).toFixed(2)}</span>
                </div>
              )}
            </div>

            {((discount.specificCustomerEmails && discount.specificCustomerEmails.length > 0) || (discount.specificCustomers && discount.specificCustomers.length > 0)) && (
              <div style={{ marginTop: 12, padding: 10, background: "#f6f7f7", border: "1px solid #dcdcde" }}>
                <span className="wp-strong block">Restricted to specific customers</span>
                <p className="wp-muted" style={{ margin: "4px 0 0", overflowWrap: "anywhere" }}>
                  {discount.specificCustomerEmails && discount.specificCustomerEmails.length > 0
                    ? discount.specificCustomerEmails.join(", ")
                    : discount.specificCustomers.map(c => typeof c === 'object' ? c.email : c).join(", ")}
                </p>
                {discount.notifiedCustomerEmails && discount.notifiedCustomerEmails.length > 0 && (
                  <p className="wp-small" style={{ margin: "4px 0 0", color: "#2f6f1a", overflowWrap: "anywhere" }}>Notified: {discount.notifiedCustomerEmails.join(", ")}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="wp-modal-foot" style={{ justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={onClose}
            className="wp-btn"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onEdit) onEdit(discount);
            }}
            className="wp-btn wp-btn-primary"
          >
            <Edit2 className="w-4 h-4" aria-hidden="true" />
            Edit coupon
          </button>
        </div>
      </div>
    </div>
  );
}
