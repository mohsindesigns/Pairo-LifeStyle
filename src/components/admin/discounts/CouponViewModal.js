"use client";

import React, { useState } from "react";
import {
  X, QrCode, Copy, Check, Edit2, Calendar, ShieldCheck,
  Package, FolderTree, Tag, CheckCircle2, Clock, AlertTriangle
} from "lucide-react";

export default function CouponViewModal({
  discount,
  onClose,
  onEdit,
  onShare,
}) {
  const [copied, setCopied] = useState(false);
  if (!discount) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(discount.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isExpired = discount.endDate && new Date(discount.endDate) < new Date();
  const isScheduled = discount.startDate && new Date(discount.startDate) > new Date();

  let statusBadge = {
    label: "Active",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  };
  if (discount.isDeleted) {
    statusBadge = {
      label: "Trashed",
      color: "bg-red-50 text-red-700 border-red-200",
      icon: AlertTriangle,
    };
  } else if (!discount.isActive) {
    statusBadge = {
      label: "Inactive",
      color: "bg-gray-100 text-gray-700 border-gray-300",
      icon: Clock,
    };
  } else if (isScheduled) {
    statusBadge = {
      label: "Scheduled",
      color: "bg-blue-50 text-blue-700 border-blue-200",
      icon: Calendar,
    };
  } else if (isExpired) {
    statusBadge = {
      label: "Expired",
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: AlertTriangle,
    };
  }

  const StatusIcon = statusBadge.icon;

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[4px] border border-[#c3c4c7] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#f6f7f7] border-b border-[#ccd0d4] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded bg-[#2271b1]/10 border border-[#2271b1]/20 flex items-center justify-center text-[#2271b1] shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-[#1d2327] tracking-wider uppercase font-mono truncate">
                  {discount.code}
                </h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-[12px] text-[#646970]">
                {discount.type === "percentage" ? `${discount.value}% discount on eligible items` : `$${Number(discount.value || 0).toFixed(2)} fixed cart discount`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1.5 text-gray-500 hover:text-[#2271b1] hover:bg-gray-100 rounded"
              title="Copy coupon code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            {onShare && (
              <button
                type="button"
                onClick={() => onShare(discount)}
                className="p-1.5 text-gray-500 hover:text-[#2271b1] hover:bg-gray-100 rounded"
                title="QR Code & Share Link"
              >
                <QrCode className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-650 hover:bg-gray-100 rounded"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-[#f6f7f7] border border-[#ccd0d4] rounded-[3px] text-xs">
            <div>
              <span className="text-[#646970] block text-[11px] uppercase tracking-wider font-semibold">Discount</span>
              <span className="text-[15px] font-bold text-[#1d2327]">
                {discount.type === "percentage" ? `${discount.value}%` : `$${Number(discount.value).toFixed(2)}`}
              </span>
            </div>

            <div>
              <span className="text-[#646970] block text-[11px] uppercase tracking-wider font-semibold">Usage</span>
              <span className="text-[15px] font-bold text-[#1d2327]">
                {discount.usageCount || 0} <span className="text-gray-400 font-normal">/ {discount.usageLimit || "∞"}</span>
              </span>
            </div>

            <div>
              <span className="text-[#646970] block text-[11px] uppercase tracking-wider font-semibold">Min Spend</span>
              <span className="text-[15px] font-bold text-[#1d2327]">
                {discount.minPurchase ? `$${Number(discount.minPurchase).toFixed(2)}` : "None"}
              </span>
            </div>

            <div>
              <span className="text-[#646970] block text-[11px] uppercase tracking-wider font-semibold">Per User Limit</span>
              <span className="text-[15px] font-bold text-[#1d2327]">
                {discount.usagePerUserLimit !== null && discount.usagePerUserLimit !== undefined ? `${discount.usagePerUserLimit} per customer` : "Unlimited"}
              </span>
            </div>
          </div>

          {/* Applicable Products Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-bold text-[#1d2327] flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#2271b1]" />
                Applicable Products
              </h4>
              <span className="text-[11px] font-medium text-[#646970]">
                {products.length === 0 ? "Storewide" : `${products.length} product${products.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {products.length === 0 ? (
              <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-[3px] text-xs text-emerald-800">
                ✓ This coupon applies to <strong>all products</strong> in the catalog (no specific product restrictions).
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-[#ccd0d4] rounded-[3px] divide-y divide-gray-100 bg-white">
                {products.map((p, idx) => {
                  const name = typeof p === "object" ? p.name : `Product ID: ${p}`;
                  const img = typeof p === "object" ? (p.image || p.images?.[0]) : null;
                  const price = typeof p === "object" && p.price ? `$${Number(p.price).toFixed(2)}` : "";
                  const sku = typeof p === "object" ? p.sku : "";

                  return (
                    <div key={idx} className="flex items-center gap-2.5 px-3 py-2 text-xs">
                      <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#1d2327] truncate">{name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-[#646970]">
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-bold text-[#1d2327] flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-[#2271b1]" />
                Applicable Categories
              </h4>
              <span className="text-[11px] font-medium text-[#646970]">
                {categories.length === 0 ? "All Categories" : `${categories.length} category${categories.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {categories.length === 0 ? (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-[3px] text-xs text-gray-600">
                Applies to all product categories.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 border border-gray-200 rounded-[3px]">
                {categories.map((c, idx) => {
                  const name = typeof c === "object" ? c.name : `Category ID: ${c}`;
                  return (
                    <span key={idx} className="px-2.5 py-1 bg-white border border-gray-300 rounded-[3px] text-xs font-semibold text-[#1d2327]">
                      {name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Schedule & Timing */}
          <div className="border-t border-[#ccd0d4] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[#646970] font-semibold block mb-1">Start Date</span>
              <span className="font-medium text-[#1d2327]">{formatDate(discount.startDate)}</span>
            </div>
            <div>
              <span className="text-[#646970] font-semibold block mb-1">Expiry Date</span>
              <span className="font-medium text-[#1d2327]">{formatDate(discount.endDate)}</span>
            </div>
          </div>

          {/* Eligibility Conditions */}
          <div className="border-t border-[#ccd0d4] pt-4 space-y-2">
            <h4 className="text-[13px] font-bold text-[#1d2327] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2271b1]" />
              Rules & Restrictions
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 bg-[#f6f7f7] border border-gray-200 rounded-[3px]">
                <span className={discount.firstOrderOnly ? "text-emerald-600 font-bold" : "text-gray-400 font-bold"}>
                  {discount.firstOrderOnly ? "✓" : "✗"}
                </span>
                <span>First Order Only</span>
              </div>

              <div className="flex items-center gap-2 p-2 bg-[#f6f7f7] border border-gray-200 rounded-[3px]">
                <span className={discount.userRegistrationRequired ? "text-emerald-600 font-bold" : "text-gray-400 font-bold"}>
                  {discount.userRegistrationRequired ? "✓" : "✗"}
                </span>
                <span>Registered Customer Required</span>
              </div>

              <div className="flex items-center gap-2 p-2 bg-[#f6f7f7] border border-gray-200 rounded-[3px]">
                <span className={discount.newsletterSubscribedOnly ? "text-emerald-600 font-bold" : "text-gray-400 font-bold"}>
                  {discount.newsletterSubscribedOnly ? "✓" : "✗"}
                </span>
                <span>Newsletter Subscribers Only</span>
              </div>

              <div className="flex items-center gap-2 p-2 bg-[#f6f7f7] border border-gray-200 rounded-[3px]">
                <span className={discount.excludeSaleItems ? "text-emerald-600 font-bold" : "text-gray-400 font-bold"}>
                  {discount.excludeSaleItems ? "✓" : "✗"}
                </span>
                <span>Exclude Sale Items</span>
              </div>

              <div className="flex items-center gap-2 p-2 bg-[#f6f7f7] border border-gray-200 rounded-[3px]">
                <span className={discount.oneRedemptionPerDevice ? "text-emerald-600 font-bold" : "text-gray-400 font-bold"}>
                  {discount.oneRedemptionPerDevice ? "✓" : "✗"}
                </span>
                <span>1 Redemption Per Device/IP</span>
              </div>

              {discount.maxDiscountAmount && (
                <div className="flex items-center gap-2 p-2 bg-[#f6f7f7] border border-gray-200 rounded-[3px]">
                  <span className="text-[#2271b1] font-bold">$</span>
                  <span>Max Cap: ${Number(discount.maxDiscountAmount).toFixed(2)}</span>
                </div>
              )}
            </div>

            {discount.specificCustomers && discount.specificCustomers.length > 0 && (
              <div className="p-2.5 bg-[#f6f7f7] border border-gray-200 rounded-[3px] text-xs space-y-1 mt-2">
                <span className="font-bold text-[#1d2327] block">Restricted Customer Accounts:</span>
                <p className="text-[#646970] font-mono text-[11px]">
                  {discount.specificCustomers.map(c => typeof c === 'object' ? c.email : c).join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#f6f7f7] border-t border-[#ccd0d4] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#f6f7f7] border border-[#ccd0d4] hover:bg-[#f0f0f1] text-[#2c3338] text-xs font-semibold px-4 py-1.5 rounded-[3px]"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onEdit) onEdit(discount);
            }}
            className="bg-[#2271b1] border border-[#135e96] hover:bg-[#135e96] text-white text-xs font-semibold px-4 py-1.5 rounded-[3px] shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit This Coupon
          </button>
        </div>
      </div>
    </div>
  );
}
